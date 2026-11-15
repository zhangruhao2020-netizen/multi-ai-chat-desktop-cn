import type { ButtonHTMLAttributes } from 'react';

// Shared button primitives (H3): the same emerald/sky/zinc/red button styles were
// copy-pasted ~40 times with drifting paddings. New code should use Button;
// existing call sites are migrated file by file.
export type ButtonVariant = 'primary' | 'ghost' | 'danger' | 'subtle';
export type ButtonSize = 'sm' | 'md';

const variantClasses: Record<ButtonVariant, string> = {
  // Main confirm action (checkpoint confirm, preflight login, replay).
  primary:
    'border border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-100 dark:hover:bg-emerald-900',
  // Secondary tinted action (edit in provider, switch mode, settings save).
  subtle:
    'border border-sky-300 bg-sky-50 text-sky-700 hover:bg-sky-100 dark:border-sky-700 dark:bg-sky-950 dark:text-sky-100 dark:hover:bg-sky-900',
  // Neutral action (skip, close, refresh, insert file).
  ghost:
    'border border-zinc-300 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800',
  // Destructive action (stop, retry, delete).
  danger:
    'border border-red-300 bg-red-50 text-red-800 hover:bg-red-100 dark:border-red-700 dark:bg-red-950 dark:text-red-100 dark:hover:bg-red-900',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'px-2 py-1 text-xs',
  md: 'px-3 py-1.5 text-xs',
};

const baseClasses = 'inline-flex items-center justify-center gap-1.5 disabled:cursor-not-allowed disabled:opacity-50';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export function Button({ variant = 'ghost', size = 'md', className, type = 'button', children, ...rest }: ButtonProps) {
  const classes = [baseClasses, variantClasses[variant], sizeClasses[size], className].filter(Boolean).join(' ');
  return (
    <button type={type} className={classes} {...rest}>
      {children}
    </button>
  );
}
