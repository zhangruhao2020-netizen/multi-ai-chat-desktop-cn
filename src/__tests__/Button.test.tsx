import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Button } from '../ui/Button';

describe('Button', () => {
  it('renders the primary variant with the shared emerald styles', () => {
    const html = renderToStaticMarkup(
      <Button variant="primary" onClick={() => {}}>
        Confirm
      </Button>,
    );
    expect(html).toContain('<button');
    expect(html).toContain('type="button"');
    expect(html).toContain('border-emerald-300');
    expect(html).toContain('bg-emerald-50');
    expect(html).toContain('text-emerald-700');
    expect(html).toContain('px-3 py-1.5 text-xs');
    expect(html).toContain('>Confirm</button>');
  });

  it('renders each variant with its own colors and the small size', () => {
    const ghost = renderToStaticMarkup(
      <Button variant="ghost" size="sm">
        Close
      </Button>,
    );
    expect(ghost).toContain('border-zinc-300');
    expect(ghost).toContain('px-2 py-1 text-xs');

    const subtle = renderToStaticMarkup(<Button variant="subtle">Switch</Button>);
    expect(subtle).toContain('border-sky-300');
    expect(subtle).toContain('bg-sky-50');

    const danger = renderToStaticMarkup(<Button variant="danger">Delete</Button>);
    expect(danger).toContain('border-red-300');
    expect(danger).toContain('bg-red-50');
  });

  it('passes type, disabled, and extra classes through', () => {
    const html = renderToStaticMarkup(
      <Button type="submit" disabled className="min-w-16">
        Save
      </Button>,
    );
    expect(html).toContain('type="submit"');
    expect(html).toContain('disabled');
    expect(html).toContain('min-w-16');
    expect(html).toContain('disabled:cursor-not-allowed');
  });
});
