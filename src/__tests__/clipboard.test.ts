import { afterEach, describe, expect, it, vi } from 'vitest';
import { copyTextToClipboard } from '../ui/clipboard';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('copyTextToClipboard', () => {
  it('uses the async Clipboard API when available', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });

    await expect(copyTextToClipboard('hello')).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith('hello');
  });

  it('falls back to execCommand when the Clipboard API rejects', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('denied'));
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    const textarea = { select: vi.fn(), setAttribute: vi.fn(), style: {} as Record<string, string>, value: '' };
    const appendChild = vi.fn();
    const removeChild = vi.fn();
    const execCommand = vi.fn().mockReturnValue(true);
    vi.stubGlobal(
      'document',
      {
        createElement: vi.fn().mockReturnValue(textarea),
        body: { appendChild, removeChild },
        execCommand,
      } as unknown as Document,
    );

    await expect(copyTextToClipboard('fallback')).resolves.toBe(true);
    expect(execCommand).toHaveBeenCalledWith('copy');
    expect(appendChild).toHaveBeenCalledWith(textarea);
    expect(removeChild).toHaveBeenCalledWith(textarea);
  });

  it('returns false when no clipboard path is available', async () => {
    vi.stubGlobal('navigator', {});
    vi.stubGlobal('document', undefined);

    await expect(copyTextToClipboard('nothing')).resolves.toBe(false);
  });
});
