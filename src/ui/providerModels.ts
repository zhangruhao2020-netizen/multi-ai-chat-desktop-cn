import type { AIProvider, ProviderModels } from '../../shared/types';

export interface ProviderModelOption {
  key: string;
  label: string;
}

// Gemini is the first provider with a model choice. The keys are the ones
// the app's stored setting uses; the engine resolves them against the
// model picker in adapters/gemini.json. Labels are the model names as
// shown in Gemini's picker, so they are the same in every UI language.
export const GEMINI_MODEL_OPTIONS: ProviderModelOption[] = [
  { key: 'pro', label: '2.5 Pro' },
  { key: 'fast', label: '2.5 Flash' },
  { key: 'thinking', label: '2.5 Flash Thinking' },
];

// Providers that currently offer a model choice in Settings, with the keys
// each one accepts. Any stored key outside this table is dropped by
// normalization, so a stale or hand-edited setting can never reach a
// provider page.
const KNOWN_MODEL_KEYS: Partial<Record<AIProvider, readonly string[]>> = {
  gemini: GEMINI_MODEL_OPTIONS.map((option) => option.key),
};

export function normalizeProviderModels(value: unknown): ProviderModels {
  if (!value || typeof value !== 'object') return {};
  const input = value as Record<string, unknown>;
  const normalized: ProviderModels = {};
  for (const [provider, keys] of Object.entries(KNOWN_MODEL_KEYS)) {
    const stored = input[provider];
    if (typeof stored === 'string' && keys?.includes(stored)) {
      normalized[provider as AIProvider] = stored;
    }
  }
  return normalized;
}
