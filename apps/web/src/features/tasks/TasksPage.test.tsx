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
    sourceRecipeId: null,
    sourceGuidelineId: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * T035 — TasksPage now fires 3 background lookups (recipes/guidelines/
 * ingredients) alongside the tasks list on mount, so the fetch mock must be
 * routed by URL rather than relying on call-order queueing (mockResolvedValueOnce
 * would otherwise be consumed by the wrong request).
 */
function setUser(role: string) {
  window.localStorage.setItem(
    'authUser',
    JSON.stringify({
      id: 'caller-1',
      email: 'caller@example.com',
      organizationId: 'org-1',
      kitchenId: 'kitchen-1',
      role,
    }),
  );
}

function jsonResponse(body: unknown) {
  return { ok: true, json: async () => body };
}

/** T039 — bodies of every PATCH the page issued, newest last. */
function patchBodies(mock: ReturnType<typeof vi.fn>): unknown[] {
  return mock.mock.calls
    .filter((call) => (call[1] as RequestInit | undefined)?.method === 'PATCH')
    .map((call) => JSON.parse((call[1] as RequestInit).body as string));
}

function routedFetchMock(overrides: {
  tasks?: Task[];
  members?: { id: string; email: string; role: string; isActive: boolean }[];
  onPatch?: (url: string, init: RequestInit) => unknown;
  onPost?: (url: string, init: RequestInit) => unknown;
} = {}) {
  const tasks = overrides.tasks ?? [];
  return vi.fn((url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET';
    if (url.includes('/recipes')) return Promise.resolve(jsonResponse([]));
    if (url.includes('/guidelines')) return Promise.resolve(jsonResponse([]));
    if (url.includes('/ingredients')) return Promise.resolve(jsonResponse([]));
    if (url.includes('/users')) {
      return Promise.resolve(jsonResponse(overrides.members ?? []));
    }
    if (url.endsWith('/tasks') && method === 'GET') {
      return Promise.resolve(jsonResponse(tasks));
    }
    if (url.endsWith('/tasks') && method === 'POST' && overrides.onPost) {
      return Promise.resolve(jsonResponse(overrides.onPost(url, init!)));
    }
    if (method === 'PATCH' && overrides.onPatch) {
      return Promise.resolve(jsonResponse(overrides.onPatch(url, init!)));
    }
    return Promise.resolve(jsonResponse(null));
  });
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
    fetchMock.mockImplementation(
      routedFetchMock({
        tasks: [
          makeTask({ id: 't1', title: 'Task A', status: 'TODO' }),
          makeTask({ id: 't2', title: 'Task B', status: 'IN_PROGRESS' }),
        ],
      }),
    );

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
    fetchMock.mockImplementation(
      routedFetchMock({
        tasks: [makeTask({ id: 't1', title: 'Task A', status: 'TODO' })],
        onPatch: () => makeTask({ id: 't1', title: 'Task A', status: 'IN_PROGRESS' }),
      }),
    );

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
    fetchMock.mockImplementation(
      routedFetchMock({
        tasks: [
          makeTask({ id: 't1', title: 'Task A', assigneeId: 'user-1' }),
          makeTask({ id: 't2', title: 'Task B', assigneeId: 'user-2' }),
        ],
      }),
    );

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
    fetchMock.mockImplementation(
      routedFetchMock({
        tasks: [
          makeTask({
            id: 't1',
            title: 'Task A',
            checklistItems: [{ id: 'i1', text: 'Wash veg', done: false }],
          }),
        ],
        onPatch: () =>
          makeTask({
            id: 't1',
            title: 'Task A',
            checklistItems: [{ id: 'i1', text: 'Wash veg', done: true }],
          }),
      }),
    );

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
      expect(fetchMock).toHaveBeenCalledWith(
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
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET';
      if (url.includes('/recipes')) return Promise.resolve(jsonResponse([]));
      if (url.includes('/guidelines')) return Promise.resolve(jsonResponse([]));
      if (url.includes('/ingredients')) return Promise.resolve(jsonResponse([]));
      if (url.endsWith('/tasks') && method === 'GET') {
        return Promise.resolve(
          jsonResponse([makeTask({ id: 't1', title: 'Task A', status: 'IN_PROGRESS' })]),
        );
      }
      if (url.includes('/complete/preview')) {
        return Promise.resolve(
          jsonResponse({
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
        );
      }
      return Promise.resolve(jsonResponse(null));
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
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET';
      if (url.includes('/recipes')) return Promise.resolve(jsonResponse([]));
      if (url.includes('/guidelines')) return Promise.resolve(jsonResponse([]));
      if (url.includes('/ingredients')) return Promise.resolve(jsonResponse([]));
      if (url.endsWith('/tasks') && method === 'GET') {
        return Promise.resolve(
          jsonResponse([makeTask({ id: 't1', title: 'Task A', status: 'IN_PROGRESS' })]),
        );
      }
      if (url.includes('/complete/preview')) {
        return Promise.resolve(
          jsonResponse({
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
        );
      }
      if (url.includes('/complete/confirm')) {
        return Promise.resolve(
          jsonResponse({
            task: makeTask({ id: 't1', title: 'Task A', status: 'DONE' }),
            movements: [{ id: 'm1', ingredientId: 'ingredient-1', qty: 6 }],
            hasNegativeWarning: false,
          }),
        );
      }
      return Promise.resolve(jsonResponse(null));
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

  // T035 — RBAC gating + create flow.
  it('T035 AC7: Owner sees the "New Task" button, Staff does not', async () => {
    fetchMock.mockImplementation(routedFetchMock({ tasks: [] }));

    setUser('OWNER');
    const { unmount } = render(
      <MemoryRouter>
        <TasksPage />
      </MemoryRouter>,
    );
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'New Task' })).toBeInTheDocument(),
    );
    unmount();

    setUser('STAFF');
    render(
      <MemoryRouter>
        <TasksPage />
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByText(/No tasks yet/)).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: 'New Task' })).not.toBeInTheDocument();
  });

  it('T035 AC2/AC8: plain create posts to POST /tasks and blank title is blocked client-side', async () => {
    setUser('OWNER');
    fetchMock.mockImplementation(
      routedFetchMock({
        tasks: [],
        onPost: () => makeTask({ id: 'new-task', title: 'Deep clean fryer' }),
      }),
    );

    const { default: userEvent } = await import('@testing-library/user-event');
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <TasksPage />
      </MemoryRouter>,
    );

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'New Task' })).toBeInTheDocument(),
    );
    await user.click(screen.getByRole('button', { name: 'New Task' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    // Negative case: blank title blocked, no POST /tasks call.
    const postCallsBefore = fetchMock.mock.calls.filter(
      (call) => (call[1] as RequestInit | undefined)?.method === 'POST',
    ).length;
    await user.click(screen.getByRole('button', { name: 'Create Task' }));
    expect(screen.getByText('Title is required')).toBeInTheDocument();
    const postCallsAfter = fetchMock.mock.calls.filter(
      (call) => (call[1] as RequestInit | undefined)?.method === 'POST',
    ).length;
    expect(postCallsAfter).toBe(postCallsBefore);

    await user.type(screen.getByLabelText('Task title'), 'Deep clean fryer');
    await user.click(screen.getByRole('button', { name: 'Create Task' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/tasks'),
      expect.objectContaining({ method: 'POST' }),
    );
    await waitFor(() => expect(screen.getByText('Deep clean fryer')).toBeInTheDocument());
  });

  it('T035 AC5: resolves the source recipe title on a recipe-generated task card', async () => {
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET';
      if (url.includes('/recipes')) {
        return Promise.resolve(jsonResponse([{ id: 'recipe-1', name: 'Tomato Soup' }]));
      }
      if (url.includes('/guidelines')) return Promise.resolve(jsonResponse([]));
      if (url.includes('/ingredients')) return Promise.resolve(jsonResponse([]));
      if (url.endsWith('/tasks') && method === 'GET') {
        return Promise.resolve(
          jsonResponse([
            makeTask({ id: 't1', title: 'Tomato Soup', sourceRecipeId: 'recipe-1' }),
          ]),
        );
      }
      return Promise.resolve(jsonResponse(null));
    });

    render(
      <MemoryRouter>
        <TasksPage />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByText('From: Tomato Soup')).toBeInTheDocument());
  });

  it('T035 AC5: resolves the source recipe title in list view too, not just kanban', async () => {
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET';
      if (url.includes('/recipes')) {
        return Promise.resolve(jsonResponse([{ id: 'recipe-1', name: 'Tomato Soup' }]));
      }
      if (url.includes('/guidelines')) return Promise.resolve(jsonResponse([]));
      if (url.includes('/ingredients')) return Promise.resolve(jsonResponse([]));
      if (url.endsWith('/tasks') && method === 'GET') {
        return Promise.resolve(
          jsonResponse([
            makeTask({ id: 't1', title: 'Tomato Soup', sourceRecipeId: 'recipe-1' }),
          ]),
        );
      }
      return Promise.resolve(jsonResponse(null));
    });

    render(
      <MemoryRouter initialEntries={['/tasks?view=list']}>
        <TasksPage />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByText('From: Tomato Soup')).toBeInTheDocument());
  });

  // ---------------------------------------------------------------------
  // T039 — Edit Task UI (title / assignee / due date / checklist)
  // ---------------------------------------------------------------------

  it('T039 AC1: Chef edits a task title from the kanban view; PATCH carries only the changed field', async () => {
    setUser('CHEF');
    fetchMock.mockImplementation(
      routedFetchMock({
        tasks: [makeTask({ id: 't1', title: 'Task A' })],
        onPatch: () => makeTask({ id: 't1', title: 'Prep mise en place' }),
      }),
    );

    const { default: userEvent } = await import('@testing-library/user-event');
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <TasksPage />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByText('Task A')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Edit Task A' }));

    const dialog = screen.getByRole('dialog');
    const titleInput = within(dialog).getByLabelText('Task title');
    await user.clear(titleInput);
    await user.type(titleInput, 'Prep mise en place');
    await user.click(within(dialog).getByRole('button', { name: 'Save Changes' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/tasks/t1'),
      expect.objectContaining({ method: 'PATCH' }),
    );
    expect(patchBodies(fetchMock)).toEqual([{ title: 'Prep mise en place' }]);
    expect(
      within(screen.getByTestId('kanban-column-TODO')).getByText('Prep mise en place'),
    ).toBeInTheDocument();
  });

  it('T039 AC2: the Edit control is reachable from the list view too, and the row updates', async () => {
    setUser('CHEF');
    fetchMock.mockImplementation(
      routedFetchMock({
        tasks: [makeTask({ id: 't1', title: 'Task A' })],
        onPatch: () => makeTask({ id: 't1', title: 'Task A renamed' }),
      }),
    );

    const { default: userEvent } = await import('@testing-library/user-event');
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={['/tasks?view=list']}>
        <TasksPage />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByTestId('task-list-view')).toBeInTheDocument());
    await user.click(
      within(screen.getByTestId('task-list-view')).getByRole('button', { name: 'Edit Task A' }),
    );

    const dialog = screen.getByRole('dialog');
    const titleInput = within(dialog).getByLabelText('Task title');
    await user.clear(titleInput);
    await user.type(titleInput, 'Task A renamed');
    await user.click(within(dialog).getByRole('button', { name: 'Save Changes' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(patchBodies(fetchMock)).toEqual([{ title: 'Task A renamed' }]);
    expect(
      within(screen.getByTestId('task-list-view')).getByText('Task A renamed'),
    ).toBeInTheDocument();
  });

  it('T039 AC1: an Owner reassigns a task to another kitchen member listed by email', async () => {
    setUser('OWNER');
    fetchMock.mockImplementation(
      routedFetchMock({
        tasks: [makeTask({ id: 't1', title: 'Task A', assigneeId: 'user-1' })],
        members: [
          { id: 'user-1', email: 'ana@example.com', role: 'STAFF', isActive: true },
          { id: 'user-2', email: 'bo@example.com', role: 'STAFF', isActive: true },
          { id: 'user-3', email: 'gone@example.com', role: 'STAFF', isActive: false },
        ],
        onPatch: () => makeTask({ id: 't1', title: 'Task A', assigneeId: 'user-2' }),
      }),
    );

    const { default: userEvent } = await import('@testing-library/user-event');
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <TasksPage />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByText('Task A')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Edit Task A' }));

    const dialog = screen.getByRole('dialog');
    const assigneeSelect = within(dialog).getByLabelText('Assignee');
    // Deactivated members are not offered as assignees.
    expect(within(assigneeSelect).queryByText('gone@example.com')).not.toBeInTheDocument();

    await user.selectOptions(assigneeSelect, 'user-2');
    await user.click(within(dialog).getByRole('button', { name: 'Save Changes' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(patchBodies(fetchMock)).toEqual([{ assigneeId: 'user-2' }]);
    expect(screen.getByText('Assigned: user-2')).toBeInTheDocument();
  });

  it('T039: clearing the assignee sends assigneeId: null (explicit unassign, not undefined)', async () => {
    setUser('OWNER');
    fetchMock.mockImplementation(
      routedFetchMock({
        tasks: [makeTask({ id: 't1', title: 'Task A', assigneeId: 'user-1' })],
        members: [{ id: 'user-1', email: 'ana@example.com', role: 'STAFF', isActive: true }],
        onPatch: () => makeTask({ id: 't1', title: 'Task A', assigneeId: null }),
      }),
    );

    const { default: userEvent } = await import('@testing-library/user-event');
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <TasksPage />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByText('Task A')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Edit Task A' }));

    await user.selectOptions(within(screen.getByRole('dialog')).getByLabelText('Assignee'), '');
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Save Changes' }),
    );

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(patchBodies(fetchMock)).toEqual([{ assigneeId: null }]);
    expect(
      within(screen.getByTestId('kanban-column-TODO')).getByText('Unassigned'),
    ).toBeInTheDocument();
  });

  it('T039: the due date is sent as a full ISO instant, not the raw yyyy-mm-dd input value', async () => {
    setUser('CHEF');
    fetchMock.mockImplementation(
      routedFetchMock({
        tasks: [makeTask({ id: 't1', title: 'Task A', dueAt: null })],
        onPatch: () => makeTask({ id: 't1', title: 'Task A' }),
      }),
    );

    const { default: userEvent } = await import('@testing-library/user-event');
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <TasksPage />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByText('Task A')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Edit Task A' }));

    const dialog = screen.getByRole('dialog');
    await user.type(within(dialog).getByLabelText('Due date'), '2026-08-01');
    await user.click(within(dialog).getByRole('button', { name: 'Save Changes' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(patchBodies(fetchMock)).toEqual([
      { dueAt: new Date('2026-08-01T00:00:00').toISOString() },
    ]);
  });

  it('T039: editing checklist text keeps each item id and done state; a new item is sent without an id', async () => {
    setUser('CHEF');
    fetchMock.mockImplementation(
      routedFetchMock({
        tasks: [
          makeTask({
            id: 't1',
            title: 'Task A',
            checklistItems: [{ id: 'i1', text: 'Wash veg', done: true }],
          }),
        ],
        onPatch: () => makeTask({ id: 't1', title: 'Task A' }),
      }),
    );

    const { default: userEvent } = await import('@testing-library/user-event');
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <TasksPage />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByText('Task A')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Edit Task A' }));

    const dialog = screen.getByRole('dialog');
    const itemInput = within(dialog).getByLabelText('Checklist item 1');
    await user.clear(itemInput);
    await user.type(itemInput, 'Wash and peel veg');
    await user.click(within(dialog).getByRole('button', { name: 'Add checklist item' }));
    await user.type(within(dialog).getByLabelText('Checklist item 2'), 'Dice onions');
    await user.click(within(dialog).getByRole('button', { name: 'Save Changes' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(patchBodies(fetchMock)).toEqual([
      {
        checklistItems: [
          { id: 'i1', text: 'Wash and peel veg', done: true },
          { text: 'Dice onions', done: false },
        ],
      },
    ]);
  });

  it('T039 AC3: Staff editing their own task sees checklist fields only — no title/assignee/due date', async () => {
    setUser('STAFF');
    fetchMock.mockImplementation(
      routedFetchMock({
        tasks: [
          makeTask({
            id: 't1',
            title: 'Task A',
            assigneeId: 'caller-1',
            checklistItems: [{ id: 'i1', text: 'Wash veg', done: false }],
          }),
        ],
      }),
    );

    const { default: userEvent } = await import('@testing-library/user-event');
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <TasksPage />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByText('Task A')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Edit Task A' }));

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByLabelText('Checklist item 1')).toBeInTheDocument();
    expect(within(dialog).queryByLabelText('Task title')).not.toBeInTheDocument();
    expect(within(dialog).queryByLabelText('Assignee')).not.toBeInTheDocument();
    expect(within(dialog).queryByLabelText('Due date')).not.toBeInTheDocument();
  });

  it('T039 AC4: Staff sees no Edit control on a task assigned to someone else (both views)', async () => {
    setUser('STAFF');
    fetchMock.mockImplementation(
      routedFetchMock({
        tasks: [makeTask({ id: 't1', title: 'Task A', assigneeId: 'someone-else' })],
      }),
    );

    const { unmount } = render(
      <MemoryRouter>
        <TasksPage />
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByText('Task A')).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: 'Edit Task A' })).not.toBeInTheDocument();
    unmount();

    render(
      <MemoryRouter initialEntries={['/tasks?view=list']}>
        <TasksPage />
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByTestId('task-list-view')).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: 'Edit Task A' })).not.toBeInTheDocument();
  });

  it('T039 AC5: a Viewer never sees an Edit control, even on a task assigned to them (both views)', async () => {
    setUser('VIEWER');
    fetchMock.mockImplementation(
      routedFetchMock({
        tasks: [makeTask({ id: 't1', title: 'Task A', assigneeId: 'caller-1' })],
      }),
    );

    const { unmount } = render(
      <MemoryRouter>
        <TasksPage />
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByText('Task A')).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: 'Edit Task A' })).not.toBeInTheDocument();
    unmount();

    render(
      <MemoryRouter initialEntries={['/tasks?view=list']}>
        <TasksPage />
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByTestId('task-list-view')).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: 'Edit Task A' })).not.toBeInTheDocument();
  });

  it('T039 AC6: an empty title is rejected client-side and issues no PATCH', async () => {
    setUser('CHEF');
    fetchMock.mockImplementation(
      routedFetchMock({ tasks: [makeTask({ id: 't1', title: 'Task A' })] }),
    );

    const { default: userEvent } = await import('@testing-library/user-event');
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <TasksPage />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByText('Task A')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Edit Task A' }));

    const dialog = screen.getByRole('dialog');
    await user.clear(within(dialog).getByLabelText('Task title'));
    await user.click(within(dialog).getByRole('button', { name: 'Save Changes' }));

    expect(within(dialog).getByText('Title is required')).toBeInTheDocument();
    expect(patchBodies(fetchMock)).toEqual([]);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('T039 AC7: a failed PATCH surfaces the global error dialog and leaves the task list unchanged', async () => {
    setUser('CHEF');
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET';
      if (url.includes('/recipes')) return Promise.resolve(jsonResponse([]));
      if (url.includes('/guidelines')) return Promise.resolve(jsonResponse([]));
      if (url.includes('/ingredients')) return Promise.resolve(jsonResponse([]));
      if (url.includes('/users')) return Promise.resolve(jsonResponse([]));
      if (url.endsWith('/tasks') && method === 'GET') {
        return Promise.resolve(jsonResponse([makeTask({ id: 't1', title: 'Task A' })]));
      }
      if (method === 'PATCH') {
        return Promise.resolve({
          ok: false,
          status: 403,
          json: async () => ({ message: 'Not your task' }),
        });
      }
      return Promise.resolve(jsonResponse(null));
    });

    const { default: userEvent } = await import('@testing-library/user-event');
    const user = userEvent.setup();
    const { ErrorDialogProvider } = await import('../../errorDialog/ErrorDialogProvider');

    render(
      <MemoryRouter>
        <ErrorDialogProvider>
          <TasksPage />
        </ErrorDialogProvider>
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByText('Task A')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Edit Task A' }));

    const titleInput = screen.getByLabelText('Task title');
    await user.clear(titleInput);
    await user.type(titleInput, 'Renamed');
    await user.click(screen.getByRole('button', { name: 'Save Changes' }));

    await waitFor(() =>
      expect(screen.getByTestId('error-dialog-message')).toHaveTextContent('Not your task'),
    );
    // List unchanged — the optimistic-free flow never applied the edit.
    expect(
      within(screen.getByTestId('kanban-column-TODO')).getByText('Task A'),
    ).toBeInTheDocument();
    expect(screen.queryByText('Renamed')).not.toBeInTheDocument();
  });

  it('T039: a Chef (who cannot read GET /users) still gets an assignee picker and issues no /users call', async () => {
    setUser('CHEF');
    fetchMock.mockImplementation(
      routedFetchMock({
        tasks: [
          makeTask({ id: 't1', title: 'Task A', assigneeId: 'user-11111111' }),
          makeTask({ id: 't2', title: 'Task B', assigneeId: 'user-22222222' }),
        ],
      }),
    );

    const { default: userEvent } = await import('@testing-library/user-event');
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <TasksPage />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByText('Task A')).toBeInTheDocument());
    expect(
      fetchMock.mock.calls.filter((call) => String(call[0]).includes('/users')),
    ).toHaveLength(0);

    await user.click(screen.getByRole('button', { name: 'Edit Task A' }));
    const assigneeSelect = within(screen.getByRole('dialog')).getByLabelText('Assignee');
    expect(within(assigneeSelect).getByText('user-222')).toBeInTheDocument();
  });
});
