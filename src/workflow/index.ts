import type { AIProvider, ChatMode, ModeRoles, ProviderModels, WorkflowPresetId } from '../../shared/types';
import { AI_PROVIDERS, CHAT_MODES, DEFAULT_FREE_TARGET_PROVIDERS } from '../../shared/constants';
import { getRuntimeAppVersion } from '../appVersion';
import { host } from '../host';
import type { Locale } from '../i18n/resolve';
import { formatI18n, t } from '../i18n/t';
import { abortWorkflow, getInFlightProviders } from './cancel';
import { emitSystemError, sendWorkflowStatus } from './events';
import { executeGraph, preflightGraph, resolveGraphRoles, workflowGraphs, type WorkflowGraph } from './graph';
import type { PreflightResult } from './preflight';
import { readyProvidersFromStates, resolveEffectiveRoles } from './roleAutoAssignment';
import { prepareWorkflowRun } from './runtime';
import type { ResponseLanguagePolicy } from './responseLanguage';
import { isProviderPageReloadedError } from './providerResponse';
import { isSendable } from './sendability';
import { persistSnapshotIfEnabled } from './snapshot/persistence';
import type { SnapshotRedactionTier } from './snapshot/types';
import { tearDownWaiters } from './teardown';
import { cancelPendingStepTimeoutAction } from './stepTimeout';

export interface RunWorkflowParams {
  text: string;
  context?: string;
  mode: ChatMode;
  presetId?: WorkflowPresetId;
  roles?: ModeRoles;
  targets?: AIProvider[];
  activeProviders?: readonly AIProvider[];
  checkpoints?: boolean;
  locale?: Locale;
  snapshotPersistence?: boolean;
  snapshotRedactionTier?: SnapshotRedactionTier;
  responseLanguagePolicy?: ResponseLanguagePolicy;
  providerModels?: ProviderModels;
}

export type RunWorkflowResult = { ok: true } | { ok: false; preflight: PreflightResult };

interface ActiveWorkflowRun {
  settled: Promise<void>;
  finish: () => void;
}

let activeWorkflowRun: ActiveWorkflowRun | undefined;
let workflowStartGate = Promise.resolve();

export async function runWorkflow(params: RunWorkflowParams): Promise<RunWorkflowResult> {
  const run = await beginWorkflowRun();
  try {
    return await runPreparedWorkflow(params);
  } finally {
    run.finish();
  }
}

async function runPreparedWorkflow({
  text,
  context,
  mode,
  presetId,
  roles,
  targets,
  activeProviders,
  checkpoints,
  locale,
  snapshotPersistence,
  snapshotRedactionTier,
  responseLanguagePolicy,
  providerModels,
}: RunWorkflowParams): Promise<RunWorkflowResult> {
  const snapshotOptions = {
    enabled: snapshotPersistence,
    tier: snapshotRedactionTier,
  };
  try {
    const appVersion = await getRuntimeAppVersion();
    const graphOptions = {
      onSnapshotComplete: (snapshot: Parameters<typeof persistSnapshotIfEnabled>[0]) =>
        persistSnapshotIfEnabled(snapshot, snapshotOptions),
      ...(appVersion ? { appVersion } : {}),
    };
    if (presetId === 'brainstorm') {
      const graph = workflowGraphs.brainstorm;
      const effectiveRoles = await resolveRunRoles(graph, roles, activeProviders);
      const preflight = await preflightGraph(graph, effectiveRoles, activeProviders);
      if (!preflight.ok) return { ok: false, preflight };

      await executeGraph(graph, { text, context, roles: effectiveRoles, checkpoints, locale, responseLanguagePolicy, providerModels }, graphOptions);
      return { ok: true };
    }

    if (!CHAT_MODES[mode].serial) {
      const snapshot = await host.connections.get();
      const sendable = snapshot.filter(isSendable).map((state) => state.provider);
      const active = activeProviders ?? DEFAULT_FREE_TARGET_PROVIDERS;
      const targetSet =
        targets === undefined
          ? sendable.filter((provider) => active.includes(provider))
          : targets.filter((provider) => sendable.includes(provider) && active.includes(provider));
      await executeGraph(
        workflowGraphs.free,
        { text, context, targets: targetSet, checkpoints, locale, responseLanguagePolicy, providerModels },
        graphOptions,
      );
      return { ok: true };
    }

    const serialMode = mode as Exclude<ChatMode, 'free'>;
    const graph = workflowGraphs[serialMode];
    const effectiveRoles = await resolveRunRoles(graph, roles, activeProviders);
    const preflight = await preflightGraph(graph, effectiveRoles, activeProviders);
    if (!preflight.ok) return { ok: false, preflight };

    await executeGraph(graph, { text, context, roles: effectiveRoles, checkpoints, locale, responseLanguagePolicy, providerModels }, graphOptions);

    return { ok: true };
  } catch (error) {
    await tearDownWaiters(getInFlightProviders(), { stopClick: true });
    emitSystemError(workflowFailureText(error, locale));
    sendWorkflowStatus('');
    return { ok: true };
  }
}

/**
 * Seats a serial run actually runs with. When the saved seats point at
 * providers that are logged out but at least two other providers are
 * ready, the seats are filled from the ready providers (see
 * resolveEffectiveRoles) so the run starts instead of blocking on the
 * saved lineup. The same seats go to the preflight and the execution.
 */
async function resolveRunRoles(
  graph: WorkflowGraph,
  roles: ModeRoles | undefined,
  activeProviders: readonly AIProvider[] | undefined,
): Promise<Record<string, AIProvider>> {
  const configured =
    roles ?? (Object.fromEntries(resolveGraphRoles(graph, undefined)) as Record<string, AIProvider>);
  const snapshot = await host.connections.get();
  const byProvider = new Map(snapshot.map((state) => [state.provider, state]));
  const active = activeProviders ?? DEFAULT_FREE_TARGET_PROVIDERS;
  const ready = readyProvidersFromStates(byProvider, active);
  return resolveEffectiveRoles(configured, ready, active);
}

function workflowFailureText(error: unknown, locale: Locale | undefined): string {
  if (isProviderPageReloadedError(error)) {
    return formatI18n(t('workflow.providerPageReloaded', locale ?? 'en'), {
      provider: AI_PROVIDERS[error.provider].name,
    });
  }
  return error instanceof Error ? error.message : String(error);
}

async function beginWorkflowRun(): Promise<ActiveWorkflowRun> {
  const releaseStartGate = await acquireWorkflowStartGate();
  try {
    const previous = activeWorkflowRun;
    if (previous) {
      const previousProviders = getInFlightProviders();
      abortWorkflow();
      cancelPendingStepTimeoutAction();
      const cleanup = tearDownWaiters(previousProviders, { stopClick: true });
      await Promise.allSettled([previous.settled, cleanup]);
    }

    prepareWorkflowRun();
    let resolveSettled = () => {};
    const run: ActiveWorkflowRun = {
      settled: new Promise<void>((resolve) => {
        resolveSettled = resolve;
      }),
      finish: () => {
        if (activeWorkflowRun === run) activeWorkflowRun = undefined;
        resolveSettled();
      },
    };
    activeWorkflowRun = run;
    return run;
  } finally {
    releaseStartGate();
  }
}

async function acquireWorkflowStartGate(): Promise<() => void> {
  const previous = workflowStartGate;
  let release = () => {};
  workflowStartGate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await previous;
  return release;
}

export { isSendable } from './sendability';
export { resetWorkflowRuntimeForTests } from './runtime';
export { chooseStepTimeoutAction, onStepTimeoutEvent } from './stepTimeout';
