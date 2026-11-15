import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@tauri-apps/api/app', () => ({
  getVersion: vi.fn(),
}));

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(),
}));

import { ChatMessage } from '../App';

describe('ChatMessage copy and timestamp', () => {
  it('shows a hover-revealed copy button and the message time', () => {
    const createdAt = new Date('2026-11-15T09:24:00+08:00').getTime();
    const html = renderToStaticMarkup(
      <ChatMessage
        message={{ id: 'm1', role: 'ai', provider: 'chatgpt', content: 'Hello **world**', final: true, createdAt }}
        locale="en"
        thinking={false}
      />,
    );

    expect(html).toContain('aria-label="Copy"');
    expect(html).toContain('group-hover:opacity-100');
    expect(html).toContain('<time');
    expect(html).toContain(`dateTime="${new Date(createdAt).toISOString()}"`);
    expect(html).toContain(
      new Intl.DateTimeFormat('en', { hour: '2-digit', minute: '2-digit' }).format(createdAt),
    );
    expect(html).toContain('Hello');
  });

  it('omits the timestamp for messages saved before timestamps existed', () => {
    const html = renderToStaticMarkup(
      <ChatMessage
        message={{ id: 'm2', role: 'user', content: 'old message', final: true }}
        locale="en"
        thinking={false}
      />,
    );

    expect(html).not.toContain('<time');
    expect(html).toContain('aria-label="Copy"');
  });

  it('uses the translated copy label', () => {
    const html = renderToStaticMarkup(
      <ChatMessage
        message={{ id: 'm3', role: 'user', content: '你好', final: true, createdAt: Date.now() }}
        locale="zh-CN"
        thinking={false}
      />,
    );

    expect(html).toContain('aria-label="复制"');
  });
});
