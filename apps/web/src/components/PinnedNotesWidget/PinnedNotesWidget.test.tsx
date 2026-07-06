import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { PinnedNotesWidget } from './PinnedNotesWidget';
import * as api from '../../features/notes/api';
import type { Note } from '../../features/notes/types';

const baseNote: Note = {
  id: 'note-1',
  kitchenId: 'k1',
  authorId: 'u1',
  title: 'Prep list',
  body: 'Chop onions first.',
  tags: [],
  pinned: true,
  linkedEntityType: null,
  linkedEntityId: null,
  createdAt: '2026-07-01T00:00:00.000Z',
  updatedAt: '2026-07-01T00:00:00.000Z',
};

describe('PinnedNotesWidget', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders only pinned notes', async () => {
    vi.spyOn(api, 'listNotes').mockResolvedValue([
      baseNote,
      { ...baseNote, id: 'note-2', pinned: false, title: 'Unpinned' },
    ]);

    render(<PinnedNotesWidget />);

    await waitFor(() =>
      expect(screen.getByTestId('pinned-note-row-note-1')).toBeInTheDocument(),
    );
    expect(screen.queryByText('Unpinned')).not.toBeInTheDocument();
  });

  it('shows an empty state when there are no pinned notes', async () => {
    vi.spyOn(api, 'listNotes').mockResolvedValue([
      { ...baseNote, pinned: false },
    ]);

    render(<PinnedNotesWidget />);

    await waitFor(() =>
      expect(screen.getByTestId('pinned-notes-empty')).toBeInTheDocument(),
    );
  });

  it('shows an error message if the fetch fails', async () => {
    vi.spyOn(api, 'listNotes').mockRejectedValue(new Error('boom'));

    render(<PinnedNotesWidget />);

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('boom'));
  });
});
