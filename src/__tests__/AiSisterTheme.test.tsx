import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { I18nProvider } from '../i18n/context';
import { AiSisterAvatar, AiSisterEnsembleCard } from '../ui/AiSisterTheme';

describe('AI-Sister commemorative theme components', () => {
  it('renders the ensemble card with one portrait per active provider', () => {
    const html = renderToStaticMarkup(
      <I18nProvider language="en">
        <AiSisterEnsembleCard />
      </I18nProvider>,
    );

    expect(html).toContain('AI-Sister Commemorative Edition');
    expect(html).toContain('Final commemorative edition');
    expect(html.match(/ai-sister-avatar--xs/g)).toHaveLength(6);
    for (const provider of ['chatgpt', 'claude', 'deepseek', 'doubao', 'gemini', 'grok']) {
      expect(html).toContain(`data-provider="${provider}"`);
    }
    expect(html).not.toContain('data-provider="meta"');
  });

  it('renders only the supplied providers when given an explicit list', () => {
    const html = renderToStaticMarkup(
      <I18nProvider language="en">
        <AiSisterEnsembleCard providers={['deepseek', 'doubao']} />
      </I18nProvider>,
    );

    expect(html.match(/ai-sister-avatar--xs/g)).toHaveLength(2);
    expect(html).toContain('data-provider="deepseek"');
    expect(html).toContain('data-provider="doubao"');
    expect(html).not.toContain('data-provider="chatgpt"');
  });

  it('marks an active provider portrait for the speaking animation', () => {
    const html = renderToStaticMarkup(<AiSisterAvatar provider="claude" active size="lg" />);

    expect(html).toContain('data-provider="claude"');
    expect(html).toContain('data-active="true"');
    expect(html).toContain('ai-sister-avatar--lg');
  });

  it('uses the supplied Meta AI portrait for the optional provider', () => {
    const html = renderToStaticMarkup(<AiSisterAvatar provider="meta" size="md" />);

    expect(html).toContain('data-provider="meta"');
    expect(html).toContain('<img');
    expect(html).toContain('meta.webp');
    expect(html).not.toContain('data-avatar-fallback="true"');
  });

  it('uses the supplied DeepSeek portrait for the default provider', () => {
    const html = renderToStaticMarkup(<AiSisterAvatar provider="deepseek" size="md" />);

    expect(html).toContain('data-provider="deepseek"');
    expect(html).toContain('<img');
    expect(html).toContain('deepseek.webp');
    expect(html).not.toContain('data-avatar-fallback="true"');
  });

  it('uses the supplied Doubao portrait for the default provider', () => {
    const html = renderToStaticMarkup(<AiSisterAvatar provider="doubao" size="md" />);

    expect(html).toContain('data-provider="doubao"');
    expect(html).toContain('<img');
    expect(html).toContain('doubao.webp');
    expect(html).not.toContain('data-avatar-fallback="true"');
  });
});
