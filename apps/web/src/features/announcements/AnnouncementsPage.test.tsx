import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import { AnnouncementsPage } from './AnnouncementsPage';
import type { Announcement } from './types';
import { setUser } from '../../routes/auth';
import * as api from './api';

function makeAnnouncement(overrides: Partial<Announcement> = {}): Announcement {
  return {
    id: 'ann-1',
    kitchenId: 'kitchen-1',
    authorId: 'owner-1',
    title: 'Deep clean Friday',
    body: 'Everyone please deep clean their station.',
    readBy: [],
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z',
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

function setChef() {
  setUser({
    id: 'chef-1',
    email: 'chef@example.com',
    organizationId: 'org-1',
    kitchenId: 'kitchen-1',
    role: 'CHEF',
  });
}

function setAdmin() {
  setUser({
    id: 'admin-1',
    email: 'admin@example.com',
    organizationId: 'org-1',
    kitchenId: 'kitchen-1',
    role: 'ADMIN',
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

describe('AnnouncementsPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the full announcement history for an Owner', async () => {
    setOwner();
    vi.spyOn(api, 'listAnnouncements').mockResolvedValue([
      makeAnnouncement({ id: 'ann-1', title: 'First' }),
      makeAnnouncement({ id: 'ann-2', title: 'Second' }),
    ]);

    render(<AnnouncementsPage />);

    await waitFor(() => expect(screen.getByText('First')).toBeInTheDocument());
    expect(screen.getByText('Second')).toBeInTheDocument();
  });

  it('shows a New Announcement button for an Owner that opens the broadcast modal', async () => {
    setOwner();
    vi.spyOn(api, 'listAnnouncements').mockResolvedValue([]);

    render(<AnnouncementsPage />);

    await waitFor(() => expect(screen.getByTestId('announcements-empty')).toBeInTheDocument());
    // Form is not inline — it only appears in a modal after clicking the button.
    expect(screen.queryByTestId('announcement-broadcast-form')).not.toBeInTheDocument();
    const button = screen.getByRole('button', { name: 'New Announcement' });
    expect(button).toBeInTheDocument();

    const user = (await import('@testing-library/user-event')).default.setup();
    await user.click(button);
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByTestId('announcement-broadcast-form')).toBeInTheDocument();
  });

  it('shows a New Announcement button for a Chef', async () => {
    setChef();
    vi.spyOn(api, 'listAnnouncements').mockResolvedValue([]);

    render(<AnnouncementsPage />);

    await waitFor(() => expect(screen.getByTestId('announcements-empty')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'New Announcement' })).toBeInTheDocument();
  });

  it('does NOT show the New Announcement button for an Admin and never calls createAnnouncement', async () => {
    setAdmin();
    const listSpy = vi.spyOn(api, 'listAnnouncements').mockResolvedValue([makeAnnouncement()]);
    const createSpy = vi.spyOn(api, 'createAnnouncement');

    render(<AnnouncementsPage />);

    await waitFor(() => expect(listSpy).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByText('Deep clean Friday')).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: 'New Announcement' })).not.toBeInTheDocument();
    expect(screen.queryByTestId('announcement-broadcast-form')).not.toBeInTheDocument();
    expect(createSpy).not.toHaveBeenCalled();
  });

  it('does NOT show the New Announcement button for Staff', async () => {
    setStaff();
    vi.spyOn(api, 'listAnnouncements').mockResolvedValue([]);

    render(<AnnouncementsPage />);

    await waitFor(() => expect(screen.getByTestId('announcements-empty')).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: 'New Announcement' })).not.toBeInTheDocument();
    expect(screen.queryByTestId('announcement-broadcast-form')).not.toBeInTheDocument();
  });

  it('broadcasts a new announcement from the modal and updates the list without a full reload', async () => {
    setOwner();
    vi.spyOn(api, 'listAnnouncements').mockResolvedValue([]);
    const created = makeAnnouncement({ id: 'ann-new', title: 'New one', body: 'Body text' });
    const createSpy = vi.spyOn(api, 'createAnnouncement').mockResolvedValue(created);

    render(<AnnouncementsPage />);

    await waitFor(() => expect(screen.getByTestId('announcements-empty')).toBeInTheDocument());

    const user = (await import('@testing-library/user-event')).default.setup();
    await user.click(screen.getByRole('button', { name: 'New Announcement' }));

    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText(/title/i), 'New one');
    await user.type(within(dialog).getByLabelText(/message/i), 'Body text');
    await user.click(within(dialog).getByRole('button', { name: /broadcast/i }));

    await waitFor(() => expect(createSpy).toHaveBeenCalledWith({ title: 'New one', body: 'Body text' }));
    // Modal closes on success and the new announcement appears in the feed.
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(screen.getByText('New one')).toBeInTheDocument());
  });

  it('shows read-receipt status per announcement', async () => {
    setOwner();
    vi.spyOn(api, 'listAnnouncements').mockResolvedValue([
      makeAnnouncement({ id: 'ann-1', readBy: ['u1', 'u2'] }),
    ]);

    render(<AnnouncementsPage />);

    await waitFor(() => expect(screen.getByTestId('announcement-row-ann-1')).toBeInTheDocument());
    expect(screen.getByText(/read by 2/i)).toBeInTheDocument();
  });

  it('shows an empty state when there are no announcements', async () => {
    setOwner();
    vi.spyOn(api, 'listAnnouncements').mockResolvedValue([]);

    render(<AnnouncementsPage />);

    await waitFor(() => expect(screen.getByTestId('announcements-empty')).toBeInTheDocument());
  });

  it('surfaces fetch errors via role="alert" (global error dialog also fires through notifyApiError in api.ts)', async () => {
    setOwner();
    vi.spyOn(api, 'listAnnouncements').mockRejectedValue(new Error('boom'));

    render(<AnnouncementsPage />);

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('boom'));
  });
});
