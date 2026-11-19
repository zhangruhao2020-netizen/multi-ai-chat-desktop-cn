import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { AI_PROVIDERS } from '../../shared/constants';
import type { AIProvider } from '../../shared/types';
import type { I18nKey } from '../i18n/keys';
import type { Locale } from '../i18n/resolve';
import { formatI18n, t } from '../i18n/t';
import { host, type StoredSnapshotInfo } from '../host';
import { Button } from './Button';
import { getLastSnapshot } from '../workflow/snapshot/recorder';
import { isInactiveStandbyProvider } from '../workflow/graph/preflight';
import {
  parseStoredSnapshot,
  planReplay,
  replaySnapshot,
  type ReplayBlockReason,
  type ReplayPlan,
  type ReplayResult,
} from '../workflow/snapshot/replay';
import type { ExecutionSnapshot } from '../workflow/snapshot/types';
import type { ResponseLanguagePolicy } from '../workflow/responseLanguage';

export type ReplaySource =
  | { kind: 'last'; snapshot: ExecutionSnapshot }
  | { kind: 'stored'; snapshotId: string; info?: StoredSnapshotInfo };

interface ReplayRunOptions {
  question?: string;
  replayWithCurrentGraph?: boolean;
}

interface ReplayBlockState {
  reason: ReplayBlockReason;
  source: ReplaySource;
  detail?: unknown;
  preflight?: Extract<ReplayResult, { ok: false }>['preflight'];
}

interface ReplayNotice {
  kind: 'ok' | 'error';
  text: string;
  retryLoginProvider?: AIProvider;
}

export interface ReplayPanelProps {
  locale?: Locale;
  responseLanguagePolicy?: ResponseLanguagePolicy;
  activeProviders?: readonly AIProvider[];
  onReplayWillRun?: (plan: ReplayPlan) => void;
  onReplaySettled?: () => void;
  onSnapshotComplete?: (snapshot: ExecutionSnapshot) => void | Promise<void>;
  onOpenLogin?: (provider: AIProvider) => void | Promise<void>;
  onOpenSettings?: () => void;
}

interface ReplayPanelState {
  storedSnapshots: StoredSnapshotInfo[];
  loadingStored: boolean;
  listError?: string;
  busyKey?: string;
  block?: ReplayBlockState;
  question: string;
  notice?: ReplayNotice;
}

const initialState: ReplayPanelState = {
  storedSnapshots: [],
  loadingStored: false,
  question: '',
};

export function sortStoredSnapshotsNewestFirst(snapshots: StoredSnapshotInfo[]): StoredSnapshotInfo[] {
  return [...snapshots].sort((a, b) => snapshotTime(b) - snapshotTime(a));
}

// L5: converted from a class component to a function component. App drives
// replays imperatively (startup session checkpoint), so the panel exposes its
// actions through a ref handle instead of class instance methods.
export interface ReplayPanelHandle {
  startReplay: (source: ReplaySource, options?: ReplayRunOptions) => Promise<ReplayResult | undefined>;
  refreshStoredSnapshots: () => Promise<void>;
  deleteStoredSnapshot: (snapshotId: string) => Promise<void>;
}

export const ReplayPanel = forwardRef<ReplayPanelHandle, ReplayPanelProps>(function ReplayPanel(props, ref) {
  const [state, setState] = useState<ReplayPanelState>(initialState);
  // Async flows read the latest state (e.g. the question typed while a replay
  // was in flight); a ref mirror keeps those reads fresh without stale closures.
  const stateRef = useRef(state);
  stateRef.current = state;
  const loginRequestGeneration = useRef(0);
  const loginInFlight = useRef(false);

  const locale = props.locale ?? 'en';
  const translate = (key: I18nKey): string => t(key, locale);

  const updateState = (patch: Partial<ReplayPanelState>): void => {
    setState((current) => ({ ...current, ...patch }));
  };

  const isInactiveStandby = (provider: AIProvider): boolean => {
    return isInactiveStandbyProvider(provider, props.activeProviders);
  };

  const refreshStoredSnapshots = useCallback(async (): Promise<void> => {
    setState((current) => ({ ...current, loadingStored: true, listError: undefined }));
    try {
      const storedSnapshots = sortStoredSnapshotsNewestFirst(await host.snapshot.list());
      setState((current) => ({ ...current, storedSnapshots, loadingStored: false }));
    } catch (error) {
      setState((current) => ({ ...current, loadingStored: false, listError: errorMessage(error) }));
    }
  }, []);

  useEffect(() => {
    void refreshStoredSnapshots();
    return () => {
      // Invalidate in-flight login attempts when the panel unmounts.
      loginRequestGeneration.current += 1;
    };
  }, [refreshStoredSnapshots]);

  const planReplayForSource = async (source: ReplaySource, options: ReplayRunOptions): Promise<ReplayPlan | undefined> => {
    try {
      if (source.kind === 'last') return planReplay(source.snapshot, { replayWithCurrentGraph: options.replayWithCurrentGraph });
      const json = await host.snapshot.load(source.snapshotId);
      if (json === null) return undefined;
      return planReplay(parseStoredSnapshot(json), { replayWithCurrentGraph: options.replayWithCurrentGraph });
    } catch {
      return undefined;
    }
  };

  const inputForSource = (source: ReplaySource, question?: string): Parameters<typeof replaySnapshot>[0] => {
    if (source.kind === 'last') return question ? { snapshot: source.snapshot, question } : { snapshot: source.snapshot };
    return question ? { snapshotId: source.snapshotId, question } : { snapshotId: source.snapshotId };
  };

  const showBlockedResult = (source: ReplaySource, result: Extract<ReplayResult, { ok: false }>): void => {
    updateState({
      block: {
        reason: result.blocked,
        source,
        detail: result.detail,
        preflight: result.preflight,
      },
      question: result.blocked === 'question-required' ? stateRef.current.question : '',
    });
  };

  const startReplay = async (source: ReplaySource, options: ReplayRunOptions = {}): Promise<ReplayResult | undefined> => {
    loginRequestGeneration.current += 1;
    const busyKey = sourceKey(source);
    const question = options.question?.trim();
    updateState({ busyKey, notice: undefined, block: undefined });

    let planned: ReplayPlan | undefined;
    let willRun = false;
    try {
      planned = await planReplayForSource(source, options);
      if (planned && !planned.blocked && (!planned.needsQuestion || question)) {
        willRun = true;
        props.onReplayWillRun?.({
          ...planned,
          question: planned.question ?? question,
        });
      }

      const result = await replaySnapshot(inputForSource(source, question), {
        replayWithCurrentGraph: options.replayWithCurrentGraph,
        onSnapshotComplete: props.onSnapshotComplete,
        locale,
        responseLanguagePolicy: props.responseLanguagePolicy,
        activeProviders: props.activeProviders,
      });

      if (result.ok) {
        if (!willRun) props.onReplayWillRun?.(result.plan);
        updateState({
          block: undefined,
          question: '',
          notice: {
            kind: 'ok',
            text: result.newSnapshotId
              ? formatI18n(translate('replay.completedWithSnapshot'), { snapshotId: result.newSnapshotId })
              : translate('replay.completed'),
          },
        });
        await refreshStoredSnapshots();
        return result;
      }

      showBlockedResult(source, result);
      return result;
    } catch (error) {
      updateState({
        notice: { kind: 'error', text: errorMessage(error) },
      });
      return undefined;
    } finally {
      updateState({ busyKey: undefined });
      props.onReplaySettled?.();
    }
  };

  const openProviderLogin = async (provider: AIProvider): Promise<void> => {
    if (loginInFlight.current || isInactiveStandby(provider)) return;
    loginInFlight.current = true;
    const generation = ++loginRequestGeneration.current;
    const block = stateRef.current.block;
    updateState({ notice: undefined });
    try {
      if (props.onOpenLogin) await props.onOpenLogin(provider);
      else await host.provider.openLogin(provider);
    } catch {
      if (generation !== loginRequestGeneration.current || stateRef.current.block !== block) return;
      updateState({
        notice: {
          kind: 'error',
          text: formatI18n(translate('provider.openFailed'), { provider: providerName(provider) }),
          retryLoginProvider: provider,
        },
      });
    } finally {
      loginInFlight.current = false;
    }
  };

  const openSettings = (): void => {
    loginRequestGeneration.current += 1;
    props.onOpenSettings?.();
  };

  const deleteStoredSnapshot = async (snapshotId: string): Promise<void> => {
    loginRequestGeneration.current += 1;
    const busyKey = `delete:${snapshotId}`;
    updateState({ busyKey, notice: undefined });
    try {
      await host.snapshot.delete(snapshotId);
      updateState({ notice: { kind: 'ok', text: translate('replay.snapshotDeleted') } });
      await refreshStoredSnapshots();
    } catch (error) {
      updateState({ notice: { kind: 'error', text: errorMessage(error) } });
    } finally {
      updateState({ busyKey: undefined });
    }
  };

  const submitQuestion = (event: FormEvent<HTMLFormElement>, block: ReplayBlockState): void => {
    event.preventDefault();
    const question = stateRef.current.question.trim();
    if (!question) return;
    void startReplay(block.source, { question });
  };

  const updateQuestion = (event: ChangeEvent<HTMLInputElement>): void => {
    updateState({ question: event.target.value });
  };

  useImperativeHandle(ref, () => ({ startReplay, refreshStoredSnapshots, deleteStoredSnapshot }));

  const renderBlock = (block: ReplayBlockState, question: string, busyKey: string | undefined) => {
    if (block.reason === 'question-required') {
      return (
        <section className="mt-3 border border-amber-300 dark:border-amber-900 bg-amber-50 dark:bg-amber-950 p-3 text-xs text-amber-800 dark:text-amber-100">
          <h4 className="font-semibold">{translate('replay.originalQuestionRequired')}</h4>
          <p className="mt-1 text-amber-800 dark:text-amber-200">
            {formatI18n(translate('replay.originalQuestionDescription'), { source: sourceLabel(block.source, locale) })}
          </p>
          <form className="mt-3 flex flex-col gap-2 sm:flex-row" onSubmit={(event) => submitQuestion(event, block)}>
            <input
              className="min-w-0 flex-1 border border-amber-300 dark:border-amber-800 bg-white dark:bg-zinc-950 px-2 py-1.5 text-zinc-900 dark:text-zinc-100"
              value={question}
              onChange={(event) => updateQuestion(event)}
              placeholder={translate('replay.originalQuestion')}
            />
            <Button
              type="submit"
              variant="primary"
              disabled={Boolean(busyKey) || question.trim().length === 0}
            >
              {translate('replay.replay')}
            </Button>
          </form>
        </section>
      );
    }

    if (block.reason === 'graph-version-mismatch') {
      const detail = versionMismatchDetail(block.detail);
      return (
        <section className="mt-3 border border-amber-300 dark:border-amber-900 bg-amber-50 dark:bg-amber-950 p-3 text-xs text-amber-800 dark:text-amber-100">
          <h4 className="font-semibold">{translate('replay.graphVersionChanged')}</h4>
          <p className="mt-1 text-amber-800 dark:text-amber-200">
            {formatI18n(translate('replay.graphVersionMismatch'), {
              snapshotVersion: detail.snapshotVersion,
              currentVersion: detail.currentVersion,
            })}
          </p>
          <Button
            variant="primary"
            className="mt-3"
            disabled={Boolean(busyKey)}
            onClick={() => void startReplay(block.source, { replayWithCurrentGraph: true })}
          >
            {translate('replay.replayWithCurrentGraph')}
          </Button>
        </section>
      );
    }

    if (block.reason === 'preflight') {
      const unavailable = block.preflight?.unavailable ?? [];
      const aliased = block.preflight?.aliased ?? [];
      const hasLoginUnavailable = unavailable.some((provider) => !isInactiveStandby(provider));
      return (
        <section className="mt-3 border border-amber-300 dark:border-amber-900 bg-amber-50 dark:bg-amber-950 p-3 text-xs text-amber-800 dark:text-amber-100">
          <h4 className="font-semibold">{translate('replay.cannotStartReplay')}</h4>
          {hasLoginUnavailable ? <p className="mt-1 text-amber-800 dark:text-amber-200">{translate('replay.preflightHelp')}</p> : null}
          {unavailable.length > 0 ? (
            <div className="mt-3 grid gap-2">
              {unavailable.map((provider) => {
                const standby = isInactiveStandby(provider);
                return (
                  <div key={provider} className="flex items-center justify-between gap-3 border border-amber-300 dark:border-amber-800 bg-white dark:bg-zinc-950 px-2 py-1.5">
                    <span>{providerName(provider)} {standby ? translate('settings.providerStandby') : translate('replay.unavailable')}</span>
                    {standby ? (
                      props.onOpenSettings ? (
                        <Button variant="primary" size="sm" onClick={() => openSettings()}>
                          {translate('settings.title')}
                        </Button>
                      ) : null
                    ) : (
                      <Button variant="primary" size="sm" onClick={() => void openProviderLogin(provider)}>
                        {translate('replay.openLogin')}
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          ) : null}
          {aliased.length > 0 ? <div className="mt-2 text-amber-800 dark:text-amber-200">{translate('replay.aliasedRoles')} {aliased.map(providerName).join(', ')}</div> : null}
        </section>
      );
    }

    if (block.reason === 'not-found') {
      return <div className="mt-3 border border-red-300 dark:border-red-900 bg-red-50 dark:bg-red-950 px-3 py-2 text-xs text-red-800 dark:text-red-200">{translate('replay.snapshotNotFound')}</div>;
    }

    if (block.reason === 'unknown-graph') {
      const detail = unknownGraphDetail(block.detail);
      return (
        <div className="mt-3 border border-red-300 dark:border-red-900 bg-red-50 dark:bg-red-950 px-3 py-2 text-xs text-red-800 dark:text-red-200">
          {translate('replay.snapshotGraphUnavailable')}{detail.graphId ? `: ${detail.graphId}` : ''}.
        </div>
      );
    }

    return (
      <div className="mt-3 border border-red-300 dark:border-red-900 bg-red-50 dark:bg-red-950 px-3 py-2 text-xs text-red-800 dark:text-red-200">
        {translate('replay.blocked')} {block.reason}.
      </div>
    );
  };

  const lastSnapshot = getLastSnapshot();
  const { storedSnapshots, loadingStored, listError, busyKey, block, question, notice } = state;
  const retryLoginProvider = notice?.retryLoginProvider;

  return (
    <section aria-label={translate('replay.snapshotReplay')} className="mt-4 border-t border-zinc-200 dark:border-zinc-800 pt-4">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{translate('replay.snapshotReplay')}</h3>
        <p className="mt-1 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
          {translate('replay.description')}
        </p>
      </div>

      <div className="grid gap-3">
        <section className="border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 p-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h4 className="text-xs font-semibold uppercase text-zinc-700 dark:text-zinc-300">{translate('replay.lastRun')}</h4>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                {lastSnapshot ? `${lastSnapshot.graphId} - ${localTime(lastSnapshot.createdAt, locale)}` : translate('replay.noInMemorySnapshot')}
              </p>
            </div>
            {lastSnapshot ? (
              <Button
                variant="primary"
                disabled={Boolean(busyKey)}
                onClick={() => void startReplay({ kind: 'last', snapshot: lastSnapshot })}
              >
                {translate('replay.lastRun')}
              </Button>
            ) : null}
          </div>
        </section>

        <section className="ui-panel p-3">
          <div className="mb-2 flex items-center justify-between gap-3">
            <div>
              <h4 className="text-xs font-semibold uppercase text-zinc-700 dark:text-zinc-300">{translate('replay.storedSnapshots')}</h4>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{translate('replay.durableSnapshotsOptIn')}</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              disabled={loadingStored || Boolean(busyKey)}
              onClick={() => void refreshStoredSnapshots()}
            >
              {translate('replay.refresh')}
            </Button>
          </div>

          {listError ? <div className="ui-banner-red mb-2 px-3 py-2 text-xs">{listError}</div> : null}

          {loadingStored ? <div className="text-xs text-zinc-500 dark:text-zinc-400">{translate('replay.loadingStoredSnapshots')}</div> : null}
          {!loadingStored && storedSnapshots.length === 0 ? (
            <div className="border border-dashed border-zinc-300 dark:border-zinc-700 px-3 py-2 text-xs text-zinc-500 dark:text-zinc-400">
              {translate('replay.noStoredSnapshots')}
            </div>
          ) : null}
          {!loadingStored && storedSnapshots.length > 0 ? (
            <div className="max-h-72 overflow-y-auto divide-y divide-zinc-200 dark:divide-zinc-800 border border-zinc-200 dark:border-zinc-800">
              {storedSnapshots.map((snapshot) => {
                const replaySource: ReplaySource = { kind: 'stored', snapshotId: snapshot.id, info: snapshot };
                return (
                  <div key={snapshot.id} className="grid gap-2 p-2 text-xs sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                    <div className="min-w-0">
                      <div className="truncate font-medium text-zinc-900 dark:text-zinc-100">{snapshot.graphId ?? translate('replay.unknownGraph')}</div>
                      <div className="truncate text-zinc-500 dark:text-zinc-400">{localTime(snapshot.createdAt, locale) ?? translate('replay.createdTimeUnknown')}</div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="primary"
                        size="sm"
                        disabled={Boolean(busyKey)}
                        onClick={() => void startReplay(replaySource)}
                      >
                        {translate('replay.replay')}
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        disabled={Boolean(busyKey)}
                        onClick={() => void deleteStoredSnapshot(snapshot.id)}
                      >
                        {translate('replay.delete')}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}
        </section>
      </div>

      {notice ? (
        <div role={notice.kind === 'error' ? 'alert' : undefined} className={`mt-3 border px-3 py-2 text-xs ${noticeClass(notice.kind)}`}>
          {notice.text}
          {retryLoginProvider && !isInactiveStandby(retryLoginProvider) ? (
            <Button
              variant="danger"
              size="sm"
              className="ml-3 font-medium"
              onClick={() => void openProviderLogin(retryLoginProvider)}
            >
              {translate('provider.retry')}
            </Button>
          ) : retryLoginProvider && props.onOpenSettings ? (
            <Button
              variant="danger"
              size="sm"
              className="ml-3 font-medium"
              onClick={() => openSettings()}
            >
              {translate('settings.title')}
            </Button>
          ) : null}
        </div>
      ) : null}
      {block ? renderBlock(block, question, busyKey) : null}
    </section>
  );
});

function sourceKey(source: ReplaySource): string {
  return source.kind === 'last' ? `last:${source.snapshot.snapshotId}` : `stored:${source.snapshotId}`;
}

function sourceLabel(source: ReplaySource, locale: Locale): string {
  return source.kind === 'last' ? t('replay.sourceLastRun', locale) : source.snapshotId;
}

// Snapshots are stored as UTC ISO strings; showing them raw makes every row read as a foreign
// clock. Fall back to the raw string when the value is missing or unparseable.
function localTime(value: string | undefined, locale: Locale): string | undefined {
  const parsed = Date.parse(value ?? '');
  if (!Number.isFinite(parsed)) return value;
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'medium' }).format(parsed);
}

function snapshotTime(snapshot: StoredSnapshotInfo): number {
  const value = Date.parse(snapshot.createdAt ?? '');
  return Number.isFinite(value) ? value : 0;
}

function providerName(provider: AIProvider): string {
  return AI_PROVIDERS[provider].name;
}

function noticeClass(kind: ReplayNotice['kind']): string {
  return kind === 'error' ? 'border-red-300 dark:border-red-900 bg-red-50 dark:bg-red-950 text-red-800 dark:text-red-200' : 'border-emerald-300 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-200';
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function versionMismatchDetail(detail: unknown): { snapshotVersion?: number; currentVersion?: number } {
  if (!isRecord(detail)) return {};
  return {
    snapshotVersion: typeof detail.snapshotVersion === 'number' ? detail.snapshotVersion : undefined,
    currentVersion: typeof detail.currentVersion === 'number' ? detail.currentVersion : undefined,
  };
}

function unknownGraphDetail(detail: unknown): { graphId?: string } {
  if (!isRecord(detail)) return {};
  return { graphId: typeof detail.graphId === 'string' ? detail.graphId : undefined };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}
