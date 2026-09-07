import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

let currentToken: string | null = null;
let currentUser: {
  id: string;
  email: string;
  organizationId: string;
  kitchenId: string;
  role: 'OWNER' | 'ADMIN' | 'CHEF' | 'STAFF' | 'VIEWER';
  themePreference?: 'simple' | 'dark-neon';
} | null = null;

vi.mock('../../routes/auth', () => ({
  getToken: () => currentToken,
  setToken: (token: string) => {
    currentToken = token;
  },
  clearToken: () => {
    currentToken = null;
  },
  isAuthenticated: () => Boolean(currentToken),
  setUser: (user: typeof currentUser) => {
    currentUser = user;
  },
  getUser: () => currentUser,
  clearUser: () => {
    currentUser = null;
  },
}));

import { ThemeProvider } from '../../theme/ThemeProvider';
import { SettingsPage } from './SettingsPage';
import { setUser, clearUser, setToken, clearToken } from '../../routes/auth';

function renderSettings() {
  return render(
    <ThemeProvider>
      <SettingsPage />
    </ThemeProvider>,
  );
}

describe('SettingsPage (T026/T048)', () => {
  afterEach(() => {
    cleanup();
    clearUser();
    clearToken();
    window.localStorage?.clear();
    document.documentElement.removeAttribute('data-theme');
    vi.restoreAllMocks();
  });

  it('AC4: shows both theme options and marks the account theme as selected', async () => {
    setUser({
      id: 'u1',
      email: 'a@b.com',
      organizationId: 'o1',
      kitchenId: 'k1',
      role: 'OWNER',
      themePreference: 'simple',
    });
    renderSettings();

    await waitFor(() =>
      expect(screen.getByTestId('theme-option-simple')).toHaveAttribute('aria-checked', 'true'),
    );
    expect(screen.getByTestId('theme-option-dark-neon')).toHaveAttribute('aria-checked', 'false');
  });

  it('AC4: selecting Dark Neon calls the T025 endpoint and updates <html data-theme>', async () => {
    const user = userEvent.setup();
    setToken('fake-jwt');
    setUser({
      id: 'u1',
      email: 'a@b.com',
      organizationId: 'o1',
      kitchenId: 'k1',
      role: 'OWNER',
      themePreference: 'simple',
    });
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.endsWith('/kitchens/k1') && (!init || init.method === undefined)) {
        return new Response(JSON.stringify({ id: 'k1', name: 'Morning Prep' }), { status: 200 });
      }
      if (url.endsWith('/users/me/theme') && init?.method === 'PATCH') {
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }
      throw new Error(`Unexpected request: ${url}`);
    });

    renderSettings();
    await waitFor(() =>
      expect(screen.getByTestId('theme-option-simple')).toHaveAttribute('aria-checked', 'true'),
    );

    await user.click(screen.getByTestId('theme-option-dark-neon'));

    expect(document.documentElement.getAttribute('data-theme')).toBe('dark-neon');
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(2));
    const themeCall = fetchSpy.mock.calls.find(([url]) => String(url).includes('/users/me/theme'));
    expect(themeCall).toBeDefined();
    const [, init] = themeCall ?? [];
    expect(JSON.parse(String(init?.body))).toEqual({ theme: 'dark_neon' });
  });

  it('T048: loads the current kitchen name and lets a Chef rename it', async () => {
    const user = userEvent.setup();
    setToken('fake-jwt');
    setUser({
      id: 'u1',
      email: 'chef@kitchenos.dev',
      organizationId: 'o1',
      kitchenId: 'kitchen-1',
      role: 'CHEF',
      themePreference: 'simple',
    });
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async (input, init) => {
        const url = String(input);
        if (url.endsWith('/kitchens/kitchen-1') && (!init || init.method === undefined)) {
          return new Response(JSON.stringify({ id: 'kitchen-1', name: 'Morning Prep' }), {
            status: 200,
          });
        }
        if (url.endsWith('/kitchens/kitchen-1') && init?.method === 'PATCH') {
          return new Response(JSON.stringify({ id: 'kitchen-1', name: 'Evening Line' }), {
            status: 200,
          });
        }
        throw new Error(`Unexpected request: ${url}`);
      });

    renderSettings();

    await waitFor(() => expect(screen.getByDisplayValue('Morning Prep')).toBeInTheDocument());

    await user.clear(screen.getByLabelText('Kitchen name'));
    await user.type(screen.getByLabelText('Kitchen name'), 'Evening Line');
    await user.click(screen.getByRole('button', { name: 'Save name' }));

    await waitFor(() => expect(screen.getByText('Kitchen renamed successfully.')).toBeInTheDocument());
    expect(screen.getByDisplayValue('Evening Line')).toBeInTheDocument();
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    const [, patchInit] = fetchSpy.mock.calls[1];
    expect(patchInit?.method).toBe('PATCH');
    expect(JSON.parse(String(patchInit?.body))).toEqual({ name: 'Evening Line' });
  });

  it('T048: a non-Chef caller sees the kitchen name but no rename action', async () => {
    setToken('fake-jwt');
    setUser({
      id: 'u1',
      email: 'viewer@kitchenos.dev',
      organizationId: 'o1',
      kitchenId: 'kitchen-1',
      role: 'VIEWER',
      themePreference: 'simple',
    });
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ id: 'kitchen-1', name: 'Morning Prep' }), { status: 200 }),
    );

    renderSettings();

    await waitFor(() => expect(screen.getByDisplayValue('Morning Prep')).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: 'Save name' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Kitchen name')).toHaveAttribute('readonly');
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('T048: empty kitchen names are blocked client-side', async () => {
    const user = userEvent.setup();
    setToken('fake-jwt');
    setUser({
      id: 'u1',
      email: 'chef@kitchenos.dev',
      organizationId: 'o1',
      kitchenId: 'kitchen-1',
      role: 'CHEF',
      themePreference: 'simple',
    });
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ id: 'kitchen-1', name: 'Morning Prep' }), { status: 200 }),
    );

    renderSettings();

    await waitFor(() => expect(screen.getByDisplayValue('Morning Prep')).toBeInTheDocument());
    await user.clear(screen.getByLabelText('Kitchen name'));
    expect(screen.getByRole('button', { name: 'Save name' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Save name' }));
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});
