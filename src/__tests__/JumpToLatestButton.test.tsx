import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { JumpToLatestButton } from '../ui/JumpToLatestButton';

describe('JumpToLatestButton', () => {
  it('renders nothing while the transcript is near the end', () => {
    expect(renderToStaticMarkup(<JumpToLatestButton visible={false} label="Jump to latest" onJump={vi.fn()} />)).toBe('');
  });

  it('renders a labelled floating button when scrolled away from the end', () => {
    const html = renderToStaticMarkup(<JumpToLatestButton visible label="Jump to latest" onJump={vi.fn()} />);
    expect(html).toContain('aria-label="Jump to latest"');
    expect(html).toContain('Jump to latest');
    expect(html).toContain('absolute bottom-3 right-3');
    expect(html).toContain('min-h-8');
  });

  it('calls onJump when clicked', () => {
    const onJump = vi.fn();
    const element = JumpToLatestButton({ visible: true, label: 'Jump to latest', onJump });
    expect(element).not.toBeNull();
    element!.props.onClick();
    expect(onJump).toHaveBeenCalledTimes(1);
  });
});
