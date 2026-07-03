import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from './App';

describe('App', () => {
  it('renders the signup/login form by default in signup mode', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: 'KitchenOS' })).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Organization name')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Kitchen name')).toBeInTheDocument();
  });

  it('switches to login mode and hides org/kitchen fields', async () => {
    const { default: userEvent } = await import('@testing-library/user-event');
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Log in' }));
    expect(screen.queryByPlaceholderText('Organization name')).not.toBeInTheDocument();
  });
});
