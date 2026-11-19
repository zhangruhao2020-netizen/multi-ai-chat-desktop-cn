import { useEffect, useRef, type ReactNode } from 'react';

const FOCUSABLE_SELECTOR = [
  'button:not([disabled])',
  'a[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export function ModalDialog({
  titleId,
  descriptionId,
  children,
  onEscape,
  onBackdrop,
  // L2: the X closes the dialog. Defaults to the Escape handler so every
  // dialog keeps one close action; dialogs with their own header close
  // button (Settings, process-trace detail) opt out via hideCloseButton.
  onClose,
  hideCloseButton = false,
  closeLabel = 'Close',
  panelClassName,
}: {
  titleId: string;
  descriptionId?: string;
  children: ReactNode;
  onEscape?: () => void;
  onBackdrop?: () => void;
  onClose?: () => void;
  hideCloseButton?: boolean;
  closeLabel?: string;
  panelClassName: string;
}) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const panel = panelRef.current;
    const firstFocusable = panel ? focusableElements(panel)[0] : undefined;
    (firstFocusable ?? panel)?.focus();

    return () => {
      previousFocusRef.current?.focus();
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && onEscape) {
        event.preventDefault();
        onEscape();
        return;
      }
      if (event.key !== 'Tab') return;

      const panel = panelRef.current;
      if (!panel) return;
      const focusable = focusableElements(panel);
      if (focusable.length === 0) {
        event.preventDefault();
        panel.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onEscape]);

  const handleClose = onClose ?? onEscape;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onBackdrop?.();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        tabIndex={-1}
        className={`${panelClassName} relative`}
      >
        {!hideCloseButton && handleClose ? (
          <button
            type="button"
            aria-label={closeLabel}
            title={closeLabel}
            onClick={handleClose}
            className="absolute right-3 top-3 flex h-8 w-8 shrink-0 items-center justify-center rounded text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
          >
            <span aria-hidden="true" className="text-lg leading-none">×</span>
          </button>
        ) : null}
        {children}
      </div>
    </div>
  );
}

function focusableElements(panel: HTMLElement): HTMLElement[] {
  return Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (element) => element.getClientRects().length > 0 && window.getComputedStyle(element).visibility !== 'hidden',
  );
}
