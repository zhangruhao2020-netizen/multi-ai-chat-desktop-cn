import type { KeyboardEvent, PointerEvent } from 'react';

export function Resizer({
  label,
  onDrag,
  value,
  min,
  max,
}: {
  label: string;
  onDrag: (deltaX: number, phase: 'start' | 'move' | 'end') => void;
  value: number;
  min: number;
  max: number;
}) {
  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    const startX = event.clientX;
    const target = event.currentTarget;
    target.setPointerCapture(event.pointerId);
    document.body.style.cursor = 'col-resize';
    onDrag(0, 'start');

    const onPointerMove = (moveEvent: globalThis.PointerEvent) => {
      onDrag(moveEvent.clientX - startX, 'move');
    };
    const onPointerUp = (upEvent: globalThis.PointerEvent) => {
      onDrag(upEvent.clientX - startX, 'end');
      document.body.style.cursor = '';
      if (target.hasPointerCapture(event.pointerId)) target.releasePointerCapture(event.pointerId);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    let delta: number | undefined;
    const step = event.shiftKey ? 64 : 16;
    if (event.key === 'ArrowLeft') delta = -step;
    if (event.key === 'ArrowRight') delta = step;
    if (event.key === 'Home') delta = min - value;
    if (event.key === 'End') delta = max - value;
    if (delta === undefined) return;
    event.preventDefault();
    onDrag(0, 'start');
    onDrag(delta, 'end');
  };

  return (
    <div
      aria-label={label}
      role="separator"
      aria-orientation="vertical"
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      tabIndex={0}
      className="group relative h-full cursor-col-resize bg-zinc-50 dark:bg-zinc-900 transition-colors hover:bg-sky-200 dark:hover:bg-sky-700"
      onPointerDown={onPointerDown}
      onKeyDown={onKeyDown}
    >
      {/* M8: the visual bar stays 6px, but the grab zone extends 4px past each
          edge (~14px total) so the resizer is findable and draggable. */}
      <span aria-hidden="true" className="absolute -inset-y-0 -left-1 -right-1" />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-1/2 h-8 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-zinc-400 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 dark:bg-zinc-500"
      />
    </div>
  );
}
