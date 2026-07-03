import { afterEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from './App';
import { NAV_ITEMS } from './layout/navigation';
import { setToken } from './routes/auth';

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

describe('App routing', () => {
  afterEach(() => {
    window.localStorage.clear();
  });

  it('redirects an unauthenticated user hitting a gated route to /login', () => {
    renderAt('/tasks');
    expect(screen.getByRole('heading', { name: 'KitchenOS' })).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Email')).toBeInTheDocument();
  });

  it('redirects an unauthenticated user at "/" to /login', () => {
    renderAt('/');
    expect(screen.getByPlaceholderText('Email')).toBeInTheDocument();
  });

  it('renders the signup/login form at /login in signup mode by default', () => {
    renderAt('/login');
    expect(screen.getByRole('heading', { name: 'KitchenOS' })).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Organization name')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Kitchen name')).toBeInTheDocument();
  });

  it.each(NAV_ITEMS)('renders a distinct empty-state page for $label when authenticated', (item) => {
    setToken('fake-jwt');
    renderAt(item.path);
    expect(screen.getByRole('heading', { name: item.label })).toBeInTheDocument();
    expect(screen.getByText(item.emptyMessage)).toBeInTheDocument();
  });

  it('shows the sidebar nav for an authenticated user', () => {
    setToken('fake-jwt');
    renderAt('/dashboard');
    const nav = screen.getByRole('navigation', { name: 'Main navigation' });
    for (const item of NAV_ITEMS) {
      expect(nav).toHaveTextContent(item.label);
    }
  });
});
