import type { AIProvider, ProviderState } from '../../shared/types';
import { DEFAULT_FREE_TARGET_PROVIDERS } from '../../shared/constants';
import { formatI18n, t } from '../i18n/t';
import type { Locale } from '../i18n/resolve';
import { MIN_DISTINCT_READY_PROVIDERS } from '../workflow/preflight';
import { readyProvidersFromStates } from '../workflow/roleAutoAssignment';
import { isSendable } from '../workflow/sendability';
import type { ModeRoleAssignments } from './modeRoleAssignment';
import { defaultRolesForPreset, type PresetCatalogEntry } from './presetCatalogData';

export function presetReadiness(
  preset: PresetCatalogEntry,
  states: Record<AIProvider, ProviderState>,
  locale: Locale,
  modeRoles?: ModeRoleAssignments,
  activeProviders?: readonly AIProvider[],
): { label: string; ready: boolean } {
  const roles = defaultRolesForPreset(preset.graphId, preset.id, modeRoles);
  if (!roles) {
    const providers = activeProviders ?? DEFAULT_FREE_TARGET_PROVIDERS;
    const readyCount = providers.filter((provider) => isSendable(states[provider])).length;
    return {
      label: formatI18n(t('preset.readinessAny', locale), { ready: readyCount }),
      ready: readyCount > 0,
    };
  }

  // A serial mode no longer counts only the saved seats: seats that point
  // at logged-out providers are filled from the ready providers at launch,
  // so the card counts the ready providers that can take a seat. Three
  // ready providers read 3/4, and two are enough to start.
  const providers = activeProviders ?? DEFAULT_FREE_TARGET_PROVIDERS;
  const readyProviders = readyProvidersFromStates(states, providers);
  const total = Object.keys(roles).length;
  const readyCount = Math.min(readyProviders.length, total);
  const ready = readyCount >= MIN_DISTINCT_READY_PROVIDERS;
  return {
    label: formatI18n(t('preset.readinessRequired', locale), { ready: readyCount, total }),
    ready,
  };
}
