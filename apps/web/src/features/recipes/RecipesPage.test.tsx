import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import * as exportApi from '../../features/export/api';
import type { Recipe, RecipeVersion } from './types';

let currentUser: {
  id: string;
  email: string;
  organizationId: string;
  kitchenId: string;
  role: 'OWNER' | 'ADMIN' | 'CHEF' | 'STAFF' | 'VIEWER';
  themePreference?: 'simple' | 'dark-neon';
} | null = null;

vi.mock('../../features/export/api', () => ({
  downloadRecipesCsv: vi.fn(),
}));

vi.mock('../../routes/auth', () => ({
  getToken: () => 'test-token',
  setUser: (user: typeof currentUser) => {
    currentUser = user;
  },
  getUser: () => currentUser,
  clearUser: () => {
    currentUser = null;
  },
}));

import { RecipesPage } from './RecipesPage';
import { setUser, clearUser } from '../../routes/auth';

const downloadRecipesCsv = vi.mocked(exportApi.downloadRecipesCsv);

function makeRecipe(overrides: Partial<Recipe> = {}): Recipe {
  return {
    id: 'r1',
    kitchenId: 'kitchen-1',
    name: 'Tomato Soup',
    steps: ['Chop tomatoes', 'Simmer 20 minutes'],
    servings: 4,
    version: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ingredients: [
      { ingredientId: 'i1', name: 'Tomato', unit: 'kg', qty: 2, costPerUnit: 3, lineCost: 6 },
    ],
    costComputed: 6,
    ...overrides,
  };
}

function makeIngredient() {
  return { id: 'i1', name: 'Tomato', unit: 'kg', costPerUnit: 3, allergens: [] };
}

function makeVersion(overrides: Partial<RecipeVersion> = {}): RecipeVersion {
  return {
    id: 'rv-1',
    recipeId: 'r1',
    version: 2,
    name: 'Tomato Soup',
    steps: ['Chop tomatoes', 'Simmer 20 minutes'],
    servings: 4,
    ingredientsSnapshot: [
      {
        ingredientId: 'i1',
        name: 'Tomato',
        unit: 'kg',
        qty: 2,
        costPerUnit: 3,
        lineCost: 6,
      },
    ],
    costComputedAtSnapshot: 6,
    createdAt: '2026-09-07T00:00:00.000Z',
    ...overrides,
  };
}

function setOwner() {
  setUser({
    id: 'owner-1',
    email: 'owner@example.com',
    organizationId: 'org-1',
    kitchenId: 'kitchen-1',
    role: 'OWNER',
  });
}

function setViewer() {
  setUser({
    id: 'viewer-1',
    email: 'viewer@example.com',
    organizationId: 'org-1',
    kitchenId: 'kitchen-1',
    role: 'VIEWER',
  });
}

describe('RecipesPage', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    currentUser = null;
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    downloadRecipesCsv.mockReset();
  });

  afterEach(() => {
    clearUser();
    vi.unstubAllGlobals();
  });

  it('renders a list of recipes (name, servings, cost) fetched from GET /recipes', async () => {
    setOwner();
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => [makeRecipe()] })
      .mockResolvedValueOnce({ ok: true, json: async () => [makeIngredient()] });

    render(
      <MemoryRouter>
        <RecipesPage />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByTestId('recipes-list')).toBeInTheDocument());
    expect(screen.getByText('Tomato Soup')).toBeInTheDocument();
    expect(screen.getByText(/4 servings/)).toBeInTheDocument();
    expect(screen.getByText(/Cost: \$6\.00/)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/recipes'),
      expect.anything(),
    );
  });

  it('T046 AC2: Owner sees an Export Recipes CSV control and clicking it triggers a download', async () => {
    setOwner();
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => [makeRecipe()] })
      .mockResolvedValueOnce({ ok: true, json: async () => [makeIngredient()] });

    const { default: userEvent } = await import('@testing-library/user-event');
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <RecipesPage />
      </MemoryRouter>,
    );

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Export Recipes CSV' })).toBeInTheDocument(),
    );
    await user.click(screen.getByRole('button', { name: 'Export Recipes CSV' }));

    expect(downloadRecipesCsv).toHaveBeenCalledTimes(1);
  });

  it('clicking a recipe shows steps, ingredients (name/qty/unit/line-cost) and total cost via GET /recipes/:id', async () => {
    setOwner();
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => [makeRecipe()] })
      .mockResolvedValueOnce({ ok: true, json: async () => [makeIngredient()] })
      .mockResolvedValueOnce({ ok: true, json: async () => makeRecipe() })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [makeVersion(), makeVersion({ id: 'rv-2', version: 1, createdAt: '2026-09-01T00:00:00.000Z' })],
      });

    const { default: userEvent } = await import('@testing-library/user-event');
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <RecipesPage />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByTestId('recipe-r1')).toBeInTheDocument());
    await user.click(screen.getByTestId('recipe-r1'));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenLastCalledWith(
        expect.stringContaining('/recipes/r1'),
        expect.anything(),
      ),
    );
    expect(await screen.findByTestId('recipe-steps')).toBeInTheDocument();
    expect(screen.getByText('Chop tomatoes')).toBeInTheDocument();
    const ingredientsTable = screen.getByTestId('recipe-ingredients');
    expect(ingredientsTable).toHaveTextContent('Tomato');
    expect(ingredientsTable).toHaveTextContent('2');
    expect(ingredientsTable).toHaveTextContent('kg');
    expect(ingredientsTable).toHaveTextContent('$6.00');
    expect(screen.getByText('Total cost: $6.00')).toBeInTheDocument();
    const versionsSection = screen.getByTestId('recipe-versions');
    expect(versionsSection).toHaveTextContent('Recipe version history');
    expect(versionsSection).toHaveTextContent('Version 2');
    expect(versionsSection).toHaveTextContent('Version 1');
    const rows = within(versionsSection).getAllByTestId('recipe-version-row');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent('Version 2');
    expect(rows[1]).toHaveTextContent('Version 1');
  });

  it('Owner sees a "New Recipe" control; submitting POSTs /recipes with name/steps/servings/ingredients and updates the list', async () => {
    setOwner();
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => [] })
      .mockResolvedValueOnce({ ok: true, json: async () => [makeIngredient()] })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => makeRecipe({ id: 'r2', name: 'Pasta' }),
      });

    const { default: userEvent } = await import('@testing-library/user-event');
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <RecipesPage />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByRole('button', { name: 'New Recipe' })).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'New Recipe' }));

    // "New Recipe" opens a modal (shared Dialog), not a full-page-replace form.
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText('Recipe name'), 'Pasta');
    await user.type(within(dialog).getByLabelText('Recipe steps'), 'Boil water');
    await user.selectOptions(within(dialog).getByLabelText('Ingredient 1'), 'i1');
    await user.type(within(dialog).getByLabelText('Quantity 1'), '1');
    await user.click(within(dialog).getByRole('button', { name: 'Create Recipe' }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenLastCalledWith(
        expect.stringContaining('/recipes'),
        expect.objectContaining({ method: 'POST' }),
      ),
    );
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(await screen.findByText('Pasta')).toBeInTheDocument();
  });

  it('editing a recipe PATCHes /recipes/:id', async () => {
    setOwner();
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => [makeRecipe()] })
      .mockResolvedValueOnce({ ok: true, json: async () => [makeIngredient()] })
      .mockResolvedValueOnce({ ok: true, json: async () => makeRecipe() })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [makeVersion()],
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => makeRecipe({ servings: 8 }),
      });

    const { default: userEvent } = await import('@testing-library/user-event');
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <RecipesPage />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByTestId('recipe-r1')).toBeInTheDocument());
    await user.click(screen.getByTestId('recipe-r1'));

    await waitFor(() => expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Edit' }));

    // Edit opens a pre-filled modal rather than replacing the page.
    const dialog = await screen.findByRole('dialog');
    const servingsInput = within(dialog).getByLabelText('Recipe servings') as HTMLInputElement;
    expect(servingsInput.value).toBe('4');
    await user.clear(servingsInput);
    await user.type(servingsInput, '8');
    await user.click(within(dialog).getByRole('button', { name: 'Save Changes' }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenLastCalledWith(
        expect.stringContaining('/recipes/r1'),
        expect.objectContaining({ method: 'PATCH' }),
      ),
    );
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(await screen.findByText(/8 servings/)).toBeInTheDocument();
  });

  it('Staff/Viewer does not see a "New Recipe" control and no write calls fire', async () => {
    setViewer();
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => [makeRecipe()] });

    render(
      <MemoryRouter>
        <RecipesPage />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByTestId('recipes-list')).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: 'New Recipe' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Export Recipes CSV' })).not.toBeInTheDocument();
    expect(downloadRecipesCsv).not.toHaveBeenCalled();

    for (const call of fetchMock.mock.calls) {
      const init = call[1] as RequestInit | undefined;
      expect(init?.method === undefined || init.method === 'GET').toBe(true);
    }
  });

  it('Staff/Viewer viewing a recipe detail does not see an Edit control', async () => {
    setViewer();
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => [makeRecipe()] })
      .mockResolvedValueOnce({ ok: true, json: async () => makeRecipe() })
      .mockResolvedValueOnce({ ok: true, json: async () => [makeVersion()] });

    const { default: userEvent } = await import('@testing-library/user-event');
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <RecipesPage />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByTestId('recipe-r1')).toBeInTheDocument());
    await user.click(screen.getByTestId('recipe-r1'));

    await screen.findByTestId('recipe-steps');
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
    expect(screen.getByTestId('recipe-versions')).toBeInTheDocument();
  });

  it('submitting create with no name is blocked client-side, no POST fires', async () => {
    setOwner();
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => [] })
      .mockResolvedValueOnce({ ok: true, json: async () => [makeIngredient()] });

    const { default: userEvent } = await import('@testing-library/user-event');
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <RecipesPage />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByRole('button', { name: 'New Recipe' })).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'New Recipe' }));

    await user.selectOptions(screen.getByLabelText('Ingredient 1'), 'i1');
    await user.type(screen.getByLabelText('Quantity 1'), '1');
    await user.click(screen.getByRole('button', { name: 'Create Recipe' }));

    expect(await screen.findByText('Name is required.')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('submitting create with zero ingredient rows is blocked client-side, no POST fires', async () => {
    setOwner();
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => [] })
      .mockResolvedValueOnce({ ok: true, json: async () => [makeIngredient()] });

    const { default: userEvent } = await import('@testing-library/user-event');
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <RecipesPage />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByRole('button', { name: 'New Recipe' })).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'New Recipe' }));

    await user.type(screen.getByLabelText('Recipe name'), 'Pasta');
    await user.click(screen.getByRole('button', { name: 'Create Recipe' }));

    expect(await screen.findByText('At least one ingredient is required.')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('empty recipe list shows a sensible empty state', async () => {
    setOwner();
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => [] })
      .mockResolvedValueOnce({ ok: true, json: async () => [] });

    render(
      <MemoryRouter>
        <RecipesPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText('No recipes yet.')).toBeInTheDocument();
  });

  it('a failed list fetch surfaces the error and routes through notifyApiError (T029)', async () => {
    setOwner();
    fetchMock.mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({ message: 'Server error' }) });

    render(
      <MemoryRouter>
        <RecipesPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Server error')).toBeInTheDocument();
  });
});
