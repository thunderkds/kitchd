import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { AnnouncementsWidget } from './AnnouncementsWidget';
import * as api from './api';

describe('AnnouncementsWidget', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the latest announcements', async () => {
    vi.spyOn(api, 'fetchAnnouncements').mockResolvedValue([
      {
        id: 'ann-1',
        kitchenId: 'k1',
        authorId: 'u1',
        title: 'Deep clean Friday',
        body: 'Everyone please deep clean their station.',
        readBy: [],
        createdAt: '2026-07-01T00:00:00.000Z',
        updatedAt: '2026-07-01T00:00:00.000Z',
      },
    ]);

    render(<AnnouncementsWidget />);

    await waitFor(() =>
      expect(screen.getByTestId('announcement-row-ann-1')).toBeInTheDocument(),
    );
    expect(screen.getByText('Deep clean Friday')).toBeInTheDocument();
  });

  it('shows an empty state when there are no announcements', async () => {
    vi.spyOn(api, 'fetchAnnouncements').mockResolvedValue([]);

    render(<AnnouncementsWidget />);

    await waitFor(() =>
      expect(screen.getByTestId('announcements-empty')).toBeInTheDocument(),
    );
  });

  it('shows an error message if the fetch fails', async () => {
    vi.spyOn(api, 'fetchAnnouncements').mockRejectedValue(new Error('boom'));

    render(<AnnouncementsWidget />);

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('boom'));
  });
});
