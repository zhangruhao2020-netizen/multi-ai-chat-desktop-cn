import { isValidElement, useEffect, useRef, useState, type ReactElement, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CopyButton } from '../ui/CopyButton';

const clipboardMock = vi.hoisted(() => ({ writeText: vi.fn() }));
vi.mock('../ui/clipboard', () => ({ copyTextToClipboard: clipboardMock.writeText }));

vi.mock('react', async (importOriginal) => {
  const react = await importOriginal<typeof import('react')>();
  return { ...react, useEffect: vi.fn(), useRef: vi.fn(react.useRef), useState: vi.fn(react.useState) };
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

type ButtonProps = { children?: ReactNode; onClick?: () => void; 'aria-label'?: string; className?: string };

function textOf(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textOf).join('');
  if (isValidElement(node)) return textOf((node.props as { children?: ReactNode }).children);
  return '';
}

function harness() {
  const states: unknown[] = [];
  const refs: { current: unknown }[] = [];
  const render = () => {
    let stateIndex = 0;
    let refIndex = 0;
    vi.mocked(useState).mockImplementation((initial?: unknown): [unknown, (next: unknown) => void] => {
      const index = stateIndex++;
      if (!(index in states)) states[index] = typeof initial === 'function' ? (initial as () => unknown)() : initial;
      return [
        states[index],
        (next) => {
          states[index] = typeof next === 'function' ? (next as (current: unknown) => unknown)(states[index]) : next;
        },
      ];
    });
    vi.mocked(useRef).mockImplementation((initial) => refs[refIndex++] ?? (refs[refIndex - 1] = { current: initial }));
    vi.mocked(useEffect).mockImplementation(() => {});
    const tree = CopyButton({ text: 'hello world', label: 'Copy', copiedLabel: 'Copied' });
    vi.mocked(useState).mockRestore();
    vi.mocked(useRef).mockRestore();
    vi.mocked(useEffect).mockRestore();
    return tree as ReactElement<ButtonProps>;
  };
  return { render };
}

describe('CopyButton', () => {
  beforeEach(() => {
    clipboardMock.writeText.mockReset();
    vi.useFakeTimers();
  });

  it('shows the copied label after a successful copy and resets after the timeout', async () => {
    clipboardMock.writeText.mockResolvedValue(true);
    const ui = harness();

    const before = ui.render();
    expect(before.props['aria-label']).toBe('Copy');
    expect(textOf(before.props.children)).toContain('Copy');

    before.props.onClick?.();
    await Promise.resolve();
    await Promise.resolve();

    const copied = ui.render();
    expect(copied.props['aria-label']).toBe('Copied');
    expect(textOf(copied.props.children)).toContain('Copied');
    expect(clipboardMock.writeText).toHaveBeenCalledWith('hello world');

    vi.advanceTimersByTime(1600);
    const reset = ui.render();
    expect(reset.props['aria-label']).toBe('Copy');
  });

  it('stays on the copy label when copying fails', async () => {
    clipboardMock.writeText.mockResolvedValue(false);
    const ui = harness();

    const before = ui.render();
    before.props.onClick?.();
    await Promise.resolve();
    await Promise.resolve();

    const after = ui.render();
    expect(after.props['aria-label']).toBe('Copy');
    expect(textOf(after.props.children)).toContain('Copy');
  });
});
