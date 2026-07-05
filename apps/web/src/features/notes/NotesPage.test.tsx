import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { NotesPage } from './NotesPage';
import type { Note } from './types';

function makeNote(overrides: Partial<Note> = {}): Note {
  return {
    id: 'note-1',
    kitchenId: 'kitchen-1',
    authorId: 'user-1',
    title: null,
    body: 'A note',
    tags: [],
    pinned: false,
    linkedEntityType: null,
    linkedEntityId: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('NotesPage', () => {
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

  it('renders Team Notes by default, pinned notes first', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => [
        makeNote({ id: 'n1', body: 'Regular note' }),
        makeNote({ id: 'n2', body: 'Pinned note', pinned: true }),
      ],
    });

    render(
      <MemoryRouter>
        <NotesPage />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByTestId('notes-list')).toBeInTheDocument());
    expect(screen.getByText('Regular note')).toBeInTheDocument();
    expect(screen.getByText('Pinned note')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('scope=team'),
      expect.anything(),
    );
  });

  it('toggling to My Notes refetches with scope=mine', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => [] });

    const { default: userEvent } = await import('@testing-library/user-event');
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <NotesPage />
      </MemoryRouter>,
    );

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    await user.click(screen.getByRole('button', { name: 'My Notes' }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenLastCalledWith(
        expect.stringContaining('scope=mine'),
        expect.anything(),
      ),
    );
  });

  it('clicking Pin PATCHes the note to pinned=true', async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [makeNote({ id: 'n1', body: 'Regular note', pinned: false })],
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => makeNote({ id: 'n1', body: 'Regular note', pinned: true }),
      });

    const { default: userEvent } = await import('@testing-library/user-event');
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <NotesPage />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByText('Regular note')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Pin' }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenLastCalledWith(
        expect.stringContaining('/notes/n1'),
        expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ pinned: true }) }),
      ),
    );
  });

  it('a note linked to a deleted entity shows "linked item no longer exists"', async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [
          makeNote({
            id: 'n1',
            body: 'Linked note',
            linkedEntityType: 'task',
            linkedEntityId: 'gone-task',
          }),
        ],
      })
      .mockResolvedValueOnce({ ok: false, status: 404, json: async () => ({}) });

    render(
      <MemoryRouter>
        <NotesPage />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByText('Linked note')).toBeInTheDocument());
    await waitFor(() =>
      expect(screen.getByTestId('linked-entity-missing')).toBeInTheDocument(),
    );
  });
});
