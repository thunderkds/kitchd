import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import App from '../../App';
import { AcceptInvitePage } from './AcceptInvitePage';
import { getUser, setUser } from '../auth';

/**
 * T043 — AC4-AC9. The invite-accept page is the invitee's only way into an
 * existing kitchen; every path through it is checked here except AC5 (correct
 * tenant), which a mocked fetch cannot prove and is verified live instead.
 */

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/invite/accept" element={<AcceptInvitePage />} />
        <Route path="/dashboard" element={<div>Dashboard</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

const AUTH_RESULT = {
  accessToken: 'jwt-for-invitee',
  user: {
    id: 'u-new',
    email: 'newchef@example.com',
    organizationId: 'org-1',
    kitchenId: 'kitchen-1',
    role: 'CHEF',
    themePreference: 'dark_neon',
  },
};

describe('AcceptInvitePage', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    window.localStorage.clear();
  });

  it('renders for a logged-out visitor and is not intercepted by AuthGuard (AC4)', async () => {
    // Rendered through the real App route table, with no token in storage —
    // a route registered inside AuthGuard would redirect to /login here.
    render(
      <MemoryRouter initialEntries={['/invite/accept?token=tok-123']}>
        <App />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('button', { name: 'Accept invitation' })).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Organization name')).not.toBeInTheDocument();
  });

  it('accepting with a valid token POSTs the token and password, stores the session and lands on the dashboard (AC5, client half)', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => AUTH_RESULT });
    const { default: userEvent } = await import('@testing-library/user-event');
    const user = userEvent.setup();

    renderAt('/invite/accept?token=tok-123');

    await user.type(screen.getByLabelText('Password'), 'Password123!');
    await user.type(screen.getByLabelText('Confirm password'), 'Password123!');
    await user.click(screen.getByRole('button', { name: 'Accept invitation' }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/users/invite/accept'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ token: 'tok-123', password: 'Password123!' }),
        }),
      ),
    );
    expect(await screen.findByText('Dashboard')).toBeInTheDocument();
    expect(window.localStorage.getItem('accessToken')).toBe('jwt-for-invitee');
    const stored = getUser();
    expect(stored?.kitchenId).toBe('kitchen-1');
    expect(stored?.role).toBe('CHEF');
    // snake_case -> kebab-case via themeMapping.ts, never stored raw.
    expect(stored?.themePreference).toBe('dark-neon');
  });

  it('an invalid, used, revoked or expired token shows the backend 404 message and stores no session (AC6)', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: async () => ({ message: 'Invite not found or already used' }),
    });
    const { default: userEvent } = await import('@testing-library/user-event');
    const user = userEvent.setup();

    renderAt('/invite/accept?token=stale-token');

    await user.type(screen.getByLabelText('Password'), 'Password123!');
    await user.type(screen.getByLabelText('Confirm password'), 'Password123!');
    await user.click(screen.getByRole('button', { name: 'Accept invitation' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Invite not found or already used');
    expect(screen.queryByText('Dashboard')).not.toBeInTheDocument();
    expect(window.localStorage.getItem('accessToken')).toBeNull();
    // The backend collapses expired into 404 on purpose — never claim "expired".
    expect(screen.queryByText(/expired/i)).not.toBeInTheDocument();
  });

  it('an email that already has an account shows the 409 message and creates nothing (AC7)', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 409,
      json: async () => ({ message: 'An account already exists for this email' }),
    });
    const { default: userEvent } = await import('@testing-library/user-event');
    const user = userEvent.setup();

    renderAt('/invite/accept?token=tok-123');

    await user.type(screen.getByLabelText('Password'), 'Password123!');
    await user.type(screen.getByLabelText('Confirm password'), 'Password123!');
    await user.click(screen.getByRole('button', { name: 'Accept invitation' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'An account already exists for this email',
    );
    expect(window.localStorage.getItem('accessToken')).toBeNull();
  });

  it('a password under 8 characters is blocked with zero network calls (AC8)', async () => {
    const { default: userEvent } = await import('@testing-library/user-event');
    const user = userEvent.setup();

    renderAt('/invite/accept?token=tok-123');

    await user.type(screen.getByLabelText('Password'), 'short');
    await user.type(screen.getByLabelText('Confirm password'), 'short');
    await user.click(screen.getByRole('button', { name: 'Accept invitation' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Password must be at least 8 characters.',
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('a confirm-password mismatch is blocked with zero network calls', async () => {
    const { default: userEvent } = await import('@testing-library/user-event');
    const user = userEvent.setup();

    renderAt('/invite/accept?token=tok-123');

    await user.type(screen.getByLabelText('Password'), 'Password123!');
    await user.type(screen.getByLabelText('Confirm password'), 'Password124!');
    await user.click(screen.getByRole('button', { name: 'Accept invitation' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Passwords do not match.');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('a missing token shows a clear message, no form and no request (AC9)', async () => {
    renderAt('/invite/accept');

    expect(await screen.findByTestId('missing-token')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Accept invitation' })).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('an empty token param is treated the same as a missing one (AC9)', async () => {
    renderAt('/invite/accept?token=');

    expect(await screen.findByTestId('missing-token')).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('a rapid double-click fires only one POST', async () => {
    let resolveFetch: ((value: unknown) => void) | undefined;
    fetchMock.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveFetch = resolve;
      }),
    );
    const { default: userEvent } = await import('@testing-library/user-event');
    const user = userEvent.setup();

    renderAt('/invite/accept?token=tok-123');

    await user.type(screen.getByLabelText('Password'), 'Password123!');
    await user.type(screen.getByLabelText('Confirm password'), 'Password123!');
    const submitButton = screen.getByRole('button', { name: 'Accept invitation' });
    await user.click(submitButton);
    await user.click(submitButton);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    resolveFetch?.({ ok: true, json: async () => AUTH_RESULT });
  });

  it('warns a visitor who is already signed in as someone else that the session will be replaced', async () => {
    setUser({
      id: 'owner-1',
      email: 'owner@example.com',
      organizationId: 'org-1',
      kitchenId: 'kitchen-1',
      role: 'OWNER',
    });

    renderAt('/invite/accept?token=tok-123');

    expect(await screen.findByTestId('signed-in-notice')).toHaveTextContent(
      'You are signed in as owner@example.com',
    );
  });
});
