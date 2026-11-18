import { AI_PROVIDERS } from '../../shared/constants';
import type { AIProvider, ProviderState } from '../../shared/types';
import type { Locale } from '../i18n/resolve';
import { t } from '../i18n/t';
import { isSendable } from '../workflow';
import { AiSisterAvatar } from './AiSisterTheme';
import { toggleTarget } from './targets';

export function TargetChips({
  providers,
  states,
  selected,
  onChange,
  disabled = false,
  locale = 'en',
}: {
  providers: AIProvider[];
  states: Record<AIProvider, ProviderState>;
  selected: AIProvider[];
  onChange: (selected: AIProvider[]) => void;
  disabled?: boolean;
  locale?: Locale;
}) {
  return (
    <>
      {providers.map((provider) => {
        const sendable = isSendable(states[provider]);
        const active = selected.includes(provider);
        return (
          <button
            key={provider}
            type="button"
            disabled={!sendable || disabled}
            onClick={() => onChange(toggleTarget(selected, provider))}
            // M9: brand color as the chip's left border — the same identity
            // cue as the status-strip cards, visible in the default theme
            // where the avatar is hidden.
            style={{ borderLeftColor: AI_PROVIDERS[provider].color, borderLeftWidth: 3 }}
            className={`ai-sister-target-chip min-h-8 border px-2 py-1 text-xs ${
              active && sendable
                ? 'border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-200'
                : 'border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 disabled:opacity-60'
            }`}
          >
            <span className="flex items-center gap-2">
              <AiSisterAvatar provider={provider} size="xs" active={states[provider].thinking} />
              <span>
                {AI_PROVIDERS[provider].name}:{' '}
                {sendable ? (active ? t('connection.readySelected', locale) : t('connection.readyOff', locale)) : t('connection.notReady', locale)}
              </span>
            </span>
          </button>
        );
      })}
    </>
  );
}
