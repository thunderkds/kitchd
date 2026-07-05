import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NotificationBell } from './NotificationBell';
import * as api from './api';

describe('NotificationBell', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('shows the unread count badge on mount', async () => {
    vi.spyOn(api, 'fetchNotifications').mockResolvedValue({
      notifications: [
        {
          id: 'n-1',
          type: 'MENTION',
          body: 'You were mentioned',
          read: false,
          createdAt: new Date().toISOString(),
        },
      ],
      unreadCount: 1,
    });

    render(<NotificationBell />);

    await waitFor(() =>
      expect(screen.getByTestId('notification-unread-badge')).toHaveTextContent('1'),
    );
  });

  it('does not show a badge when unread count is zero', async () => {
    vi.spyOn(api, 'fetchNotifications').mockResolvedValue({
      notifications: [],
      unreadCount: 0,
    });

    render(<NotificationBell />);

    await waitFor(() =>
      expect(api.fetchNotifications).toHaveBeenCalled(),
    );
    expect(screen.queryByTestId('notification-unread-badge')).not.toBeInTheDocument();
  });

  it('opens the dropdown and lists notifications', async () => {
    vi.spyOn(api, 'fetchNotifications').mockResolvedValue({
      notifications: [
        {
          id: 'n-2',
          type: 'LOW_STOCK',
          body: 'Flour is low',
          read: false,
          createdAt: new Date().toISOString(),
        },
      ],
      unreadCount: 1,
    });
    vi.spyOn(api, 'markNotificationsRead').mockResolvedValue({ unreadCount: 0 });

    const user = userEvent.setup();
    render(<NotificationBell />);

    await waitFor(() => expect(api.fetchNotifications).toHaveBeenCalled());
    await user.click(screen.getByTestId('notification-bell-button'));

    await waitFor(() =>
      expect(screen.getByTestId('notification-n-2')).toBeInTheDocument(),
    );
    expect(screen.getByText('Flour is low')).toBeInTheDocument();
  });

  it('AC2: opening the bell marks notifications read and clears the badge', async () => {
    vi.spyOn(api, 'fetchNotifications').mockResolvedValue({
      notifications: [
        {
          id: 'n-3',
          type: 'MENTION',
          body: 'You were mentioned',
          read: false,
          createdAt: new Date().toISOString(),
        },
      ],
      unreadCount: 1,
    });
    const markReadSpy = vi
      .spyOn(api, 'markNotificationsRead')
      .mockResolvedValue({ unreadCount: 0 });

    const user = userEvent.setup();
    render(<NotificationBell />);

    await waitFor(() =>
      expect(screen.getByTestId('notification-unread-badge')).toHaveTextContent('1'),
    );

    await user.click(screen.getByTestId('notification-bell-button'));

    await waitFor(() => expect(markReadSpy).toHaveBeenCalled());
    await waitFor(() =>
      expect(screen.queryByTestId('notification-unread-badge')).not.toBeInTheDocument(),
    );
  });

  it('shows an empty state when there are no notifications', async () => {
    vi.spyOn(api, 'fetchNotifications').mockResolvedValue({
      notifications: [],
      unreadCount: 0,
    });
    vi.spyOn(api, 'markNotificationsRead').mockResolvedValue({ unreadCount: 0 });

    const user = userEvent.setup();
    render(<NotificationBell />);

    await waitFor(() => expect(api.fetchNotifications).toHaveBeenCalled());
    await user.click(screen.getByTestId('notification-bell-button'));

    await waitFor(() =>
      expect(screen.getByTestId('notification-empty')).toBeInTheDocument(),
    );
  });

  it('shows an error message if the fetch fails', async () => {
    vi.spyOn(api, 'fetchNotifications').mockRejectedValue(new Error('boom'));
    vi.spyOn(api, 'markNotificationsRead').mockResolvedValue({ unreadCount: 0 });

    render(<NotificationBell />);

    const user = userEvent.setup();
    await user.click(screen.getByTestId('notification-bell-button'));

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('boom'));
  });
});
