import type { AIProvider, ChatMode, ModeRoles, ProviderState } from '../../shared/types';
import {
  DEFAULT_CODING_ROLES,
  DEFAULT_CONSULT_ROLES,
  DEFAULT_DEBATE_ROLES,
  DEFAULT_ROUNDTABLE_ROLES,
} from '../../shared/constants';
import { host } from '../host';
import { isSendable } from './sendability';

export interface PreflightResult {
  ok: boolean;
  unavailable: AIProvider[];
  aliased: AIProvider[];
  /**
   * True when every role resolves to a ready provider but the roles
   * collapse onto fewer than MIN_DISTINCT_READY_PROVIDERS distinct
   * providers — a one-model "debate" is not a discussion. The dialog
   * explains this instead of listing unavailable providers.
   */
  tooFewProviders?: boolean;
}

/**
 * Serial modes (debate, consult, coding, roundtable, brainstorm) may reuse
 * one provider across several roles — a two-AI debate is the intended
 * small setup — but they still need at least two different ready
 * providers, otherwise there is nobody to discuss with.
 */
export const MIN_DISTINCT_READY_PROVIDERS = 2;

export async function preflightSerialMode(mode: Exclude<ChatMode, 'free'>, roles?: ModeRoles): Promise<PreflightResult> {
  // This is a t=0 start gate only; mid-run provider loss is handled by error-as-DONE and step timeout.
  const resolved = resolveRoles(mode, roles);
  const snapshot = await host.connections.get();
  const byProvider = new Map<AIProvider, ProviderState>(snapshot.map((state) => [state.provider, state]));
  const roleProviders = Object.values(resolved) as AIProvider[];
  const unavailable = [...new Set(roleProviders.filter((provider) => !isSendable(byProvider.get(provider) ?? missingState(provider))))];
  const aliased = parallelAliases(mode, resolved);
  const readyCount = distinctReadyProviders(roleProviders, byProvider).size;
  const tooFewProviders = unavailable.length === 0 && aliased.length === 0 && readyCount < MIN_DISTINCT_READY_PROVIDERS;
  return {
    ok: unavailable.length === 0 && aliased.length === 0 && !tooFewProviders,
    unavailable,
    aliased,
    ...(tooFewProviders ? { tooFewProviders: true } : {}),
  };
}

/** Distinct providers among the roles that are currently sendable. */
export function distinctReadyProviders(
  roleProviders: readonly AIProvider[],
  byProvider: ReadonlyMap<AIProvider, ProviderState>,
): Set<AIProvider> {
  return new Set(
    roleProviders.filter((provider) => isSendable(byProvider.get(provider) ?? missingState(provider))),
  );
}

function missingState(provider: AIProvider): ProviderState {
  return { provider, webview: 'none', dom: 'unknown', login: 'unknown', thinking: false, lastStatusAt: 0 };
}

function resolveRoles(mode: Exclude<ChatMode, 'free'>, roles?: ModeRoles): ModeRoles {
  if (roles) return roles;
  if (mode === 'debate') return DEFAULT_DEBATE_ROLES;
  if (mode === 'consult') return DEFAULT_CONSULT_ROLES;
  if (mode === 'coding') return DEFAULT_CODING_ROLES;
  return DEFAULT_ROUNDTABLE_ROLES;
}

function parallelAliases(mode: Exclude<ChatMode, 'free'>, roles: ModeRoles): AIProvider[] {
  if (mode === 'consult') {
    const r = roles as typeof DEFAULT_CONSULT_ROLES;
    return r.first === r.second ? [r.first] : [];
  }
  // Roundtable seats may repeat a provider; only consult's parallel pair must differ.
  return [];
}
