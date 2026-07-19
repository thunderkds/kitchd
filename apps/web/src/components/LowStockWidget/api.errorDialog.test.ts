import { afterEach, describe, expect, it, vi } from 'vitest';
import * as errorDialogModule from '../../errorDialog/ErrorDialogProvider';
import { fetchLowStock } from './api';

// T029 — representative test for the inline (no shared helper) fetch
// pattern shared by components/LowStockWidget/api.ts and
// components/AnnouncementsWidget/api.ts (identical shape after T029's
// edit — see TASK_GUIDE_T029.md Test Plan).
describe('components/LowStockWidget/api notifyApiError integration (T029)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('AC1: calls notifyApiError with the server message on a non-2xx JSON response', async () => {
    const notifySpy = vi.spyOn(errorDialogModule, 'notifyApiError');
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ message: 'Inventory unavailable' }), { status: 500 }),
    );

    await expect(fetchLowStock()).rejects.toThrow('Inventory unavailable');
    expect(notifySpy).toHaveBeenCalledWith('Inventory unavailable');
  });

  it('AC3: calls notifyApiError with a network-failure message when fetch rejects', async () => {
    const notifySpy = vi.spyOn(errorDialogModule, 'notifyApiError');
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(fetchLowStock()).rejects.toThrow(/network error/i);
    expect(notifySpy).toHaveBeenCalledWith(expect.stringMatching(/network error/i));
  });

  it('AC6: does not call notifyApiError on a successful (2xx) response', async () => {
    const notifySpy = vi.spyOn(errorDialogModule, 'notifyApiError');
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify([]), { status: 200 }),
    );

    await fetchLowStock();
    expect(notifySpy).not.toHaveBeenCalled();
  });
});
