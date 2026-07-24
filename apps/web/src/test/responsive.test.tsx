import { describe, expect, it, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { KanbanBoard } from '../features/tasks/KanbanBoard';
import { ListView } from '../features/tasks/ListView';
import { TasksWidget } from '../pages/Dashboard/TasksWidget';
import { LowStockWidget } from '../components/LowStockWidget/LowStockWidget';
import { NotesPage } from '../features/notes/NotesPage';
import * as tasksApi from '../features/tasks/api';
import * as lowStockApi from '../components/LowStockWidget/api';
import * as notesApi from '../features/notes/api';
import { setUser, clearUser } from '../routes/auth';
import type { Task } from '../features/tasks/types';
import type { Note } from '../features/notes/types';

// T021 — mobile responsive pass (NFR-005, US-011). These are structural
// proxy checks: jsdom can't lay out real overflow, so we assert the CSS
// contract (min-w-0 + truncate on the growing flex child, shrink-0 on the
// fixed sibling, overflow-x-auto scoped to the board not the page) that
// prevents a long name/title from pushing a flex row wider than its
// container at 375px.

const LONG_NAME = 'Extra-Virgin-Cold-Pressed-Sicilian-Style-Olive-Oil-Premium-500ml-Bottle';

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    kitchenId: 'kitchen-1',
    title: LONG_NAME,
    status: 'TODO',
    assigneeId: null,
    dueAt: null,
    checklistItems: [],
    sourceRecipeId: null,
    sourceGuidelineId: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('Mobile responsive pass (T021)', () => {
  afterEach(() => {
    clearUser();
    vi.restoreAllMocks();
  });

  it('AC1/AC2: KanbanBoard scrolls internally (overflow-x-auto), never at the page level', () => {
    render(<KanbanBoard tasks={[makeTask()]} onMove={vi.fn()} />);
    const board = screen.getByTestId('kanban-board');
    expect(board.className).toMatch(/overflow-x-auto/);
  });

  it('AC3: ListView title truncates instead of overflowing the row', () => {
    render(
      <ListView tasks={[makeTask()]} onToggleChecklistItem={vi.fn()} />,
    );
    const title = screen.getByText(LONG_NAME);
    expect(title.className).toMatch(/truncate/);
    expect(title.className).toMatch(/min-w-0/);
  });

  it('AC3: Dashboard TasksWidget row truncates a long title, status stays fixed-width', async () => {
    vi.spyOn(tasksApi, 'listTasks').mockResolvedValue([makeTask()]);
    setUser({ id: 'u1', email: 'a@b.com', organizationId: 'o1', kitchenId: 'k1', role: 'OWNER' });

    render(<TasksWidget />);

    const title = await screen.findByText(LONG_NAME);
    expect(title.className).toMatch(/truncate/);
    const status = screen.getByText('TODO');
    expect(status.className).toMatch(/shrink-0/);
  });

  it('AC3: LowStockWidget row truncates a long ingredient name', async () => {
    vi.spyOn(lowStockApi, 'fetchLowStock').mockResolvedValue([
      {
        id: 'ing-1',
        name: LONG_NAME,
        currentStock: 1,
        unit: 'kg',
        minThreshold: 5,
      },
    ]);

    render(<LowStockWidget />);

    const name = await screen.findByText(LONG_NAME);
    expect(name.className).toMatch(/truncate/);
    expect(name.className).toMatch(/min-w-0/);
  });

  it('AC3: NotesPage note body/title wrap long words instead of overflowing', async () => {
    const longNote: Note = {
      id: 'n1',
      kitchenId: 'k1',
      authorId: 'u1',
      title: LONG_NAME,
      body: LONG_NAME,
      tags: [],
      pinned: false,
      linkedEntityType: null,
      linkedEntityId: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    vi.spyOn(notesApi, 'listNotes').mockResolvedValue([longNote]);

    render(
      <MemoryRouter>
        <NotesPage />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByTestId('notes-list')).toBeInTheDocument());
    const titleEls = screen.getAllByText(LONG_NAME);
    for (const el of titleEls) {
      expect(el.className).toMatch(/break-words/);
    }
  });
});
