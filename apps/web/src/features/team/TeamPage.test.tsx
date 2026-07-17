import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { TeamPage } from './TeamPage';
import type { Member, Invite } from './types';
import { setUser } from '../../routes/auth';

function makeMember(overrides: Partial<Member> = {}): Member {
  return {
    id: 'm1',
    email: 'member@example.com',
    role: 'STAFF',
    isActive: true,
    ...overrides,
  };
}

function makeInvite(overrides: Partial<Invite> = {}): Invite {
  return {
    id: 'i1',
    email: 'invitee@example.com',
    role: 'STAFF',
    status: 'PENDING',
    token: 'tok',
    expiresAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

function setOwner() {
  setUser({
    id: 'owner-1',
    email: 'owner@example.com',
    organizationId: 'org-1',
    kitchenId: 'kitchen-1',
    role: 'OWNER',
  });
}

function setStaff() {
  setUser({
    id: 'staff-1',
    email: 'staff@example.com',
    organizationId: 'org-1',
    kitchenId: 'kitchen-1',
    role: 'STAFF',
  });
}

describe('TeamPage', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    window.localStorage.setItem('accessToken', 'test-token');
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    window.localStorage.clear();
  });

  it('Owner sees member list with roles and management controls', async () => {
    setOwner();
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [makeMember({ id: 'm1', email: 'staff@example.com', role: 'STAFF' })],
      })
      .mockResolvedValueOnce({ ok: true, json: async () => [] });

    render(
      <MemoryRouter>
        <TeamPage />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByTestId('members-list')).toBeInTheDocument());
    expect(screen.getByText('staff@example.com')).toBeInTheDocument();
    const row = screen.getByTestId('member-m1');
    expect(within(row).getByRole('combobox')).toBeInTheDocument();
    expect(within(row).getByRole('button', { name: 'Remove' })).toBeInTheDocument();
  });

  it('Owner changing a member role PATCHes /users/:id/role', async () => {
    setOwner();
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [makeMember({ id: 'm1', role: 'STAFF' })],
      })
      .mockResolvedValueOnce({ ok: true, json: async () => [] })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => makeMember({ id: 'm1', role: 'CHEF' }),
      });

    const { default: userEvent } = await import('@testing-library/user-event');
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <TeamPage />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByTestId('member-m1')).toBeInTheDocument());
    const select = within(screen.getByTestId('member-m1')).getByRole('combobox');
    await user.selectOptions(select, 'CHEF');

    await waitFor(() =>
      expect(fetchMock).toHaveBeenLastCalledWith(
        expect.stringContaining('/users/m1/role'),
        expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ role: 'CHEF' }) }),
      ),
    );
  });

  it('Owner removing a member calls DELETE /users/:id and removes the row', async () => {
    setOwner();
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [makeMember({ id: 'm1' })],
      })
      .mockResolvedValueOnce({ ok: true, json: async () => [] })
      .mockResolvedValueOnce({ ok: true, json: async () => makeMember({ id: 'm1', isActive: false }) });

    const { default: userEvent } = await import('@testing-library/user-event');
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <TeamPage />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByTestId('member-m1')).toBeInTheDocument());
    await user.click(within(screen.getByTestId('member-m1')).getByRole('button', { name: 'Remove' }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenLastCalledWith(
        expect.stringContaining('/users/m1'),
        expect.objectContaining({ method: 'DELETE' }),
      ),
    );
    await waitFor(() => expect(screen.queryByTestId('member-m1')).not.toBeInTheDocument());
  });

  it('sending an invite POSTs /users/invite and shows success + adds to pending list', async () => {
    setOwner();
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => [] })
      .mockResolvedValueOnce({ ok: true, json: async () => [] })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => makeInvite({ id: 'i2', email: 'new@example.com' }),
      });

    const { default: userEvent } = await import('@testing-library/user-event');
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <TeamPage />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByLabelText('Invite email')).toBeInTheDocument());
    await user.type(screen.getByLabelText('Invite email'), 'new@example.com');
    await user.click(screen.getByRole('button', { name: 'Send Invite' }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenLastCalledWith(
        expect.stringContaining('/users/invite'),
        expect.objectContaining({ method: 'POST' }),
      ),
    );
    expect(await screen.findByText('Invite sent to new@example.com')).toBeInTheDocument();
    expect(screen.getByTestId('invite-i2')).toBeInTheDocument();
  });

  it('revoking a pending invite calls DELETE /users/invites/:id and removes it', async () => {
    setOwner();
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => [] })
      .mockResolvedValueOnce({ ok: true, json: async () => [makeInvite({ id: 'i1' })] })
      .mockResolvedValueOnce({ ok: true, json: async () => makeInvite({ id: 'i1', status: 'REVOKED' }) });

    const { default: userEvent } = await import('@testing-library/user-event');
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <TeamPage />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByTestId('invite-i1')).toBeInTheDocument());
    await user.click(within(screen.getByTestId('invite-i1')).getByRole('button', { name: 'Revoke' }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenLastCalledWith(
        expect.stringContaining('/users/invites/i1'),
        expect.objectContaining({ method: 'DELETE' }),
      ),
    );
    await waitFor(() => expect(screen.queryByTestId('invite-i1')).not.toBeInTheDocument());
  });

  it('a non-Owner/Admin sees a restricted view, no management controls, and no team fetch (T027 gates GET /users to Owner/Admin)', async () => {
    setStaff();

    render(
      <MemoryRouter>
        <TeamPage />
      </MemoryRouter>,
    );

    expect(
      await screen.findByText('Team management is available to Owners and Admins only.'),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText('Invite email')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Remove' })).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(screen.queryByTestId('invites-list')).not.toBeInTheDocument();
    expect(screen.queryByTestId('members-list')).not.toBeInTheDocument();
    // No calls at all — GET /users is Owner/Admin-only server-side, so a
    // non-manager caller must never fetch it (it would just 403).
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("the caller's own row never shows management controls even for Owner", async () => {
    setOwner();
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [makeMember({ id: 'owner-1', email: 'owner@example.com', role: 'OWNER' })],
      })
      .mockResolvedValueOnce({ ok: true, json: async () => [] });

    render(
      <MemoryRouter>
        <TeamPage />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByTestId('member-owner-1')).toBeInTheDocument());
    expect(
      within(screen.getByTestId('member-owner-1')).queryByRole('button', { name: 'Remove' }),
    ).not.toBeInTheDocument();
    expect(
      within(screen.getByTestId('member-owner-1')).queryByRole('combobox'),
    ).not.toBeInTheDocument();
  });

  it('empty states render sensibly for zero members and zero invites', async () => {
    setOwner();
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => [] })
      .mockResolvedValueOnce({ ok: true, json: async () => [] });

    render(
      <MemoryRouter>
        <TeamPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText('No members yet.')).toBeInTheDocument();
    expect(await screen.findByText('No pending invites.')).toBeInTheDocument();
  });

  it('a failed role-change shows an error and reverts the row', async () => {
    setOwner();
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [makeMember({ id: 'm1', role: 'STAFF' })],
      })
      .mockResolvedValueOnce({ ok: true, json: async () => [] })
      .mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({ message: 'Server error' }) });

    const { default: userEvent } = await import('@testing-library/user-event');
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <TeamPage />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByTestId('member-m1')).toBeInTheDocument());
    const select = within(screen.getByTestId('member-m1')).getByRole('combobox');
    await user.selectOptions(select, 'CHEF');

    expect(await screen.findByText('Server error')).toBeInTheDocument();
    await waitFor(() =>
      expect((within(screen.getByTestId('member-m1')).getByRole('combobox') as HTMLSelectElement).value).toBe(
        'STAFF',
      ),
    );
  });
});
