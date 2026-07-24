import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

describe('SettingsPage (T026)', () => {
  afterEach(() => {
    clearUser();
    clearToken();
    window.localStorage.clear();
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
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));

    renderSettings();
    await waitFor(() =>
      expect(screen.getByTestId('theme-option-simple')).toHaveAttribute('aria-checked', 'true'),
    );

    await user.click(screen.getByTestId('theme-option-dark-neon'));

    expect(document.documentElement.getAttribute('data-theme')).toBe('dark-neon');
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1));
    const [url, init] = fetchSpy.mock.calls[0];
    expect(String(url)).toContain('/users/me/theme');
    expect(JSON.parse(String(init?.body))).toEqual({ theme: 'dark_neon' });
  });
});
