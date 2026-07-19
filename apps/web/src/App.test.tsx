import { afterEach, describe, expect, it, vi } from 'vitest';
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

  // /tasks, /notes, /dashboard, /settings, /team, /inventory, /guidelines,
  // and /announcements render real feature pages (T008/T012/T018/T026/
  // T028/T031/T032/T033) instead of the SectionPage placeholder — each has
  // its own dedicated test suite (TasksPage.test.tsx, NotesPage.test.tsx,
  // Dashboard.test.tsx, TeamPage.test.tsx, InventoryPage.test.tsx,
  // GuidelinesPage.test.tsx, AnnouncementsPage.test.tsx, this suite's
  // "real Settings page" test below).
  const placeholderItems = NAV_ITEMS.filter(
    (item) =>
      ![
        '/tasks',
        '/notes',
        '/dashboard',
        '/settings',
        '/team',
        '/inventory',
        '/guidelines',
        '/announcements',
      ].includes(item.path),
  );

  it.each(placeholderItems)('renders a distinct empty-state page for $label when authenticated', (item) => {
    setToken('fake-jwt');
    renderAt(item.path);
    expect(screen.getByRole('heading', { name: item.label })).toBeInTheDocument();
    expect(screen.getByText(item.emptyMessage)).toBeInTheDocument();
  });

  it('renders the real Dashboard page (not the placeholder) when authenticated', () => {
    setToken('fake-jwt');
    renderAt('/dashboard');
    expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
    expect(screen.getByTestId('dashboard-grid')).toBeInTheDocument();
  });

  it('T026: renders the real Settings page (not the placeholder) when authenticated', () => {
    setToken('fake-jwt');
    renderAt('/settings');
    expect(screen.getByRole('heading', { name: 'Settings' })).toBeInTheDocument();
    expect(screen.getByRole('radiogroup')).toBeInTheDocument();
  });

  it('T028: renders the real Team page (not the placeholder) when authenticated', () => {
    setToken('fake-jwt');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => [] }),
    );
    renderAt('/team');
    expect(screen.getByRole('heading', { name: 'Team & Roles' })).toBeInTheDocument();
    vi.unstubAllGlobals();
  });

  it('T031: renders the real Inventory page (not the placeholder) when authenticated', () => {
    setToken('fake-jwt');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => [] }),
    );
    renderAt('/inventory');
    expect(screen.getByRole('heading', { name: 'Inventory' })).toBeInTheDocument();
    vi.unstubAllGlobals();
  });

  it('T032: renders the real Guidelines page (not the placeholder) when authenticated', async () => {
    setToken('fake-jwt');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => [] }),
    );
    renderAt('/guidelines');
    expect(screen.getByRole('heading', { name: 'Guidelines' })).toBeInTheDocument();
    vi.unstubAllGlobals();
  });

  it('T033: renders the real Announcements page (not the placeholder) when authenticated', () => {
    setToken('fake-jwt');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => [] }),
    );
    renderAt('/announcements');
    expect(screen.getByRole('heading', { name: 'Announcements' })).toBeInTheDocument();
    vi.unstubAllGlobals();
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
