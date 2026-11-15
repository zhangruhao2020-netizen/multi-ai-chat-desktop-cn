import { describe, expect, it } from 'vitest';
import { GEMINI_MODEL_OPTIONS, normalizeProviderModels } from '../ui/providerModels';
import { defaultSettings, normalizeSettings } from '../ui/settingsModel';

describe('provider model selection', () => {
  it('keeps only known Gemini model keys', () => {
    expect(normalizeProviderModels({ gemini: 'pro' })).toEqual({ gemini: 'pro' });
    expect(normalizeProviderModels({ gemini: 'fast' })).toEqual({ gemini: 'fast' });
    expect(normalizeProviderModels({ gemini: 'thinking' })).toEqual({ gemini: 'thinking' });
    expect(normalizeProviderModels({ gemini: 'ultra' })).toEqual({});
    expect(normalizeProviderModels({ chatgpt: 'gpt-5' })).toEqual({});
    expect(normalizeProviderModels({ gemini: 42 })).toEqual({});
    expect(normalizeProviderModels(undefined)).toEqual({});
  });

  it('round-trips through normalizeSettings and defaults to no model', () => {
    expect(normalizeSettings({ providerModels: { gemini: 'thinking' } }).providerModels).toEqual({
      gemini: 'thinking',
    });
    expect(normalizeSettings({ providerModels: { gemini: 'bogus' } }).providerModels).toEqual({});
    expect(normalizeSettings({}).providerModels).toEqual({});
    expect(defaultSettings().providerModels).toEqual({});
  });

  it('offers exactly the three Gemini models the adapter picker knows', () => {
    expect(GEMINI_MODEL_OPTIONS.map((option) => option.key)).toEqual(['pro', 'fast', 'thinking']);
  });
});
