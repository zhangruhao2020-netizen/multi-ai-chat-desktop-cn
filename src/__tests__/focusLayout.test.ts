import { describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_FOCUS_LAYOUT_CONSTRAINTS,
  DEFAULT_FOCUS_PANE_WIDTH,
  NARROW_MIN_CENTER_WIDTH,
  NARROW_MIN_FOCUS_PANE_WIDTH,
  NARROW_WINDOW_BREAKPOINT,
  SESSION_SIDEBAR_AUTO_COLLAPSE_WIDTH,
  clampFocusPaneWidth,
  dragFocusPaneWidth,
  driveCenteredProviderToStage,
  focusGridTemplateColumns,
  nonEmptyRect,
  resolveFocusLayoutConstraints,
  shouldAutoCollapseSessionSidebar,
  throttleWithFrame,
} from '../ui/focusLayout';
import { applyPresentationTransitionCommand, waitForPresentationTargetBounds, type PresentationCommandHost } from '../ui/presentationCommands';
import { DEFAULT_FONT_SIZE, MAX_FONT_SIZE, MIN_FONT_SIZE, normalizeSettings } from '../ui/settingsModel';

function rect(width: number, height: number): DOMRectReadOnly {
  return { x: 10, y: 20, width, height, top: 20, left: 10, right: 10 + width, bottom: 20 + height, toJSON: () => ({}) };
}

function commandHost(): PresentationCommandHost {
  return {
    close: vi.fn().mockResolvedValue(undefined),
    hide: vi.fn().mockResolvedValue(undefined),
    open: vi.fn().mockResolvedValue(undefined),
    setBounds: vi.fn().mockResolvedValue(undefined),
    show: vi.fn().mockResolvedValue(undefined),
  };
}

describe('focus layout helpers', () => {
  it('clamps focus pane width while preserving control-pane minimum space', () => {
    expect(clampFocusPaneWidth(100, 1400)).toBe(420);
    expect(clampFocusPaneWidth(620.4, 1400)).toBe(620);
    expect(clampFocusPaneWidth(1200, 1000)).toBe(634);
    expect(clampFocusPaneWidth(900, 700)).toBe(420);
  });

  it('emits the focus two-pane grid template string', () => {
    expect(focusGridTemplateColumns(620)).toBe('620px 6px minmax(360px, 1fr)');
    expect(focusGridTemplateColumns(620.6)).toBe('621px 6px minmax(360px, 1fr)');
  });

  it('clamps dragged focus pane width', () => {
    expect(dragFocusPaneWidth(620, -500, 420, 900)).toBe(420);
    expect(dragFocusPaneWidth(620, 500, 420, 900)).toBe(900);
    expect(dragFocusPaneWidth(620, 25, 420, 900)).toBe(645);
  });

  it('filters zero-area rectangles until layout has real bounds', () => {
    const zero = rect(0, 0);
    const zeroWidth = rect(0, 320);
    const zeroHeight = rect(420, 0);
    const real = rect(420, 320);

    expect(nonEmptyRect(null)).toBeUndefined();
    expect(nonEmptyRect(undefined)).toBeUndefined();
    expect(nonEmptyRect(zero)).toBeUndefined();
    expect(nonEmptyRect(zeroWidth)).toBeUndefined();
    expect(nonEmptyRect(zeroHeight)).toBeUndefined();
    expect(nonEmptyRect(real)).toBe(real);
  });

  it('waits past a first-boot 0x0 center rect before opening the provider', async () => {
    const host = commandHost();
    const zero = rect(0, 0);
    const real = rect(760, 440);
    const reads = [zero, real];

    const bounds = await waitForPresentationTargetBounds({
      getBounds: () => nonEmptyRect(reads.shift()),
      waitFrame: async () => {},
    });

    if (bounds) {
      await applyPresentationTransitionCommand({
        host,
        provider: 'grok',
        state: 'center',
        bounds,
        webview: 'none',
      });
    }

    expect(host.open).toHaveBeenCalledWith('grok', real);
    expect(host.open).not.toHaveBeenCalledWith('grok', zero);
    expect(host.setBounds).not.toHaveBeenCalledWith('grok', zero);
  });

  it('drives center-stage resize recovery with loaded-only setBounds and no provider open', async () => {
    const host = commandHost();
    const zero = rect(0, 0);
    const real = rect(760, 440);

    for (const webview of ['none', 'creating', 'loaded'] as const) {
      await driveCenteredProviderToStage({
        provider: 'grok',
        presentation: 'center',
        webview,
        bounds: real,
        setBounds: host.setBounds,
      });
    }

    await driveCenteredProviderToStage({
      provider: 'grok',
      presentation: 'center',
      webview: 'loaded',
      bounds: zero,
      setBounds: host.setBounds,
    });
    await driveCenteredProviderToStage({
      provider: 'grok',
      presentation: 'side',
      webview: 'loaded',
      bounds: real,
      setBounds: host.setBounds,
    });

    expect(host.setBounds).toHaveBeenCalledTimes(1);
    expect(host.setBounds).toHaveBeenCalledWith('grok', real);
    expect(host.setBounds).not.toHaveBeenCalledWith('grok', zero);
    expect(host.open).not.toHaveBeenCalled();
  });

  it('normalizes focus settings and migrates width from legacy left column', () => {
    expect(normalizeSettings({}).focusPaneWidth).toBe(DEFAULT_FOCUS_PANE_WIDTH);
    expect(normalizeSettings({ layoutMode: 'quadrant', focusPaneWidth: 700 }).layoutMode).toBe('focus');
    expect(normalizeSettings({ focusPaneWidth: 250 }).focusPaneWidth).toBe(420);
    expect(normalizeSettings({ columnWidths: { left: 500, right: 320 } }).focusPaneWidth).toBe(500);
  });

  it('relaxes the focus pane and transcript minima below the narrow-window breakpoint', () => {
    expect(NARROW_WINDOW_BREAKPOINT).toBe(860);
    const narrow = resolveFocusLayoutConstraints(700);
    expect(narrow.minFocusPaneWidth).toBe(NARROW_MIN_FOCUS_PANE_WIDTH);
    expect(narrow.minFocusPaneWidth).toBe(320);
    expect(narrow.minCenterWidth).toBe(NARROW_MIN_CENTER_WIDTH);
    expect(narrow.minCenterWidth).toBe(280);
    expect(narrow.resizerWidth).toBe(DEFAULT_FOCUS_LAYOUT_CONSTRAINTS.resizerWidth);

    // At the breakpoint and above the default minima still apply.
    expect(resolveFocusLayoutConstraints(860)).toEqual(DEFAULT_FOCUS_LAYOUT_CONSTRAINTS);
    expect(resolveFocusLayoutConstraints(1400)).toEqual(DEFAULT_FOCUS_LAYOUT_CONSTRAINTS);
  });

  it('keeps a 640px window usable: narrow pane plus narrow transcript fit', () => {
    const constraints = resolveFocusLayoutConstraints(640);
    const total = constraints.minFocusPaneWidth + constraints.resizerWidth + constraints.minCenterWidth;
    expect(total).toBeLessThanOrEqual(640);
    expect(focusGridTemplateColumns(320, constraints)).toBe('320px 6px minmax(280px, 1fr)');
    expect(clampFocusPaneWidth(560, 640, constraints)).toBe(354);
  });

  it('auto-collapses the session sidebar when the left column drops below ~560px', () => {
    expect(SESSION_SIDEBAR_AUTO_COLLAPSE_WIDTH).toBe(560);
    expect(shouldAutoCollapseSessionSidebar(559)).toBe(true);
    expect(shouldAutoCollapseSessionSidebar(420)).toBe(true);
    expect(shouldAutoCollapseSessionSidebar(560)).toBe(false);
    expect(shouldAutoCollapseSessionSidebar(620)).toBe(false);
  });

  it('collapses bursts of scroll-driven bounds syncs into one call per frame', () => {
    const fn = vi.fn();
    const frameCallbacks: Array<() => void> = [];
    const scheduleFrame = vi.fn((cb: () => void) => frameCallbacks.push(cb));
    const throttled = throttleWithFrame(fn, scheduleFrame);

    throttled();
    throttled();
    throttled();
    expect(scheduleFrame).toHaveBeenCalledTimes(1);
    expect(fn).not.toHaveBeenCalled();

    frameCallbacks.shift()?.();
    expect(fn).toHaveBeenCalledTimes(1);

    throttled();
    expect(scheduleFrame).toHaveBeenCalledTimes(2);
  });

  it('normalizes font size: clamped to 10–24, invalid falls back to default', () => {
    expect(normalizeSettings({}).fontSize).toBe(DEFAULT_FONT_SIZE);
    expect(normalizeSettings({ fontSize: 18 }).fontSize).toBe(18);
    expect(normalizeSettings({ fontSize: MAX_FONT_SIZE }).fontSize).toBe(MAX_FONT_SIZE);
    expect(normalizeSettings({ fontSize: 72 }).fontSize).toBe(DEFAULT_FONT_SIZE);
    expect(normalizeSettings({ fontSize: MIN_FONT_SIZE - 1 }).fontSize).toBe(DEFAULT_FONT_SIZE);
    expect(normalizeSettings({ fontSize: '18' }).fontSize).toBe(DEFAULT_FONT_SIZE);
    expect(normalizeSettings({ fontSize: Number.NaN }).fontSize).toBe(DEFAULT_FONT_SIZE);
  });
});
