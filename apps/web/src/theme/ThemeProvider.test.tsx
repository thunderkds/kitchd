import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider, useTheme } from './ThemeProvider';
import { setUser, clearUser, setToken, clearToken, getUser } from '../routes/auth';

function Probe() {
  const { theme, setTheme } = useTheme();
  return (
    <div>
      <span data-testid="theme-value">{theme}</span>
      <button type="button" onClick={() => setTheme('dark-neon')}>
        switch
      </button>
    </div>
  );
}

describe('ThemeProvider (T026)', () => {
  afterEach(() => {
    clearUser();
    clearToken();
    window.localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    vi.restoreAllMocks();
  });

  it('AC5: logged-out view (no stored user) reconciles to "simple", no network call', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('theme-value')).toHaveTextContent('simple'));
    expect(document.documentElement.getAttribute('data-theme')).toBe('simple');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('AC6: falls back to "simple" when the cached paint-time value is invalid/unrecognized', async () => {
    window.localStorage.setItem('kitchenos-theme', 'not-a-real-theme');
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('theme-value')).toHaveTextContent('simple'));
  });

  it('reconciles data-theme to the authenticated user\'s stored themePreference', async () => {
    setUser({
      id: 'u1',
      email: 'a@b.com',
      organizationId: 'o1',
      kitchenId: 'k1',
      role: 'OWNER',
      themePreference: 'dark-neon',
    });
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('theme-value')).toHaveTextContent('dark-neon'));
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark-neon');
  });

  it('AC4: selecting a theme updates data-theme immediately (optimistic) and calls the T025 endpoint with the translated (snake_case) value', async () => {
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
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));

    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('theme-value')).toHaveTextContent('simple'));

    await user.click(screen.getByText('switch'));

    expect(screen.getByTestId('theme-value')).toHaveTextContent('dark-neon');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark-neon');
    expect(getUser()?.themePreference).toBe('dark-neon');

    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1));
    const [url, init] = fetchSpy.mock.calls[0];
    expect(String(url)).toContain('/users/me/theme');
    expect(JSON.parse(String(init?.body))).toEqual({ theme: 'dark_neon' });
  });

  it('rolls back the optimistic update if the PATCH call fails', async () => {
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
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 500 }));

    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('theme-value')).toHaveTextContent('simple'));

    await user.click(screen.getByText('switch'));

    await waitFor(() => expect(screen.getByTestId('theme-value')).toHaveTextContent('simple'));
    expect(document.documentElement.getAttribute('data-theme')).toBe('simple');
  });
});
