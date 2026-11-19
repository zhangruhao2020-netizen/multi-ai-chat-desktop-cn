import { describe, expect, it } from 'vitest';
import { ALL_AI_PROVIDERS, DEFAULT_FREE_TARGET_PROVIDERS } from '../../shared/constants';
import type { AIProvider, ProviderState } from '../../shared/types';
import { readyProvidersFromStates, resolveEffectiveRoles } from '../workflow/roleAutoAssignment';

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

// Saved seats from before the M12 reseat: none of ChatGPT/Claude/Grok is
// logged in, only Gemini is — the exact lineup behind the "1/4" report.
const staleDebateRoles: Record<string, AIProvider> = { pro: 'chatgpt', con: 'claude', judge: 'grok', summary: 'gemini' };
const active = [...DEFAULT_FREE_TARGET_PROVIDERS];

describe('readyProvidersFromStates', () => {
  it('returns sendable active providers in lineup order', () => {
    expect(readyProvidersFromStates(statesFor(['deepseek', 'doubao', 'gemini']), active)).toEqual([
      'deepseek',
      'doubao',
      'gemini',
    ]);
  });

  it('never counts a provider outside the active lineup', () => {
    const states = statesFor(['deepseek', 'gemini', 'meta']);
    expect(readyProvidersFromStates(states, active)).toEqual(['deepseek', 'gemini']);
  });

  it('dedupes repeated candidates', () => {
    expect(readyProvidersFromStates(statesFor(['gemini']), ['gemini', 'gemini'])).toEqual(['gemini']);
  });
});

describe('resolveEffectiveRoles', () => {
  it('keeps the saved seats when every seated provider is ready', () => {
    const twoModel: Record<string, AIProvider> = { pro: 'gemini', con: 'deepseek', judge: 'gemini', summary: 'deepseek' };
    expect(resolveEffectiveRoles(twoModel, ['gemini', 'deepseek'], active)).toEqual(twoModel);
  });

  it('keeps the saved seats when fewer than two providers are ready', () => {
    expect(resolveEffectiveRoles(staleDebateRoles, ['gemini'], active)).toEqual(staleDebateRoles);
  });

  it('keeps the saved seats when a seat points outside the active lineup', () => {
    // A standby seat must keep blocking the run instead of silently
    // switching providers; the preflight reports it as unavailable.
    const withoutGrok = active.filter((provider) => provider !== 'grok');
    expect(resolveEffectiveRoles(staleDebateRoles, ['chatgpt', 'claude', 'gemini'], withoutGrok)).toEqual(
      staleDebateRoles,
    );
  });

  it('fills seats from three ready providers as A/B/C/A', () => {
    expect(resolveEffectiveRoles(staleDebateRoles, ['deepseek', 'doubao', 'gemini'], active)).toEqual({
      pro: 'deepseek',
      con: 'doubao',
      judge: 'gemini',
      summary: 'deepseek',
    });
  });

  it('fills seats from two ready providers as A/B/A/B', () => {
    expect(resolveEffectiveRoles(staleDebateRoles, ['deepseek', 'gemini'], active)).toEqual({
      pro: 'deepseek',
      con: 'gemini',
      judge: 'deepseek',
      summary: 'gemini',
    });
  });

  it('always puts the first two seats on different providers', () => {
    const consult: Record<string, AIProvider> = { first: 'chatgpt', second: 'claude', reviewer: 'grok', summary: 'gemini' };
    const filled = resolveEffectiveRoles(consult, ['gemini', 'deepseek'], active);
    expect(filled.first).not.toBe(filled.second);
    expect(new Set(Object.values(filled)).size).toBe(2);
  });
});
