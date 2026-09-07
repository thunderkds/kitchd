import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import * as recipesApi from './api';

vi.mock('../../routes/auth', () => ({
  getToken: () => 'test-token',
}));

describe('recipes api helpers', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('lists recipe versions with auth and the correct endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify([]), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await recipesApi.listRecipeVersions('recipe-1');

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/recipes/recipe-1/versions'),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer test-token',
        }),
      }),
    );
  });

  it('surfaces version-history fetch errors through the shared error dialog', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ message: 'Server error' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const errorDialogModule = await import('../../errorDialog/ErrorDialogProvider');
    const notifySpy = vi.spyOn(errorDialogModule, 'notifyApiError');

    await expect(recipesApi.listRecipeVersions('recipe-1')).rejects.toThrow('Server error');
    expect(notifySpy).toHaveBeenCalledWith('Server error');
  });
});
