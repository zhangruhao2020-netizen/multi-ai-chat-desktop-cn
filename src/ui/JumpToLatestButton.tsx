// M4: floating "jump to latest" button for the transcript. Shown only while the
// user has scrolled away from the end; hidden once they are back near the end
// (the caller drives `visible` from isTranscriptNearEnd).
export function JumpToLatestButton({
  visible,
  label,
  onJump,
}: {
  visible: boolean;
  label: string;
  onJump: () => void;
}) {
  if (!visible) return null;
  return (
    <button
      type="button"
      className="absolute bottom-3 right-3 z-10 flex min-h-8 items-center gap-1.5 rounded-full border border-sky-300 bg-white px-3 text-xs font-medium text-sky-700 shadow-lg hover:bg-sky-50 dark:border-sky-700 dark:bg-zinc-900 dark:text-sky-200 dark:hover:bg-sky-950"
      aria-label={label}
      onClick={onJump}
    >
      <span aria-hidden="true">↓</span>
      {label}
    </button>
  );
}
