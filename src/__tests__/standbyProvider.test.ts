import { describe, expect, it } from 'vitest';
import { DEFAULT_FREE_TARGET_PROVIDERS, DEFAULT_STANDBY_PROVIDER } from '../../shared/constants';
import type { AIProvider } from '../../shared/types';
import {
  DEFAULT_MODE_ROLE_ASSIGNMENTS,
  replaceModeRoleProvider,
} from '../ui/modeRoleAssignment';
import {
  activeProvidersForStandby,
  defaultSettings,
  normalizeSettings,
} from '../ui/settingsModel';

describe('optional standby provider', () => {
  it('keeps the six default providers active and Meta AI on standby by default', () => {
    const settings = defaultSettings();

    expect(settings.standbyProvider).toBe(DEFAULT_STANDBY_PROVIDER);
    expect(activeProvidersForStandby(settings.standbyProvider)).toEqual(DEFAULT_FREE_TARGET_PROVIDERS);
    expect(settings.presentation.meta).toBe('chip');
  });

  it('repairs invalid standby values to Meta AI and excludes standby from restore-open providers', () => {
    const settings = normalizeSettings({
      standbyProvider: 'not-a-provider',
      openProviders: ['chatgpt', 'meta'],
    });

    expect(settings.standbyProvider).toBe('meta');
    expect(settings.openProviders).toEqual(['chatgpt']);
  });

  it('activates Meta AI when a core provider becomes standby and repairs its workflow seats', () => {
    const settings = normalizeSettings({
      settingsSchemaVersion: 2,
      standbyProvider: 'grok',
      modeRoles: DEFAULT_MODE_ROLE_ASSIGNMENTS,
      openProviders: ['grok', 'meta'],
    });

    expect(activeProvidersForStandby(settings.standbyProvider)).toEqual([
      'chatgpt',
      'claude',
      'deepseek',
      'doubao',
      'gemini',
      'meta',
    ]);
    expect(settings.openProviders).toEqual(['meta']);
    expect(settings.presentation.grok).toBe('chip');
    expect(settings.presentation.meta).toBe('side');
    expect(JSON.stringify(settings.modeRoles)).not.toContain('grok');
    // The vacated seats go to the newly activated standby (Meta); modes with
    // no Grok seat keep their defaults. Since M12 the modes seat different
    // rotated slices, so the repaired sets differ per mode.
    expect(settings.modeRoles.consult.summary).toBe('meta');
    expect(settings.modeRoles.coding.reviewer).toBe('meta');
    expect(settings.modeRoles.debate).toEqual(DEFAULT_MODE_ROLE_ASSIGNMENTS.debate);
    expect(settings.modeRoles.roundtable).toEqual(DEFAULT_MODE_ROLE_ASSIGNMENTS.roundtable);
    const active = new Set(activeProvidersForStandby(settings.standbyProvider));
    for (const roles of Object.values(settings.modeRoles) as Record<string, AIProvider>[]) {
      expect(new Set(Object.values(roles)).size).toBe(4);
      for (const provider of Object.values(roles)) expect(active.has(provider)).toBe(true);
    }
  });

  it('does not let a stale standby center consume the active provider center slot', () => {
    const settings = normalizeSettings({
      standbyProvider: 'grok',
      presentation: {
        chatgpt: 'side',
        claude: 'side',
        gemini: 'side',
        grok: 'center',
        meta: 'center',
      },
    });

    expect(settings.presentation.grok).toBe('chip');
    expect(settings.presentation.meta).toBe('center');
  });

  it('moves every seat owned by the newly selected standby to the previous standby', () => {
    const swapped = replaceModeRoleProvider(DEFAULT_MODE_ROLE_ASSIGNMENTS, 'grok', 'meta');

    expect(JSON.stringify(swapped)).not.toContain('grok');
    expect(JSON.stringify(swapped)).toContain('meta');
    // Grok holds the summary seat in consult and the reviewer seat in coding
    // (M12 seating); both move to Meta while the other modes are untouched.
    expect(DEFAULT_MODE_ROLE_ASSIGNMENTS.consult.summary).toBe('grok');
    expect(DEFAULT_MODE_ROLE_ASSIGNMENTS.coding.reviewer).toBe('grok');
    expect(swapped.consult.summary).toBe('meta');
    expect(swapped.coding.reviewer).toBe('meta');
    expect(swapped.debate).toEqual(DEFAULT_MODE_ROLE_ASSIGNMENTS.debate);
    expect(swapped.roundtable).toEqual(DEFAULT_MODE_ROLE_ASSIGNMENTS.roundtable);
  });
});
