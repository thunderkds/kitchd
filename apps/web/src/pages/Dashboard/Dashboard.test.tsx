import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { Dashboard } from './Dashboard';
import * as tasksApi from '../../features/tasks/api';
import * as lowStockApi from '../../components/LowStockWidget/api';
import * as announcementsApi from '../../components/AnnouncementsWidget/api';
import * as notesApi from '../../features/notes/api';
import { setUser, clearUser } from '../../routes/auth';
import type { Task } from '../../features/tasks/types';

const task = (overrides: Partial<Task> = {}): Task => ({
  id: 't1',
  kitchenId: 'k1',
  title: 'Prep station A',
  status: 'TODO',
  assigneeId: null,
  dueAt: null,
  checklistItems: [],
  createdAt: '2026-07-01T00:00:00.000Z',
  updatedAt: '2026-07-01T00:00:00.000Z',
  ...overrides,
});

describe('Dashboard', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(lowStockApi, 'fetchLowStock').mockResolvedValue([]);
    vi.spyOn(announcementsApi, 'fetchAnnouncements').mockResolvedValue([]);
    vi.spyOn(notesApi, 'listNotes').mockResolvedValue([]);
  });

  afterEach(() => {
    clearUser();
  });

  it('AC1: loads all four widgets from their respective endpoints', async () => {
    vi.spyOn(tasksApi, 'listTasks').mockResolvedValue([task()]);
    setUser({ id: 'u1', email: 'a@b.com', organizationId: 'o1', kitchenId: 'k1', role: 'CHEF' });

    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByTestId('tasks-widget')).toBeInTheDocument();
      expect(screen.getByTestId('low-stock-widget')).toBeInTheDocument();
      expect(screen.getByTestId('announcements-widget')).toBeInTheDocument();
      expect(screen.getByTestId('pinned-notes-widget')).toBeInTheDocument();
    });
  });

  it('AC2: a Staff-role user only sees their own assigned Tasks', async () => {
    vi.spyOn(tasksApi, 'listTasks').mockResolvedValue([
      task({ id: 't-mine', assigneeId: 'u1', title: 'Mine' }),
      task({ id: 't-other', assigneeId: 'u2', title: 'Not mine' }),
    ]);
    setUser({ id: 'u1', email: 'a@b.com', organizationId: 'o1', kitchenId: 'k1', role: 'STAFF' });

    render(<Dashboard />);

    await waitFor(() =>
      expect(screen.getByTestId('tasks-widget-row-t-mine')).toBeInTheDocument(),
    );
    expect(screen.queryByTestId('tasks-widget-row-t-other')).not.toBeInTheDocument();
    expect(screen.getByText('My Tasks')).toBeInTheDocument();
  });

  it('AC2: a Chef-role user sees all Kitchen Tasks', async () => {
    vi.spyOn(tasksApi, 'listTasks').mockResolvedValue([
      task({ id: 't-mine', assigneeId: 'u1', title: 'Mine' }),
      task({ id: 't-other', assigneeId: 'u2', title: 'Not mine' }),
    ]);
    setUser({ id: 'u1', email: 'a@b.com', organizationId: 'o1', kitchenId: 'k1', role: 'CHEF' });

    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByTestId('tasks-widget-row-t-mine')).toBeInTheDocument();
      expect(screen.getByTestId('tasks-widget-row-t-other')).toBeInTheDocument();
    });
    expect(screen.getByText('Kitchen Tasks')).toBeInTheDocument();
  });

  it('AC4: a Kitchen with zero data shows a clean empty state per widget', async () => {
    vi.spyOn(tasksApi, 'listTasks').mockResolvedValue([]);
    setUser({ id: 'u1', email: 'a@b.com', organizationId: 'o1', kitchenId: 'k1', role: 'OWNER' });

    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByTestId('tasks-widget-empty')).toBeInTheDocument();
      expect(screen.getByTestId('low-stock-empty')).toBeInTheDocument();
      expect(screen.getByTestId('announcements-empty')).toBeInTheDocument();
      expect(screen.getByTestId('pinned-notes-empty')).toBeInTheDocument();
    });
  });

  it('does not waterfall: all four fetches are in flight before any resolves', async () => {
    // Structural guarantee check — each widget's own useEffect fires its
    // fetch synchronously on mount with no shared parent-level await, so
    // by the time this microtask runs, all four spies must already have
    // been called exactly once, before any of their promises resolved.
    const tasksSpy = vi.spyOn(tasksApi, 'listTasks').mockResolvedValue([]);
    const lowStockSpy = vi.spyOn(lowStockApi, 'fetchLowStock').mockResolvedValue([]);
    const announcementsSpy = vi
      .spyOn(announcementsApi, 'fetchAnnouncements')
      .mockResolvedValue([]);
    const notesSpy = vi.spyOn(notesApi, 'listNotes').mockResolvedValue([]);
    setUser({ id: 'u1', email: 'a@b.com', organizationId: 'o1', kitchenId: 'k1', role: 'OWNER' });

    render(<Dashboard />);

    expect(tasksSpy).toHaveBeenCalledTimes(1);
    expect(lowStockSpy).toHaveBeenCalledTimes(1);
    expect(announcementsSpy).toHaveBeenCalledTimes(1);
    expect(notesSpy).toHaveBeenCalledTimes(1);
  });
});
