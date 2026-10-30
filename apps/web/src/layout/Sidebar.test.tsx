import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Sidebar } from './Sidebar';

describe('Sidebar (T052 AC5)', () => {
  it('marks the current page with aria-current and on-accent text (never text-white)', () => {
    render(
      <MemoryRouter initialEntries={['/tasks']}>
        <Sidebar open />
      </MemoryRouter>,
    );
    const active = screen.getByRole('link', { name: 'Tasks' });
    expect(active).toHaveAttribute('aria-current', 'page');
    expect(active).toHaveClass('bg-accent', 'text-on-accent');
    expect(active).not.toHaveClass('text-white');
    expect(screen.getByRole('link', { name: 'Recipes' })).not.toHaveAttribute('aria-current');
  });

  it('exposes the side-nav hook the Graphite theme styles', () => {
    render(
      <MemoryRouter>
        <Sidebar open />
      </MemoryRouter>,
    );
    expect(screen.getByRole('navigation', { name: 'Main navigation' })).toHaveClass('side-nav');
  });
});
