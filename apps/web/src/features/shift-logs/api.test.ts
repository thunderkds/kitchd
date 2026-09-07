import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import * as shiftLogsApi from './api';

vi.mock('../../routes/auth', () => ({
  getToken: () => 'test-token',
}));

describe('shift logs api helpers', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('lists shift logs with auth and the correct endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify([]), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await shiftLogsApi.listShiftLogs();

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/shift-logs'),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer test-token',
        }),
      }),
    );
  });

  it('creates a shift log entry through POST /shift-logs', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: 'log-1' }), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await shiftLogsApi.createShiftLog({ shift: 'MORNING', body: 'Prepped the walk-in' });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/shift-logs'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ shift: 'MORNING', body: 'Prepped the walk-in' }),
      }),
    );
  });

  it('surfaces shift-log fetch errors through the shared error dialog', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ message: 'Server error' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const errorDialogModule = await import('../../errorDialog/ErrorDialogProvider');
    const notifySpy = vi.spyOn(errorDialogModule, 'notifyApiError');

    await expect(shiftLogsApi.listShiftLogs()).rejects.toThrow('Server error');
    expect(notifySpy).toHaveBeenCalledWith('Server error');
  });
});
