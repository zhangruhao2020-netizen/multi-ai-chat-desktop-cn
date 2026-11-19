import { isValidElement, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

// ModalDialog uses hooks; the close-button test calls it directly, so the hook
// calls need a stub dispatcher (same pattern as checkpoint.test.tsx).
vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();
  return {
    ...actual,
    useEffect: () => undefined,
    useRef: (initial: unknown) => ({ current: initial }),
  };
});

import { ModalDialog } from '../ui/ModalDialog';
import { Resizer } from '../ui/Resizer';

describe('accessible interaction primitives', () => {
  it('exposes modal semantics and its accessible title', () => {
    const html = renderToStaticMarkup(
      <ModalDialog titleId="dialog-title" panelClassName="panel">
        <h2 id="dialog-title">Settings</h2>
        <button type="button">Close</button>
      </ModalDialog>,
    );

    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain('aria-labelledby="dialog-title"');
  });

  it('shows a close button that invokes the escape handler, unless opted out', () => {
    const onEscape = vi.fn();
    const tree = ModalDialog({
      titleId: 'dialog-title',
      onEscape,
      closeLabel: 'Close',
      panelClassName: 'panel',
      children: <h2 id="dialog-title">Settings</h2>,
    });
    expect(renderToStaticMarkup(tree)).toContain('aria-label="Close"');

    const panel = tree.props.children as ReactElement;
    const panelChildren = (Array.isArray(panel.props.children) ? panel.props.children : [panel.props.children]) as ReactNode[];
    const closeButton = panelChildren.find(
      (child): child is ReactElement =>
        isValidElement(child) && (child.props as { 'aria-label'?: string })['aria-label'] === 'Close',
    );
    expect(closeButton).toBeDefined();
    (closeButton?.props as { onClick: () => void }).onClick();
    expect(onEscape).toHaveBeenCalledTimes(1);

    const hiddenTree = ModalDialog({
      titleId: 'dialog-title',
      onEscape,
      hideCloseButton: true,
      panelClassName: 'panel',
      children: <h2 id="dialog-title">Settings</h2>,
    });
    expect(renderToStaticMarkup(hiddenTree)).not.toContain('aria-label="Close"');
  });

  it('lets keyboard users resize the focus pane', () => {
    const onDrag = vi.fn();
    const tree = Resizer({ label: 'Resize', onDrag, value: 620, min: 420, max: 800 });
    const preventDefault = vi.fn();

    tree.props.onKeyDown({ key: 'ArrowRight', shiftKey: false, preventDefault });

    expect(preventDefault).toHaveBeenCalled();
    expect(onDrag).toHaveBeenNthCalledWith(1, 0, 'start');
    expect(onDrag).toHaveBeenNthCalledWith(2, 16, 'end');
    expect(tree.props['aria-valuenow']).toBe(620);
  });
});
