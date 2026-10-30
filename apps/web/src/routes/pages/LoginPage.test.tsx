import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LoginPage } from './LoginPage';

describe('LoginPage', () => {
  it('switches to login mode and hides org/kitchen fields', async () => {
    const { default: userEvent } = await import('@testing-library/user-event');
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );
    await user.click(screen.getByRole('button', { name: 'Log in' }));
    expect(screen.queryByPlaceholderText('Organization name')).not.toBeInTheDocument();
  });
});

describe('LoginPage mode toggle (T052 AC4)', () => {
  it('exposes the selected mode via aria-pressed so the theme can style it as a segment, not a primary button', () => {
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );
    // The mode toggle is the first "Sign up" button; the submit button shares its name.
    expect(screen.getAllByRole('button', { name: 'Sign up' })[0]).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Log in' })).toHaveAttribute('aria-pressed', 'false');
  });
});
