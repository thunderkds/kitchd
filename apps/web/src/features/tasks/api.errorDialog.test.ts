import { afterEach, describe, expect, it, vi } from 'vitest';
import * as errorDialogModule from '../../errorDialog/ErrorDialogProvider';
import { listTasks } from './api';

// T029 — representative test for the `request<T>()` helper pattern shared
// by features/tasks/api.ts, features/notes/api.ts, and features/team/api.ts
// (identical shape after T029's edit — see TASK_GUIDE_T029.md Test Plan).
describe('features/tasks/api notifyApiError integration (T029)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('AC1: calls notifyApiError with the server message on a non-2xx JSON response', async () => {
    const notifySpy = vi.spyOn(errorDialogModule, 'notifyApiError');
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ message: 'Task not found' }), { status: 404 }),
    );

    await expect(listTasks()).rejects.toThrow('Task not found');
    expect(notifySpy).toHaveBeenCalledWith('Task not found');
  });

  it('AC2: calls notifyApiError with a generic fallback when the body has no message', async () => {
    const notifySpy = vi.spyOn(errorDialogModule, 'notifyApiError');
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('not json', { status: 500 }));

    await expect(listTasks()).rejects.toThrow();
    expect(notifySpy).toHaveBeenCalledWith(expect.stringContaining('Request failed'));
  });

  it('AC3: calls notifyApiError with a network-failure message when fetch rejects', async () => {
    const notifySpy = vi.spyOn(errorDialogModule, 'notifyApiError');
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(listTasks()).rejects.toThrow(/network error/i);
    expect(notifySpy).toHaveBeenCalledWith(expect.stringMatching(/network error/i));
  });

  it('AC6: does not call notifyApiError on a successful (2xx) response', async () => {
    const notifySpy = vi.spyOn(errorDialogModule, 'notifyApiError');
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify([]), { status: 200 }),
    );

    await listTasks();
    expect(notifySpy).not.toHaveBeenCalled();
  });
});
