import { useEffect, useRef } from 'react';
import { AI_PROVIDERS } from '../../shared/constants';
import type { AIProvider } from '../../shared/types';
import type { Locale } from '../i18n/resolve';
import { formatI18n, t } from '../i18n/t';
import type { PendingCheckpoint } from '../workflow/checkpoint';
import { resolveCheckpoint } from '../workflow/checkpoint';
import { Button } from './Button';

export function CheckpointCard({
  checkpoint,
  draft,
  onDraftChange,
  onNativeEdit,
  locale = 'en',
}: {
  checkpoint: PendingCheckpoint | undefined;
  draft: string;
  onDraftChange: (draft: string) => void;
  onNativeEdit?: (provider: AIProvider) => void;
  locale?: Locale;
}) {
  // L6: the draft textarea auto-grows with its content (160–320px) instead of
  // scrolling internally at a fixed 160px, and shows a character count.
  // Hooks stay above the early return so the hook order is stable.
  const draftRef = useRef<HTMLTextAreaElement | null>(null);
  useEffect(() => {
    const textarea = draftRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(Math.max(textarea.scrollHeight, 160), 320)}px`;
  }, [draft]);

  if (!checkpoint) return null;

  const providerName = AI_PROVIDERS[checkpoint.provider].name;
  const source =
    checkpoint.sourceNodeId && checkpoint.sourceNodeId !== checkpoint.nodeId
      ? `${t('checkpoint.source', locale)} ${checkpoint.sourceNodeId}`
      : t('checkpoint.sourceInput', locale);

  return (
    <section className="mt-3 border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 p-3 text-sm text-zinc-900 dark:text-zinc-100">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="font-semibold">{t('checkpoint.confirmEachStep', locale)}</div>
          <div className="mt-1 text-xs text-amber-800 dark:text-amber-200">
            {t('checkpoint.step', locale)} {checkpoint.nodeId} · {providerName} · {source}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" className="shrink-0 whitespace-nowrap" onClick={() => resolveCheckpoint(checkpoint.nodeId, { action: 'skip' })}>
            {t('checkpoint.skip', locale)}
          </Button>
          <Button
            variant="subtle"
            className="shrink-0 whitespace-nowrap"
            onClick={() => {
              try {
                onNativeEdit?.(checkpoint.provider);
              } catch {
                // Presentation is best-effort; checkpoint resolution owns workflow progress.
              }
              resolveCheckpoint(checkpoint.nodeId, { action: 'native-edit', draft });
            }}
          >
            {t('checkpoint.editInProvider', locale)}
          </Button>
          <Button variant="primary" className="shrink-0 whitespace-nowrap" onClick={() => resolveCheckpoint(checkpoint.nodeId, { action: 'confirm', draft })}>
            {t('checkpoint.confirm', locale)}
          </Button>
        </div>
      </div>
      <textarea
        ref={draftRef}
        className="mt-3 min-h-40 w-full resize-y border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 p-2 text-sm leading-relaxed text-zinc-900 dark:text-zinc-100 outline-none focus:border-amber-500"
        value={draft}
        onChange={(event) => onDraftChange(event.currentTarget.value)}
        aria-label={`${t('checkpoint.draftFor', locale)} ${providerName} ${t('checkpoint.step', locale)} ${checkpoint.nodeId}`}
      />
      <div className="mt-1 text-right text-xs text-zinc-500 dark:text-zinc-400">
        {formatI18n(t('checkpoint.characterCount', locale), { count: draft.length })}
      </div>
    </section>
  );
}
