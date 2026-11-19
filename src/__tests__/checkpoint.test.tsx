import { isValidElement, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// CheckpointCard uses hooks (L6 auto-grow effect) but the tests call it as a
// plain function, so the hook calls need a stub dispatcher like the one in
// InputBar.test.tsx. The effect is a no-op here; the ref just needs an object.
vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();
  return {
    ...actual,
    useEffect: () => undefined,
    useRef: (initial: unknown) => ({ current: initial }),
  };
});

import { resetBusForTests } from '../bridge/bus';
import { t } from '../i18n/t';
import { awaitCheckpoint, resetCheckpointForTests, type PendingCheckpoint } from '../workflow/checkpoint';
import { resetCancelState } from '../workflow/cancel';
import { Button } from '../ui/Button';
import { CheckpointCard } from '../ui/CheckpointCard';

interface ElementProps {
  children?: ReactNode;
  value?: string;
  onClick?: () => void;
  onChange?: (event: { currentTarget: { value: string } }) => void;
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

function isButtonElement(element: ReactElement): boolean {
  return element.type === 'button' || element.type === Button;
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

function pendingCheckpoint(overrides: Partial<PendingCheckpoint> = {}): PendingCheckpoint {
  return {
    nodeId: 'pro',
    sourceNodeId: 'question',
    provider: 'chatgpt',
    draft: 'original draft',
    ...overrides,
  };
}

describe('CheckpointCard', () => {
  beforeEach(() => {
    resetBusForTests();
    resetCancelState();
    resetCheckpointForTests();
  });

  afterEach(() => {
    resetCheckpointForTests();
    resetBusForTests();
    resetCancelState();
  });

  it('renders nothing when no checkpoint is pending', () => {
    expect(CheckpointCard({ checkpoint: undefined, draft: '', onDraftChange: vi.fn() })).toBeNull();
  });

  it('lets the three action buttons wrap without shrinking', () => {
    const tree = CheckpointCard({ checkpoint: pendingCheckpoint(), draft: '', onDraftChange: vi.fn() });
    const html = renderToStaticMarkup(tree);
    expect(html).toContain('flex flex-wrap gap-2');
    expect(html.match(/shrink-0 whitespace-nowrap/g)).toHaveLength(3);
  });

  it('renders the draft and confirms the edited draft through the checkpoint registry', async () => {
    const checkpoint = pendingCheckpoint();
    const decision = awaitCheckpoint(checkpoint);
    const onDraftChange = vi.fn();
    const tree = CheckpointCard({ checkpoint, draft: 'edited draft', onDraftChange });

    expect(renderToStaticMarkup(tree)).toContain('edited draft');
    expect(renderToStaticMarkup(tree)).toContain(`${t('checkpoint.step', 'en')} pro`);
    const textarea = firstElement(tree, (element) => element.type === 'textarea');
    propsOf(textarea).onChange?.({ currentTarget: { value: 'new edit' } });
    expect(onDraftChange).toHaveBeenCalledWith('new edit');

    const confirm = firstElement(tree, (element) => isButtonElement(element) && textOf(element).includes(t('checkpoint.confirm', 'en')));
    propsOf(confirm).onClick?.();

    await expect(decision).resolves.toEqual({ action: 'confirm', draft: 'edited draft' });
  });

  it('shows a character count for the draft', () => {
    const tree = CheckpointCard({ checkpoint: pendingCheckpoint(), draft: 'edited draft', onDraftChange: vi.fn() });
    expect(renderToStaticMarkup(tree)).toContain('12 characters');
  });

  it('resolves skip through the checkpoint registry', async () => {
    const checkpoint = pendingCheckpoint({ nodeId: 'con' });
    const decision = awaitCheckpoint(checkpoint);
    const tree = CheckpointCard({ checkpoint, draft: checkpoint.draft, onDraftChange: vi.fn() });
    const skip = firstElement(tree, (element) => isButtonElement(element) && textOf(element).includes(t('checkpoint.skip', 'en')));

    propsOf(skip).onClick?.();

    await expect(decision).resolves.toEqual({ action: 'skip' });
  });

  it('resolves native-edit with the current draft and invokes the provider promotion hook', async () => {
    const checkpoint = pendingCheckpoint({ provider: 'gemini' });
    const decision = awaitCheckpoint(checkpoint);
    const onNativeEdit = vi.fn();
    const tree = CheckpointCard({
      checkpoint,
      draft: 'provider-side draft',
      onDraftChange: vi.fn(),
      onNativeEdit,
    });
    const nativeEdit = firstElement(tree, (element) => isButtonElement(element) && textOf(element).includes(t('checkpoint.editInProvider', 'en')));

    propsOf(nativeEdit).onClick?.();

    expect(onNativeEdit).toHaveBeenCalledWith('gemini');
    await expect(decision).resolves.toEqual({ action: 'native-edit', draft: 'provider-side draft' });
  });
});
