import { useEffect, useRef, useState } from 'react';
import { copyTextToClipboard } from './clipboard';

// Shared copy affordance (H4, reused by H5 code blocks): a small button that
// copies `text` and briefly shows the copied label. Pass `label`/`copiedLabel`
// already translated by the caller.
export function CopyButton({
  text,
  label,
  copiedLabel,
  className,
}: {
  text: string;
  label: string;
  copiedLabel: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(
    () => () => {
      if (timerRef.current !== undefined) clearTimeout(timerRef.current);
    },
    [],
  );

  const onCopy = async () => {
    const ok = await copyTextToClipboard(text);
    if (!ok) return;
    setCopied(true);
    if (timerRef.current !== undefined) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setCopied(false), 1600);
  };

  return (
    <button
      type="button"
      className={`inline-flex shrink-0 items-center gap-1 border border-zinc-300 px-1.5 py-0.5 text-xs text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800 ${className ?? ''}`}
      onClick={() => void onCopy()}
      aria-label={copied ? copiedLabel : label}
      title={copied ? copiedLabel : label}
    >
      <span aria-hidden="true">{copied ? '✓' : '⧉'}</span>
      <span>{copied ? copiedLabel : label}</span>
    </button>
  );
}
