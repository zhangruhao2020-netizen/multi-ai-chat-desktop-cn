import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { Resizer } from '../ui/Resizer';

const props = {
  label: 'Resize focus pane',
  onDrag: vi.fn(),
  value: 420,
  min: 320,
  max: 720,
};

describe('Resizer', () => {
  it('keeps the 6px visual bar but adds a wider invisible grab zone and a hover grip', () => {
    const html = renderToStaticMarkup(<Resizer {...props} />);
    expect(html).toContain('role="separator"');
    // ~14px hit zone: 4px past each edge of the 6px bar.
    expect(html).toContain('-left-1 -right-1');
    // Grip is invisible until hover/focus.
    expect(html).toContain('group-hover:opacity-100');
    expect(html).toContain('opacity-0');
  });

  it('moves by keyboard steps without changing the pointer behaviour', () => {
    const onDrag = vi.fn();
    const element = Resizer({ ...props, onDrag });
    element.props.onKeyDown({ key: 'ArrowRight', shiftKey: false, preventDefault: vi.fn() });
    expect(onDrag).toHaveBeenCalledWith(0, 'start');
    expect(onDrag).toHaveBeenCalledWith(16, 'end');
    onDrag.mockClear();
    element.props.onKeyDown({ key: 'Home', shiftKey: false, preventDefault: vi.fn() });
    expect(onDrag).toHaveBeenCalledWith(320 - 420, 'end');
  });
});
