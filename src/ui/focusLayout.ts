import { DEFAULT_DOCK_CONSTRAINTS, clamp } from './dockLayout';

export const DEFAULT_FOCUS_PANE_WIDTH = 560;

export const NARROW_WINDOW_BREAKPOINT = 860;
export const NARROW_MIN_FOCUS_PANE_WIDTH = 320;
export const NARROW_MIN_CENTER_WIDTH = 280;
export const SESSION_SIDEBAR_AUTO_COLLAPSE_WIDTH = 560;

export interface FocusLayoutConstraints {
  minFocusPaneWidth: number;
  minCenterWidth: number;
  resizerWidth: number;
}

export const DEFAULT_FOCUS_LAYOUT_CONSTRAINTS: FocusLayoutConstraints = {
  minFocusPaneWidth: 420,
  minCenterWidth: DEFAULT_DOCK_CONSTRAINTS.minCenterWidth,
  resizerWidth: DEFAULT_DOCK_CONSTRAINTS.resizerWidth,
};

export function resolveFocusLayoutConstraints(
  containerWidth: number,
  base: FocusLayoutConstraints = DEFAULT_FOCUS_LAYOUT_CONSTRAINTS,
): FocusLayoutConstraints {
  // Below ~860px the window cannot afford the default 420px focus pane plus a
  // 360px transcript: relax both minima so the workspace never clips.
  if (containerWidth < NARROW_WINDOW_BREAKPOINT) {
    return {
      minFocusPaneWidth: NARROW_MIN_FOCUS_PANE_WIDTH,
      minCenterWidth: NARROW_MIN_CENTER_WIDTH,
      resizerWidth: base.resizerWidth,
    };
  }
  return { ...base };
}

export function shouldAutoCollapseSessionSidebar(focusPaneWidth: number): boolean {
  return focusPaneWidth < SESSION_SIDEBAR_AUTO_COLLAPSE_WIDTH;
}

export function clampFocusPaneWidth(
  width: number,
  containerWidth: number,
  constraints = DEFAULT_FOCUS_LAYOUT_CONSTRAINTS,
): number {
  const maxWidth = Math.max(
    constraints.minFocusPaneWidth,
    containerWidth - constraints.minCenterWidth - constraints.resizerWidth,
  );
  return clamp(Math.round(width), constraints.minFocusPaneWidth, maxWidth);
}

export function focusGridTemplateColumns(
  focusPaneWidth: number,
  constraints = DEFAULT_FOCUS_LAYOUT_CONSTRAINTS,
): string {
  return `${Math.round(focusPaneWidth)}px ${constraints.resizerWidth}px minmax(${constraints.minCenterWidth}px, 1fr)`;
}

export function dragFocusPaneWidth(startWidth: number, pointerDelta: number, minWidth: number, maxWidth: number): number {
  return clamp(Math.round(startWidth + pointerDelta), minWidth, maxWidth);
}

export function nonEmptyRect(rect: DOMRectReadOnly | null | undefined): DOMRectReadOnly | undefined {
  if (!rect || rect.width <= 0 || rect.height <= 0) return undefined;
  return rect;
}

export type CenterStagePresentationState = 'chip' | 'side' | 'center';
export type CenterStageWebviewState = 'none' | 'creating' | 'loaded';

export function throttleWithFrame(fn: () => void, scheduleFrame?: (cb: () => void) => number): () => void {
  let scheduled = false;
  const executor = () => {
    scheduled = false;
    fn();
  };

  return () => {
    if (scheduled) return;
    scheduled = true;
    // Resolved lazily (only once the returned handler actually fires) so constructing
    // this wrapper during SSR/tests, where requestAnimationFrame is undefined, is safe.
    const schedule = scheduleFrame ?? requestAnimationFrame;
    schedule(executor);
  };
}

export async function driveCenteredProviderToStage<TProvider extends string>({
  provider,
  presentation,
  webview,
  bounds,
  setBounds,
}: {
  provider: TProvider;
  presentation: CenterStagePresentationState;
  webview: CenterStageWebviewState;
  bounds: DOMRectReadOnly | null | undefined;
  setBounds: (provider: TProvider, bounds: DOMRectReadOnly) => Promise<unknown>;
}): Promise<void> {
  const rect = nonEmptyRect(bounds);
  if (presentation !== 'center' || webview !== 'loaded' || !rect) return;
  await setBounds(provider, rect);
}
