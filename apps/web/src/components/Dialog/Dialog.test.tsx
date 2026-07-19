import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Dialog } from './Dialog';

describe('Dialog', () => {
  it('renders with overlay and centered content', () => {
    const onClose = vi.fn();

    render(
      <Dialog titleId="test-title" onClose={onClose}>
        <h2 id="test-title">Test Dialog</h2>
        <p>Dialog content</p>
      </Dialog>,
    );

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Test Dialog')).toBeInTheDocument();
  });

  it('closes when Escape key is pressed', async () => {
    const onClose = vi.fn();

    render(
      <Dialog titleId="test-title" onClose={onClose}>
        <h2 id="test-title">Test Dialog</h2>
      </Dialog>,
    );

    const event = new KeyboardEvent('keydown', { key: 'Escape' });
    document.dispatchEvent(event);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('applies cursor-pointer to the overlay but not the inner wrapper', () => {
    const onClose = vi.fn();

    render(
      <Dialog titleId="test-title" onClose={onClose}>
        <h2 id="test-title">Test Dialog</h2>
        <p>Dialog content</p>
      </Dialog>,
    );

    // The overlay div is the one with role="dialog" and onClick={onClose}
    const overlay = screen.getByRole('dialog') as HTMLDivElement;

    // Verify overlay has cursor-pointer Tailwind class (which produces cursor: pointer)
    expect(overlay).toHaveClass('cursor-pointer');
    expect(overlay.className).toContain('cursor-pointer');

    // Verify inner content wrapper does NOT have cursor-pointer
    const innerWrapper = overlay.querySelector('.bg-surface-raised') as HTMLDivElement;
    expect(innerWrapper).not.toHaveClass('cursor-pointer');
    expect(innerWrapper.className).not.toContain('cursor-pointer');
  });

  it('prevents click propagation from inner content to overlay', async () => {
    const onClose = vi.fn();

    render(
      <Dialog titleId="test-title" onClose={onClose}>
        <h2 id="test-title">Test Dialog</h2>
        <p id="content">Click me</p>
      </Dialog>,
    );

    const { default: userEvent } = await import('@testing-library/user-event');
    const user = userEvent.setup();

    const contentParagraph = screen.getByText('Click me');
    await user.click(contentParagraph);

    // onClose should NOT be called when clicking inner content
    expect(onClose).not.toHaveBeenCalled();
  });
});
