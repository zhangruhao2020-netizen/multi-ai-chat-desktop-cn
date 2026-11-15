import type { AIProvider, ProviderState } from '../../shared/types';
import { DEFAULT_FREE_TARGET_PROVIDERS } from '../../shared/constants';
import { formatI18n, t } from '../i18n/t';
import type { Locale } from '../i18n/resolve';
import { MIN_DISTINCT_READY_PROVIDERS } from '../workflow/preflight';
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
  const required = roles ? ([...new Set(Object.values(roles))] as AIProvider[]) : preset.requiredProviders;
  if (required.length === 0) {
    const providers = activeProviders ?? DEFAULT_FREE_TARGET_PROVIDERS;
    const readyCount = providers.filter((provider) => isSendable(states[provider])).length;
    return {
      label: formatI18n(t('preset.readinessAny', locale), { ready: readyCount }),
      ready: readyCount > 0,
    };
  }

  const readyCount = required.filter((provider) => isSendable(states[provider])).length;
  // Roles may share a provider, so a serial mode is startable once every
  // assigned provider is ready and at least two different ready providers
  // cover the roles. With the four-provider defaults this still reads
  // 4/4; after reassigning the roles to two ready models it reads 2/2.
  const ready = readyCount === required.length && readyCount >= MIN_DISTINCT_READY_PROVIDERS;
  return {
    label: formatI18n(t('preset.readinessRequired', locale), { ready: readyCount, total: required.length }),
    ready,
  };
}
