import { describe, expect, it } from 'vitest';
import { ALL_AI_PROVIDERS } from '../../shared/constants';
import type { AIProvider, ProviderState } from '../../shared/types';
import { DEFAULT_MODE_ROLE_ASSIGNMENTS, type ModeRoleAssignments } from '../ui/modeRoleAssignment';
import { presetReadiness } from '../ui/presetReadiness';
import { PRESET_CATALOG } from '../ui/presetCatalogData';

function state(provider: AIProvider, sendable = true): ProviderState {
  return {
    provider,
    webview: sendable ? 'loaded' : 'none',
    dom: sendable ? 'ready' : 'unknown',
    login: sendable ? 'logged_in' : 'unknown',
    thinking: false,
    lastStatusAt: 1,
  };
}

function statesFor(sendable: readonly AIProvider[]): Record<AIProvider, ProviderState> {
  return Object.fromEntries(
    ALL_AI_PROVIDERS.map((provider) => [provider, state(provider, sendable.includes(provider))]),
  ) as Record<AIProvider, ProviderState>;
}

describe('presetReadiness', () => {
  const debate = PRESET_CATALOG.find((preset) => preset.id === 'debate')!;
  const free = PRESET_CATALOG.find((preset) => preset.id === 'free')!;

  it('is not ready when the four-provider debate defaults have only one ready provider', () => {
    expect(presetReadiness(debate, statesFor(['deepseek']), 'en')).toEqual({
      label: '1/4 ready',
      ready: false,
    });
  });

  it('is ready when two ready providers cover all four debate roles', () => {
    const twoModelRoles: ModeRoleAssignments = {
      ...DEFAULT_MODE_ROLE_ASSIGNMENTS,
      debate: { pro: 'gemini', con: 'deepseek', judge: 'gemini', summary: 'deepseek' },
    };
    expect(presetReadiness(debate, statesFor(['gemini', 'deepseek']), 'en', twoModelRoles)).toEqual({
      label: '2/4 ready',
      ready: true,
    });
  });

  it('is not ready when a single ready provider covers all four debate roles', () => {
    const oneModelRoles: ModeRoleAssignments = {
      ...DEFAULT_MODE_ROLE_ASSIGNMENTS,
      debate: { pro: 'gemini', con: 'gemini', judge: 'gemini', summary: 'gemini' },
    };
    expect(presetReadiness(debate, statesFor(['gemini']), 'en', oneModelRoles)).toEqual({
      label: '1/4 ready',
      ready: false,
    });
  });

  it('reads 3/4 when three ready providers can take the debate seats even if the saved seats point elsewhere', () => {
    // The reported bug: DeepSeek/Doubao/Gemini ready, but the saved seats
    // (ChatGPT/Claude/Grok/Gemini) only overlap on Gemini, so the card
    // used to read 1/4. Seats are filled from the ready providers now.
    expect(presetReadiness(debate, statesFor(['deepseek', 'doubao', 'gemini']), 'en')).toEqual({
      label: '3/4 ready',
      ready: true,
    });
  });

  it('reads 2/4 for consult once two providers are ready', () => {
    const consult = PRESET_CATALOG.find((preset) => preset.id === 'consult')!;
    expect(presetReadiness(consult, statesFor(['deepseek', 'gemini']), 'en')).toEqual({
      label: '2/4 ready',
      ready: true,
    });
  });

  it('keeps free dispatch startable with a single ready provider', () => {
    expect(presetReadiness(free, statesFor(['gemini']), 'en')).toEqual({
      label: '1 connected',
      ready: true,
    });
  });
});
