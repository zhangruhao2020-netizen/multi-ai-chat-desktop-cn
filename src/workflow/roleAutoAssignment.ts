import type { AIProvider, ModeRoles, ProviderState } from '../../shared/types';
import { MIN_DISTINCT_READY_PROVIDERS } from './preflight';
import { isSendable } from './sendability';

/**
 * Distinct sendable providers among `candidates`, in candidate order.
 * Candidates are normally the active lineup, so a standby provider never
 * counts as ready here even when its last known state still says Ready.
 */
export function readyProvidersFromStates(
  states: Readonly<Record<AIProvider, ProviderState>> | Map<AIProvider, ProviderState>,
  candidates: readonly AIProvider[],
): AIProvider[] {
  const ready: AIProvider[] = [];
  const seen = new Set<AIProvider>();
  for (const provider of candidates) {
    if (seen.has(provider)) continue;
    seen.add(provider);
    const state = states instanceof Map ? states.get(provider) : states[provider];
    if (state !== undefined && isSendable(state)) ready.push(provider);
  }
  return ready;
}

/**
 * Effective seats for a serial run.
 *
 * The saved lineup is kept as-is when it can run: every seated provider is
 * ready (the user may have deliberately picked two models), or fewer than
 * two providers are ready (the preflight then reports the real blocker),
 * or a seat points outside the active lineup (a standby seat must keep
 * blocking the run instead of silently switching providers).
 *
 * Otherwise — the saved seats point at providers that are logged out while
 * at least two other providers are ready — the seats are filled from the
 * ready providers in lineup order, cycling so the first two seats (the
 * opposing sides: debate pro/con, consult first/second) always land on
 * different providers and the later seats reuse the ready ones:
 * two ready providers seat A/B/A/B, three seat A/B/C/A.
 */
export function resolveEffectiveRoles(
  configured: ModeRoles | Record<string, AIProvider>,
  ready: readonly AIProvider[],
  active: readonly AIProvider[],
): Record<string, AIProvider> {
  const seats = Object.fromEntries(Object.entries(configured)) as Record<string, AIProvider>;
  const roleKeys = Object.keys(seats);
  const seated = Object.values(seats);
  const hasInactiveSeat = seated.some((provider) => !active.includes(provider));
  const allReady = seated.every((provider) => ready.includes(provider));
  if (hasInactiveSeat || allReady || ready.length < MIN_DISTINCT_READY_PROVIDERS) return seats;
  const filled = {} as Record<string, AIProvider>;
  roleKeys.forEach((role, index) => {
    filled[role] = ready[index % ready.length];
  });
  return filled;
}
