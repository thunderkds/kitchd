import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { TasksPage } from './TasksPage';
import type { Task } from './types';

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    kitchenId: 'kitchen-1',
    title: 'Prep onions',
    status: 'TODO',
    assigneeId: 'user-1',
    dueAt: null,
    checklistItems: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('TasksPage', () => {
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

  it('renders 3 kanban columns with cards under the right column (AC1 setup)', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => [
        makeTask({ id: 't1', title: 'Task A', status: 'TODO' }),
        makeTask({ id: 't2', title: 'Task B', status: 'IN_PROGRESS' }),
      ],
    });

    render(
      <MemoryRouter>
        <TasksPage />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByTestId('kanban-board')).toBeInTheDocument());
    expect(screen.getByTestId('kanban-column-TODO')).toBeInTheDocument();
    expect(screen.getByTestId('kanban-column-IN_PROGRESS')).toBeInTheDocument();
    expect(screen.getByTestId('kanban-column-DONE')).toBeInTheDocument();

    expect(within(screen.getByTestId('kanban-column-TODO')).getByText('Task A')).toBeInTheDocument();
    expect(
      within(screen.getByTestId('kanban-column-IN_PROGRESS')).getByText('Task B'),
    ).toBeInTheDocument();
  });

  it('AC1: tap-to-move button PATCHes the task status and moves the card', async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [makeTask({ id: 't1', title: 'Task A', status: 'TODO' })],
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => makeTask({ id: 't1', title: 'Task A', status: 'IN_PROGRESS' }),
      });

    const { default: userEvent } = await import('@testing-library/user-event');
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <TasksPage />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByText('Task A')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: 'Move to In Progress' }));

    await waitFor(() =>
      expect(
        within(screen.getByTestId('kanban-column-IN_PROGRESS')).getByText('Task A'),
      ).toBeInTheDocument(),
    );

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/tasks/t1'),
      expect.objectContaining({ method: 'PATCH' }),
    );
  });

  it('AC3: toggling to list view preserves the active assignee filter', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => [
        makeTask({ id: 't1', title: 'Task A', assigneeId: 'user-1' }),
        makeTask({ id: 't2', title: 'Task B', assigneeId: 'user-2' }),
      ],
    });

    const { default: userEvent } = await import('@testing-library/user-event');
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={['/tasks']}>
        <TasksPage />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByTestId('kanban-board')).toBeInTheDocument());

    await user.selectOptions(screen.getByLabelText('Filter by assignee'), 'user-1');
    expect(screen.getByText('Task A')).toBeInTheDocument();
    expect(screen.queryByText('Task B')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'List' }));

    expect(screen.getByTestId('task-list-view')).toBeInTheDocument();
    expect(screen.getByText('Task A')).toBeInTheDocument();
    expect(screen.queryByText('Task B')).not.toBeInTheDocument();
  });

  it('AC2: checking a checklist item PATCHes the task with done=true', async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [
          makeTask({
            id: 't1',
            title: 'Task A',
            checklistItems: [{ id: 'i1', text: 'Wash veg', done: false }],
          }),
        ],
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () =>
          makeTask({
            id: 't1',
            title: 'Task A',
            checklistItems: [{ id: 'i1', text: 'Wash veg', done: true }],
          }),
      });

    const { default: userEvent } = await import('@testing-library/user-event');
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={['/tasks?view=list']}>
        <TasksPage />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByTestId('task-list-view')).toBeInTheDocument());

    await user.click(screen.getByRole('checkbox'));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenLastCalledWith(
        expect.stringContaining('/tasks/t1'),
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({
            checklistItems: [{ id: 'i1', text: 'Wash veg', done: true }],
          }),
        }),
      ),
    );
  });

  // T011 — stock deduction confirm-before-apply flow (FR-008).
  it('T011 AC1/AC3: moving a recipe-linked task to Done previews the deduction; cancelling applies nothing', async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [makeTask({ id: 't1', title: 'Task A', status: 'IN_PROGRESS' })],
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          requiresConfirmation: true,
          deductions: [
            {
              ingredientId: 'ingredient-1',
              deductQty: 6,
              currentStock: 10,
              resultingStock: 4,
              wouldGoNegative: false,
            },
          ],
          hasNegativeWarning: false,
        }),
      });

    const { default: userEvent } = await import('@testing-library/user-event');
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <TasksPage />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByText('Task A')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: 'Move to Done' }));

    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
    expect(screen.getByTestId('deduction-row-ingredient-1')).toBeInTheDocument();

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/tasks/t1/complete/preview'),
      expect.objectContaining({ method: 'POST' }),
    );

    // Cancel: no confirm call made, task stays IN_PROGRESS.
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalledWith(
      expect.stringContaining('/tasks/t1/complete/confirm'),
      expect.anything(),
    );
    expect(
      within(screen.getByTestId('kanban-column-IN_PROGRESS')).getByText('Task A'),
    ).toBeInTheDocument();
  });

  it('T011 AC2: confirming the dialog applies the deduction and moves the task to Done', async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [makeTask({ id: 't1', title: 'Task A', status: 'IN_PROGRESS' })],
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          requiresConfirmation: true,
          deductions: [
            {
              ingredientId: 'ingredient-1',
              deductQty: 6,
              currentStock: 10,
              resultingStock: 4,
              wouldGoNegative: false,
            },
          ],
          hasNegativeWarning: false,
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          task: makeTask({ id: 't1', title: 'Task A', status: 'DONE' }),
          movements: [{ id: 'm1', ingredientId: 'ingredient-1', qty: 6 }],
          hasNegativeWarning: false,
        }),
      });

    const { default: userEvent } = await import('@testing-library/user-event');
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <TasksPage />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByText('Task A')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Move to Done' }));
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: 'Confirm' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/tasks/t1/complete/confirm'),
      expect.objectContaining({ method: 'POST' }),
    );
    await waitFor(() =>
      expect(
        within(screen.getByTestId('kanban-column-DONE')).getByText('Task A'),
      ).toBeInTheDocument(),
    );
  });
});
