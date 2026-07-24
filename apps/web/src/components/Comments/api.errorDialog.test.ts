import { afterEach, describe, expect, it, vi } from 'vitest';
import * as errorDialogModule from '../../errorDialog/ErrorDialogProvider';
import { fetchComments } from './api';

// T029 — representative test for the `handle<T>(res)` helper pattern
// shared by components/Comments/api.ts and components/NotificationBell/api.ts
// (identical shape after T029's edit — see TASK_GUIDE_T029.md Test Plan).
describe('components/Comments/api notifyApiError integration (T029)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('AC1: calls notifyApiError with the server message on a non-2xx JSON response', async () => {
    const notifySpy = vi.spyOn(errorDialogModule, 'notifyApiError');
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ message: 'Comment thread not found' }), { status: 404 }),
    );

    await expect(fetchComments('task', 'task-1')).rejects.toThrow('Comment thread not found');
    expect(notifySpy).toHaveBeenCalledWith('Comment thread not found');
  });

  it('AC3: calls notifyApiError with a network-failure message when fetch rejects', async () => {
    const notifySpy = vi.spyOn(errorDialogModule, 'notifyApiError');
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(fetchComments('task', 'task-1')).rejects.toThrow(/network error/i);
    expect(notifySpy).toHaveBeenCalledWith(expect.stringMatching(/network error/i));
  });

  it('AC6: does not call notifyApiError on a successful (2xx) response', async () => {
    const notifySpy = vi.spyOn(errorDialogModule, 'notifyApiError');
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify([]), { status: 200 }),
    );

    await fetchComments('task', 'task-1');
    expect(notifySpy).not.toHaveBeenCalled();
  });
});
