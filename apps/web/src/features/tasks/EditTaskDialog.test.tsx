import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import {
  EditTaskDialog,
  toDateInputValue,
  toIsoFromDateInput,
} from './EditTaskDialog';
import type { Task } from './types';

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    kitchenId: 'kitchen-1',
    title: 'Prep onions',
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

describe('EditTaskDialog date helpers', () => {
  it('round-trips a date-input value through the ISO instant the backend expects', () => {
    const iso = toIsoFromDateInput('2026-08-01');
    expect(iso).toBe(new Date('2026-08-01T00:00:00').toISOString());
    // Full ISO 8601 instant, not the bare yyyy-mm-dd the input yields.
    expect(iso).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    expect(toDateInputValue(iso)).toBe('2026-08-01');
  });

  it('treats an empty or unparseable value as no date', () => {
    expect(toIsoFromDateInput('')).toBeNull();
    expect(toDateInputValue(null)).toBe('');
    expect(toDateInputValue('not-a-date')).toBe('');
  });
});

describe('EditTaskDialog', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    window.localStorage.setItem('accessToken', 'test-token');
    fetchMock = vi.fn(() => Promise.resolve({ ok: true, json: async () => makeTask() }));
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    window.localStorage.clear();
  });

  it('blocks clearing an existing due date instead of silently dropping the change', async () => {
    const { default: userEvent } = await import('@testing-library/user-event');
    const user = userEvent.setup();

    render(
      <EditTaskDialog
        task={makeTask({ dueAt: '2026-08-01T00:00:00.000Z' })}
        canEditDetails
        assigneeOptions={[]}
        onSaved={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    await user.clear(screen.getByLabelText('Due date'));
    await user.click(screen.getByRole('button', { name: 'Save Changes' }));

    expect(
      screen.getByText('Clearing a due date is not supported yet.'),
    ).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects a blank checklist item rather than letting the server 400 it', async () => {
    const { default: userEvent } = await import('@testing-library/user-event');
    const user = userEvent.setup();

    render(
      <EditTaskDialog
        task={makeTask({ checklistItems: [{ id: 'i1', text: 'Wash veg', done: false }] })}
        canEditDetails
        assigneeOptions={[]}
        onSaved={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    await user.clear(screen.getByLabelText('Checklist item 1'));
    await user.click(screen.getByRole('button', { name: 'Save Changes' }));

    expect(screen.getByText('Checklist items cannot be empty.')).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('closes without a PATCH when nothing changed', async () => {
    const onClose = vi.fn();
    const onSaved = vi.fn();
    const { default: userEvent } = await import('@testing-library/user-event');
    const user = userEvent.setup();

    render(
      <EditTaskDialog
        task={makeTask()}
        canEditDetails
        assigneeOptions={[]}
        onSaved={onSaved}
        onClose={onClose}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Save Changes' }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(fetchMock).not.toHaveBeenCalled();
    expect(onSaved).not.toHaveBeenCalled();
  });

  // T040 — per-item `done` checkbox.
  it('T040 AC5: each checklist row renders a done checkbox reflecting the stored state', () => {
    render(
      <EditTaskDialog
        task={makeTask({
          checklistItems: [
            { id: 'i1', text: 'Wash veg', done: false },
            { id: 'i2', text: 'Dice onions', done: true },
          ],
        })}
        canEditDetails
        assigneeOptions={[]}
        onSaved={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByLabelText('Mark checklist item 1 done')).not.toBeChecked();
    expect(screen.getByLabelText('Mark checklist item 2 done')).toBeChecked();
  });

  it('T040 AC5: un-ticking a done item sends done:false with its id and text intact', async () => {
    const { default: userEvent } = await import('@testing-library/user-event');
    const user = userEvent.setup();

    render(
      <EditTaskDialog
        task={makeTask({
          checklistItems: [{ id: 'i1', text: 'Wash veg', done: true }],
        })}
        canEditDetails
        assigneeOptions={[]}
        onSaved={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    await user.click(screen.getByLabelText('Mark checklist item 1 done'));
    await user.click(screen.getByRole('button', { name: 'Save Changes' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(JSON.parse(init.body as string)).toEqual({
      checklistItems: [{ id: 'i1', text: 'Wash veg', done: false }],
    });
  });

  it('T040 AC5: a newly added item can be ticked done and is still sent without an id', async () => {
    const { default: userEvent } = await import('@testing-library/user-event');
    const user = userEvent.setup();

    render(
      <EditTaskDialog
        task={makeTask()}
        canEditDetails
        assigneeOptions={[]}
        onSaved={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Add checklist item' }));
    await user.type(screen.getByLabelText('Checklist item 1'), 'Dice onions');
    await user.click(screen.getByLabelText('Mark checklist item 1 done'));
    await user.click(screen.getByRole('button', { name: 'Save Changes' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(JSON.parse(init.body as string)).toEqual({
      checklistItems: [{ text: 'Dice onions', done: true }],
    });
  });

  it('removing a checklist item sends the remaining items only', async () => {
    const onSaved = vi.fn();
    const { default: userEvent } = await import('@testing-library/user-event');
    const user = userEvent.setup();

    render(
      <EditTaskDialog
        task={makeTask({
          checklistItems: [
            { id: 'i1', text: 'Wash veg', done: false },
            { id: 'i2', text: 'Dice onions', done: true },
          ],
        })}
        canEditDetails
        assigneeOptions={[]}
        onSaved={onSaved}
        onClose={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Remove checklist item 1' }));
    await user.click(screen.getByRole('button', { name: 'Save Changes' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(init.method).toBe('PATCH');
    expect(JSON.parse(init.body as string)).toEqual({
      checklistItems: [{ id: 'i2', text: 'Dice onions', done: true }],
    });
  });
});
