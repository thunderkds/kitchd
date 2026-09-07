import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import * as exportApi from './api';

vi.mock('../../routes/auth', () => ({
  getToken: () => 'test-token',
}));

describe('CSV export helpers', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('downloads the ingredients CSV using the server filename when available', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response('id,name\n1,Flour\n', {
        status: 200,
        headers: { 'Content-Disposition': 'attachment; filename="ingredients.csv"' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const link = document.createElement('a');
    const createElementSpy = vi.spyOn(document, 'createElement').mockReturnValue(link);
    const clickSpy = vi.spyOn(link, 'click').mockImplementation(() => undefined);

    await exportApi.downloadIngredientsCsv();

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/export/ingredients'),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer test-token',
        }),
      }),
    );
    expect(createElementSpy).toHaveBeenCalledWith('a');
    expect(link.download).toBe('ingredients.csv');
    expect(link.href).toContain('data:text/csv;charset=utf-8,');
    expect(clickSpy).toHaveBeenCalledTimes(1);
  });

  it('surfaces a failed recipes export through the shared error dialog', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ message: 'Server error' }), { status: 500 }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const errorDialogModule = await import('../../errorDialog/ErrorDialogProvider');
    const notifySpy = vi.spyOn(errorDialogModule, 'notifyApiError');

    await expect(exportApi.downloadRecipesCsv()).rejects.toThrow('Server error');
    expect(notifySpy).toHaveBeenCalledWith('Server error');
  });
});
