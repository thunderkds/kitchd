import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import * as exportApi from './api';

vi.mock('../../routes/auth', () => ({
  getToken: () => 'test-token',
}));

describe('CSV export helpers', () => {
  const createObjectURL = vi.fn(() => 'blob:mock-url');
  const revokeObjectURL = vi.fn();

  beforeEach(() => {
    vi.restoreAllMocks();
    createObjectURL.mockClear();
    revokeObjectURL.mockClear();
    URL.createObjectURL = createObjectURL;
    URL.revokeObjectURL = revokeObjectURL;
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
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    const blob = (createObjectURL.mock.calls[0] as unknown as [Blob])[0];
    expect(blob.type).toBe('text/csv');
    expect(link.href).toBe('blob:mock-url');
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
  });

  it('downloads the recipes CSV from /export/recipes with the fallback filename', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('id,name\n1,Soup\n', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const link = document.createElement('a');
    vi.spyOn(document, 'createElement').mockReturnValue(link);
    const clickSpy = vi.spyOn(link, 'click').mockImplementation(() => undefined);

    await exportApi.downloadRecipesCsv();

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/export/recipes'),
      expect.anything(),
    );
    expect(link.download).toBe('recipes.csv');
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
