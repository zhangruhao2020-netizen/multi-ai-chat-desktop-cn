import { isValidElement, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ReplayPanel is a function component now (L5); the tests call it directly and
// drive state through a stub hook runtime, following InputBar.test.tsx.
// forwardRef is stubbed to the identity so the component can be invoked as a
// plain function, and useImperativeHandle assigns the handle to the given ref.
const hookRuntime = vi.hoisted(() => {
  let cursor = 0;
  let rerender = () => {};
  const initialized: boolean[] = [];
  const values: unknown[] = [];

  return {
    reset() {
      cursor = 0;
      rerender = () => {};
      initialized.length = 0;
      values.length = 0;
    },
    begin(nextRerender: () => void) {
      cursor = 0;
      rerender = nextRerender;
    },
    useState(initial: unknown) {
      const index = cursor;
      cursor += 1;
      if (!initialized[index]) {
        values[index] = typeof initial === 'function' ? (initial as () => unknown)() : initial;
        initialized[index] = true;
      }
      const setState = (next: unknown) => {
        values[index] = typeof next === 'function' ? (next as (current: unknown) => unknown)(values[index]) : next;
        rerender();
      };
      return [values[index], setState];
    },
    useRef(initial: unknown) {
      const index = cursor;
      cursor += 1;
      if (!initialized[index]) {
        values[index] = { current: initial };
        initialized[index] = true;
      }
      return values[index];
    },
    useEffect() {
      cursor += 1;
    },
    useCallback(fn: unknown) {
      cursor += 1;
      return fn;
    },
    useMemo(fn: () => unknown) {
      const index = cursor;
      cursor += 1;
      if (!initialized[index]) {
        values[index] = fn();
        initialized[index] = true;
      }
      return values[index];
    },
    useContext() {
      cursor += 1;
      return {};
    },
  };
});

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();
  return {
    ...actual,
    useEffect: hookRuntime.useEffect,
    useRef: hookRuntime.useRef,
    useState: hookRuntime.useState,
    useCallback: hookRuntime.useCallback,
    useMemo: hookRuntime.useMemo,
    useContext: hookRuntime.useContext,
    forwardRef: (render: unknown) => render,
    useImperativeHandle: (ref: { current: unknown } | null | undefined, factory: () => unknown) => {
      if (ref && typeof ref === 'object') ref.current = factory();
    },
  };
});

import type { AIProvider } from '../../shared/types';
import { host } from '../host';
import { t } from '../i18n/t';
import { Button } from '../ui/Button';
import { ReplayPanel, type ReplayPanelHandle, type ReplayPanelProps } from '../ui/ReplayPanel';
import { getLastSnapshot } from '../workflow/snapshot/recorder';
import { replaySnapshot } from '../workflow/snapshot/replay';
import type { ExecutionSnapshot, RedactedValueRef } from '../workflow/snapshot/types';

vi.mock('../host', () => ({
  host: {
    provider: {
      openLogin: vi.fn(),
    },
    snapshot: {
      list: vi.fn(),
      load: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

vi.mock('../workflow/snapshot/recorder', () => ({
  getLastSnapshot: vi.fn(),
}));

vi.mock('../workflow/snapshot/replay', () => ({
  parseStoredSnapshot: vi.fn((json: string) => JSON.parse(json)),
  planReplay: vi.fn(() => undefined),
  replaySnapshot: vi.fn(),
}));

interface ElementProps {
  children?: ReactNode;
  disabled?: boolean;
  onClick?: () => void;
  onSubmit?: (event: { preventDefault: () => void }) => void;
  onChange?: (event: { target: { value: string } }) => void;
  placeholder?: string;
}

interface Renderer {
  props: ReplayPanelProps;
  tree: ReactElement;
  handle: ReplayPanelHandle;
  render(): void;
  update(props: Partial<ReplayPanelProps>): void;
}

function propsOf(element: ReactElement): ElementProps {
  return element.props as ElementProps;
}

function textOf(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textOf).join('');
  if (isValidElement(node)) return textOf(propsOf(node).children);
  return '';
}

function findAllElements(node: ReactNode, predicate: (element: ReactElement) => boolean): ReactElement[] {
  if (Array.isArray(node)) return node.flatMap((child) => findAllElements(child, predicate));
  if (!isValidElement(node)) return [];

  const matches = predicate(node) ? [node] : [];
  return [...matches, ...findAllElements(propsOf(node).children, predicate)];
}

function firstElement(node: ReactNode, predicate: (element: ReactElement) => boolean): ReactElement {
  const match = findAllElements(node, predicate)[0];
  if (!match) throw new Error('Expected element was not found');
  return match;
}

function isButtonElement(element: ReactElement): boolean {
  return element.type === 'button' || element.type === Button;
}

function buttonWithText(node: ReactNode, text: string): ReactElement {
  return firstElement(node, (element) => isButtonElement(element) && textOf(element).includes(text));
}

function renderPanel(overrides: Partial<ReplayPanelProps> = {}): Renderer {
  hookRuntime.reset();
  const ref: { current: ReplayPanelHandle | null } = { current: null };
  const renderer: Renderer = {
    props: { locale: 'en', ...overrides },
    tree: undefined as unknown as ReactElement,
    handle: undefined as unknown as ReplayPanelHandle,
    render() {
      hookRuntime.begin(() => renderer.render());
      const renderFn = ReplayPanel as unknown as (
        props: ReplayPanelProps,
        ref: { current: ReplayPanelHandle | null },
      ) => ReactElement;
      renderer.tree = renderFn(renderer.props, ref);
      if (ref.current) renderer.handle = ref.current;
    },
    update(props) {
      renderer.props = { ...renderer.props, ...props };
      renderer.render();
    },
  };
  renderer.render();
  return renderer;
}

describe('ReplayPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getLastSnapshot).mockReturnValue(undefined);
    vi.mocked(host.snapshot.list).mockResolvedValue([]);
    vi.mocked(host.snapshot.load).mockResolvedValue(null);
    vi.mocked(host.snapshot.delete).mockResolvedValue(undefined);
    vi.mocked(host.provider.openLogin).mockResolvedValue(undefined);
    vi.mocked(replaySnapshot).mockResolvedValue({
      ok: true,
      plan: {
        roles: {},
        needsQuestion: false,
        textComparable: true,
      },
    });
  });

  it('renders Replay last run when a last snapshot exists and replays the in-memory snapshot', async () => {
    const snapshot = buildSnapshot({ snapshotId: 'snapshot-last' });
    vi.mocked(getLastSnapshot).mockReturnValue(snapshot);
    const renderer = renderPanel({});

    expect(renderToStaticMarkup(renderer.tree)).toContain(t('replay.lastRun', 'en'));

    propsOf(buttonWithText(renderer.tree, t('replay.lastRun', 'en'))).onClick?.();

    await vi.waitFor(() =>
      expect(replaySnapshot).toHaveBeenCalledWith(
        { snapshot },
        { replayWithCurrentGraph: undefined, onSnapshotComplete: undefined, locale: 'en', responseLanguagePolicy: undefined },
      ),
    );
  });

  it('renders stored snapshots newest first and wires replay and delete actions', async () => {
    vi.mocked(host.snapshot.list).mockResolvedValue([
      { id: 'snapshot-old', graphId: 'free', createdAt: '2026-07-05T00:00:00.000Z' },
      { id: 'snapshot-new', graphId: 'debate', createdAt: '2026-07-06T00:00:00.000Z' },
    ]);
    const renderer = renderPanel({});

    await renderer.handle.refreshStoredSnapshots();
    const html = renderToStaticMarkup(renderer.tree);

    expect(html.indexOf('snapshot-new')).toBe(-1);
    expect(html.indexOf('debate')).toBeLessThan(html.indexOf('free'));

    propsOf(buttonWithText(renderer.tree, t('replay.replay', 'en'))).onClick?.();
    await vi.waitFor(() =>
      expect(replaySnapshot).toHaveBeenCalledWith(
        { snapshotId: 'snapshot-new' },
        { replayWithCurrentGraph: undefined, onSnapshotComplete: undefined, locale: 'en', responseLanguagePolicy: undefined },
      ),
    );

    propsOf(buttonWithText(renderer.tree, t('replay.delete', 'en'))).onClick?.();
    await vi.waitFor(() => expect(host.snapshot.delete).toHaveBeenCalledWith('snapshot-new'));
  });

  it('asks for the original question and re-invokes replay with the supplied question', async () => {
    const snapshot = buildSnapshot();
    vi.mocked(getLastSnapshot).mockReturnValue(snapshot);
    vi.mocked(replaySnapshot)
      .mockResolvedValueOnce({ ok: false, blocked: 'question-required' })
      .mockResolvedValueOnce({
        ok: true,
        plan: {
          roles: {},
          needsQuestion: true,
          textComparable: false,
          question: 'original question',
        },
      });
    const renderer = renderPanel({});

    propsOf(buttonWithText(renderer.tree, t('replay.lastRun', 'en'))).onClick?.();
    await vi.waitFor(() => expect(replaySnapshot).toHaveBeenCalledTimes(1));

    const blockedTree = renderer.tree;
    expect(renderToStaticMarkup(blockedTree)).toContain(t('replay.originalQuestionRequired', 'en'));
    propsOf(firstElement(blockedTree, (element) => element.type === 'input' && propsOf(element).placeholder === t('replay.originalQuestion', 'en'))).onChange?.({
      target: { value: 'original question' },
    });
    propsOf(firstElement(renderer.tree, (element) => element.type === 'form')).onSubmit?.({ preventDefault: vi.fn() });

    await vi.waitFor(() =>
      expect(replaySnapshot).toHaveBeenLastCalledWith(
        { snapshot, question: 'original question' },
        { replayWithCurrentGraph: undefined, onSnapshotComplete: undefined, locale: 'en', responseLanguagePolicy: undefined },
      ),
    );
  });

  it('confirms graph version mismatches before replaying with the current graph', async () => {
    const snapshot = buildSnapshot({ graphVersion: 1 });
    vi.mocked(getLastSnapshot).mockReturnValue(snapshot);
    vi.mocked(replaySnapshot)
      .mockResolvedValueOnce({
        ok: false,
        blocked: 'graph-version-mismatch',
        detail: { snapshotVersion: 1, currentVersion: 2 },
      })
      .mockResolvedValueOnce({
        ok: true,
        plan: {
          roles: {},
          needsQuestion: false,
          textComparable: true,
        },
      });
    const renderer = renderPanel({});

    propsOf(buttonWithText(renderer.tree, t('replay.lastRun', 'en'))).onClick?.();
    await vi.waitFor(() => expect(replaySnapshot).toHaveBeenCalledTimes(1));

    const blockedTree = renderer.tree;
    expect(renderToStaticMarkup(blockedTree)).toContain(t('replay.graphVersionChanged', 'en'));
    propsOf(buttonWithText(blockedTree, t('replay.replayWithCurrentGraph', 'en'))).onClick?.();

    await vi.waitFor(() =>
      expect(replaySnapshot).toHaveBeenLastCalledWith(
        { snapshot },
        { replayWithCurrentGraph: true, onSnapshotComplete: undefined, locale: 'en', responseLanguagePolicy: undefined },
      ),
    );
  });

  it('shows preflight unavailable providers and does not re-invoke replay', async () => {
    const snapshot = buildSnapshot();
    vi.mocked(getLastSnapshot).mockReturnValue(snapshot);
    vi.mocked(replaySnapshot).mockResolvedValueOnce({
      ok: false,
      blocked: 'preflight',
      preflight: { ok: false, unavailable: ['claude', 'gemini'], aliased: [] },
    });
    const onOpenLogin = vi.fn().mockResolvedValue(undefined);
    const renderer = renderPanel({ onOpenLogin });

    propsOf(buttonWithText(renderer.tree, t('replay.lastRun', 'en'))).onClick?.();
    await vi.waitFor(() => expect(replaySnapshot).toHaveBeenCalledTimes(1));

    const html = renderToStaticMarkup(renderer.tree);
    expect(html).toContain(t('replay.cannotStartReplay', 'en'));
    expect(html).toContain(`Claude ${t('replay.unavailable', 'en')}`);
    expect(html).toContain(`Gemini ${t('replay.unavailable', 'en')}`);
    expect(replaySnapshot).toHaveBeenCalledTimes(1);

    propsOf(buttonWithText(renderer.tree, t('replay.openLogin', 'en'))).onClick?.();
    expect(onOpenLogin).toHaveBeenCalledWith('claude');
    expect(host.provider.openLogin).not.toHaveBeenCalled();
  });

  it.each(['host', 'callback', 'sync-callback'] as const)('shows a retryable login error via %s without restarting replay', async (path) => {
    vi.mocked(replaySnapshot).mockResolvedValueOnce({
      ok: false, blocked: 'preflight',
      preflight: { ok: false, unavailable: ['meta'], aliased: [] },
    });
    const onOpenLogin = vi.fn().mockResolvedValue(undefined);
    const login = path === 'host' ? vi.mocked(host.provider.openLogin) : onOpenLogin;
    login.mockImplementationOnce(() => {
      const error = new Error('login rejected by host');
      if (path === 'sync-callback') throw error;
      return Promise.reject(error);
    });
    const renderer = renderPanel({
      activeProviders: ['chatgpt', 'claude', 'gemini', 'meta'],
      onOpenLogin: path === 'host' ? undefined : onOpenLogin,
    });
    await renderer.handle.startReplay({ kind: 'last', snapshot: buildSnapshot() });

    expect(() => propsOf(buttonWithText(renderer.tree, t('replay.openLogin', 'en'))).onClick?.()).not.toThrow();
    await vi.waitFor(() => expect(renderToStaticMarkup(renderer.tree).includes('role="alert"')).toBe(true));
    expect(renderToStaticMarkup(renderer.tree)).toContain('Couldn&#x27;t open Meta AI. Please try again.');
    propsOf(buttonWithText(renderer.tree, t('provider.retry', 'en'))).onClick?.();
    await vi.waitFor(() => expect(login.mock.calls).toEqual([['meta'], ['meta']]));
    expect(path === 'host' ? onOpenLogin : host.provider.openLogin).not.toHaveBeenCalled();
    expect(replaySnapshot).toHaveBeenCalledTimes(1);
    expect(renderToStaticMarkup(renderer.tree)).toContain(t('replay.cannotStartReplay', 'en'));
    expect(renderToStaticMarkup(renderer.tree)).not.toContain('role="alert"');
  });

  it.each(['host', 'callback'] as const)('ignores duplicate Open Login and Retry clicks while %s login is pending', async (path) => {
    vi.mocked(replaySnapshot).mockResolvedValueOnce({
      ok: false, blocked: 'preflight',
      preflight: { ok: false, unavailable: ['meta'], aliased: [] },
    });
    let rejectFirst!: (reason: Error) => void;
    const first = new Promise<void>((_, reject) => { rejectFirst = reject; });
    let resolveRetry!: () => void;
    const retry = new Promise<void>((resolve) => { resolveRetry = resolve; });
    const onOpenLogin = vi.fn().mockResolvedValue(undefined);
    const login = path === 'host' ? vi.mocked(host.provider.openLogin) : onOpenLogin;
    login.mockReturnValueOnce(first).mockReturnValueOnce(retry);
    const renderer = renderPanel({ onOpenLogin: path === 'host' ? undefined : onOpenLogin });
    await renderer.handle.startReplay({ kind: 'last', snapshot: buildSnapshot() });
    const openClick = propsOf(buttonWithText(renderer.tree, t('replay.openLogin', 'en'))).onClick!;

    openClick();
    openClick();
    expect(login).toHaveBeenCalledTimes(1);
    rejectFirst(new Error('login unavailable'));
    await vi.waitFor(() => expect(renderToStaticMarkup(renderer.tree).includes('role="alert"')).toBe(true));
    const retryClick = propsOf(buttonWithText(renderer.tree, t('provider.retry', 'en'))).onClick!;
    retryClick();
    retryClick();
    openClick();
    expect(login.mock.calls).toEqual([['meta'], ['meta']]);

    resolveRetry();
    await retry;
    openClick();
    expect(login.mock.calls).toEqual([['meta'], ['meta'], ['meta']]);
    expect(replaySnapshot).toHaveBeenCalledTimes(1);
    expect(path === 'host' ? onOpenLogin : host.provider.openLogin).not.toHaveBeenCalled();
    expect(renderToStaticMarkup(renderer.tree)).not.toContain('role="alert"');
  });

  it('keeps a stale Login request guarded until it settles, then allows a new Login', async () => {
    vi.mocked(replaySnapshot).mockResolvedValue({
      ok: false, blocked: 'preflight',
      preflight: { ok: false, unavailable: ['meta'], aliased: [] },
    });
    let reject!: (reason: Error) => void;
    const pending = new Promise<void>((_, fail) => { reject = fail; });
    const onOpenLogin = vi.fn().mockResolvedValue(undefined).mockReturnValueOnce(pending);
    const renderer = renderPanel({ onOpenLogin });
    const source = { kind: 'last' as const, snapshot: buildSnapshot() };
    await renderer.handle.startReplay(source);
    propsOf(buttonWithText(renderer.tree, t('replay.openLogin', 'en'))).onClick?.();
    await renderer.handle.startReplay(source);
    const openClick = propsOf(buttonWithText(renderer.tree, t('replay.openLogin', 'en'))).onClick!;
    openClick();
    expect(onOpenLogin).toHaveBeenCalledTimes(1);

    reject(new Error('stale login rejection'));
    await pending.catch(() => undefined);
    expect(renderToStaticMarkup(renderer.tree)).not.toContain('role="alert"');
    openClick();
    expect(onOpenLogin.mock.calls).toEqual([['meta'], ['meta']]);
    expect(replaySnapshot).toHaveBeenCalledTimes(2);
  });

  it('removes Login retry when that provider becomes standby and guards an old retry click', async () => {
    vi.mocked(replaySnapshot).mockResolvedValueOnce({
      ok: false, blocked: 'preflight',
      preflight: { ok: false, unavailable: ['meta'], aliased: [] },
    });
    vi.mocked(host.provider.openLogin).mockRejectedValueOnce(new Error('login unavailable'));
    const activeProviders: AIProvider[] = ['chatgpt', 'claude', 'gemini', 'meta'];
    const renderer = renderPanel({ activeProviders });
    await renderer.handle.startReplay({ kind: 'last', snapshot: buildSnapshot() });
    propsOf(buttonWithText(renderer.tree, t('replay.openLogin', 'en'))).onClick?.();
    await vi.waitFor(() => expect(renderToStaticMarkup(renderer.tree).includes('role="alert"')).toBe(true));
    const oldRetry = buttonWithText(renderer.tree, t('provider.retry', 'en'));

    activeProviders.splice(activeProviders.indexOf('meta'), 1, 'grok');
    renderer.render();
    expect(findAllElements(renderer.tree, (element) => isButtonElement(element)
      && textOf(element).includes(t('provider.retry', 'en')))).toHaveLength(0);
    propsOf(oldRetry).onClick?.();
    await Promise.resolve();
    expect(host.provider.openLogin).toHaveBeenCalledTimes(1);
    expect(replaySnapshot).toHaveBeenCalledTimes(1);
  });

  it.each(['replay', 'delete'] as const)('does not replace a newer %s result with an old Login rejection', async (action) => {
    vi.mocked(replaySnapshot).mockResolvedValueOnce({
      ok: false, blocked: 'preflight',
      preflight: { ok: false, unavailable: ['meta'], aliased: [] },
    });
    let reject!: (reason: Error) => void;
    const pending = new Promise<void>((_, fail) => { reject = fail; });
    const onOpenLogin = vi.fn().mockReturnValue(pending);
    const renderer = renderPanel({ onOpenLogin });
    const source = { kind: 'last' as const, snapshot: buildSnapshot() };
    await renderer.handle.startReplay(source);
    propsOf(buttonWithText(renderer.tree, t('replay.openLogin', 'en'))).onClick?.();
    if (action === 'replay') await renderer.handle.startReplay(source);
    else await renderer.handle.deleteStoredSnapshot('snapshot-old');
    reject(new Error('late Login rejection'));
    await pending.catch(() => undefined);
    await Promise.resolve();

    const html = renderToStaticMarkup(renderer.tree);
    expect(html).not.toContain('role="alert"');
    expect(html).toContain(action === 'replay' ? t('replay.completed', 'en') : t('replay.snapshotDeleted', 'en'));
    if (action === 'replay') expect(html).not.toContain(t('replay.cannotStartReplay', 'en'));
  });

  it('does not offer login for an unavailable standby provider', async () => {
    const snapshot = buildSnapshot();
    vi.mocked(getLastSnapshot).mockReturnValue(snapshot);
    vi.mocked(replaySnapshot).mockResolvedValueOnce({
      ok: false, blocked: 'preflight',
      preflight: { ok: false, unavailable: ['meta'], aliased: [] },
    });
    const onOpenLogin = vi.fn().mockResolvedValue(undefined);
    const renderer = renderPanel({
      activeProviders: ['chatgpt', 'claude', 'gemini', 'grok'],
      onOpenLogin,
    });

    propsOf(buttonWithText(renderer.tree, t('replay.lastRun', 'en'))).onClick?.();
    await vi.waitFor(() => expect(replaySnapshot).toHaveBeenCalledTimes(1));

    const tree = renderer.tree;
    const html = renderToStaticMarkup(tree);
    expect(html).toContain(`Meta AI ${t('settings.providerStandby', 'en')}`);
    expect(html).not.toContain(t('replay.preflightHelp', 'en'));
    expect(findAllElements(
      tree,
      (element) => isButtonElement(element) && textOf(element).includes(t('replay.openLogin', 'en')),
    )).toHaveLength(0);
    expect(findAllElements(
      tree,
      (element) => isButtonElement(element) && textOf(element).includes(t('settings.title', 'en')),
    )).toHaveLength(0);
    expect(onOpenLogin).not.toHaveBeenCalled();
    expect(host.provider.openLogin).not.toHaveBeenCalled();
  });

  it('offers Settings instead of login when a required snapshot provider is standby', async () => {
    vi.mocked(replaySnapshot).mockResolvedValueOnce({
      ok: false, blocked: 'preflight',
      preflight: { ok: false, unavailable: ['claude', 'meta'], aliased: [] },
    });
    const onOpenLogin = vi.fn().mockResolvedValue(undefined);
    const onOpenSettings = vi.fn();
    const renderer = renderPanel({
      activeProviders: ['chatgpt', 'claude', 'gemini', 'grok'],
      onOpenLogin,
      onOpenSettings,
    });
    await renderer.handle.startReplay({ kind: 'last', snapshot: buildSnapshot() });

    const tree = renderer.tree;
    const html = renderToStaticMarkup(tree);
    expect(html).toContain(`Claude ${t('replay.unavailable', 'en')}`);
    expect(html).toContain(`Meta AI ${t('settings.providerStandby', 'en')}`);
    expect(html).toContain(t('replay.preflightHelp', 'en'));
    expect(findAllElements(
      tree,
      (element) => isButtonElement(element) && textOf(element).includes(t('replay.openLogin', 'en')),
    )).toHaveLength(1);
    propsOf(buttonWithText(tree, t('settings.title', 'en'))).onClick?.();
    expect(onOpenSettings).toHaveBeenCalledTimes(1);
    expect(onOpenLogin).not.toHaveBeenCalled();
    expect(host.provider.openLogin).not.toHaveBeenCalled();
  });

  it('replaces login retry with Settings after that provider becomes standby', async () => {
    vi.mocked(replaySnapshot).mockResolvedValueOnce({
      ok: false, blocked: 'preflight',
      preflight: { ok: false, unavailable: ['meta'], aliased: [] },
    });
    vi.mocked(host.provider.openLogin).mockRejectedValueOnce(new Error('login unavailable'));
    const onOpenSettings = vi.fn();
    const activeProviders: AIProvider[] = ['chatgpt', 'claude', 'gemini', 'meta'];
    const renderer = renderPanel({ activeProviders, onOpenSettings });
    await renderer.handle.startReplay({ kind: 'last', snapshot: buildSnapshot() });
    propsOf(buttonWithText(renderer.tree, t('replay.openLogin', 'en'))).onClick?.();
    await vi.waitFor(() => expect(renderToStaticMarkup(renderer.tree).includes('role="alert"')).toBe(true));
    const oldRetry = buttonWithText(renderer.tree, t('provider.retry', 'en'));

    activeProviders.splice(activeProviders.indexOf('meta'), 1, 'grok');
    renderer.render();
    expect(findAllElements(renderer.tree, (element) => isButtonElement(element)
      && textOf(element).includes(t('provider.retry', 'en')))).toHaveLength(0);
    propsOf(oldRetry).onClick?.();
    await Promise.resolve();
    expect(host.provider.openLogin).toHaveBeenCalledTimes(1);
    propsOf(buttonWithText(renderer.tree, t('settings.title', 'en'))).onClick?.();
    expect(onOpenSettings).toHaveBeenCalledTimes(1);
  });

  it('shows missing snapshots as a small error line', async () => {
    const snapshot = buildSnapshot();
    vi.mocked(getLastSnapshot).mockReturnValue(snapshot);
    vi.mocked(replaySnapshot).mockResolvedValueOnce({ ok: false, blocked: 'not-found' });
    const renderer = renderPanel({});

    propsOf(buttonWithText(renderer.tree, t('replay.lastRun', 'en'))).onClick?.();
    await vi.waitFor(() => expect(replaySnapshot).toHaveBeenCalledTimes(1));

    expect(renderToStaticMarkup(renderer.tree)).toContain(t('replay.snapshotNotFound', 'en'));
  });
});

function buildSnapshot(overrides: Partial<ExecutionSnapshot> = {}): ExecutionSnapshot {
  return {
    snapshotId: 'snapshot-source',
    graphId: 'debate',
    graphVersion: 2,
    appVersion: '0.0.0-test',
    createdAt: '2026-07-06T00:00:00.000Z',
    completedAt: '2026-07-06T00:01:00.000Z',
    adapterVersions: {},
    roleMap: { pro: 'chatgpt', con: 'claude', judge: 'grok', summary: 'gemini' },
    redactionTier: 'full-local',
    userQuestion: inlineRef('clean replay question'),
    steps: [],
    humanEdits: [],
    ...overrides,
  };
}

function inlineRef(text: string): RedactedValueRef {
  return {
    tier: 'full-local',
    kind: 'inline',
    text,
    byteLength: new TextEncoder().encode(text).byteLength,
  };
}
