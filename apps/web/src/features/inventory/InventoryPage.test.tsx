import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { InventoryPage } from './InventoryPage';
import type { Ingredient, StockMovement } from './types';
import { setUser } from '../../routes/auth';

function makeIngredient(overrides: Partial<Ingredient> = {}): Ingredient {
  return {
    id: 'ing-1',
    name: 'Flour',
    unit: 'kg',
    costPerUnit: 2.5,
    category: 'Dry Goods',
    allergens: [],
    supplierId: null,
    minThreshold: 5,
    ...overrides,
  };
}

function makeMovement(overrides: Partial<StockMovement> = {}): StockMovement {
  return {
    id: 'mv-1',
    ingredientId: 'ing-1',
    batchId: null,
    type: 'RECEIVE',
    qty: 10,
    reason: null,
    actorId: 'owner-1',
    createdAt: new Date().toISOString(),
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

describe('InventoryPage', () => {
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

  it('AC1: renders the ingredient list with name, stock, unit, cost from GET /ingredients', async () => {
    setOwner();
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => [makeIngredient()] })
      .mockResolvedValueOnce({ ok: true, json: async () => [makeMovement({ qty: 12 })] });

    render(
      <MemoryRouter>
        <InventoryPage />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByTestId('ingredient-ing-1')).toBeInTheDocument());
    const row = screen.getByTestId('ingredient-ing-1');
    expect(within(row).getByText('Flour')).toBeInTheDocument();
    expect(within(row).getByText(/Stock: 12 kg/)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/ingredients'), expect.anything());
  });

  it('AC2: Owner sees Add Ingredient control; Viewer does not', async () => {
    setViewer();
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => [makeIngredient()] })
      .mockResolvedValueOnce({ ok: true, json: async () => [makeMovement()] });

    render(
      <MemoryRouter>
        <InventoryPage />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByTestId('ingredient-ing-1')).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: 'Add Ingredient' })).not.toBeInTheDocument();
    expect(within(screen.getByTestId('ingredient-ing-1')).queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
    expect(
      within(screen.getByTestId('ingredient-ing-1')).queryByRole('button', { name: 'Receive Stock' }),
    ).not.toBeInTheDocument();
  });

  it('AC3: creating an ingredient calls POST /ingredients and the new item appears without a full reload', async () => {
    setOwner();
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => [] })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => makeIngredient({ id: 'ing-2', name: 'Sugar' }),
      });

    const { default: userEvent } = await import('@testing-library/user-event');
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <InventoryPage />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByText('No ingredients yet.')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Add Ingredient' }));

    // "Add Ingredient" opens a modal (shared Dialog), not an inline toggled form.
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText('Ingredient name'), 'Sugar');
    await user.type(within(dialog).getByLabelText('Ingredient unit'), 'kg');
    await user.type(within(dialog).getByLabelText('Cost per unit'), '3');
    await user.click(within(dialog).getByRole('button', { name: 'Create Ingredient' }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenLastCalledWith(
        expect.stringContaining('/ingredients'),
        expect.objectContaining({ method: 'POST' }),
      ),
    );
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(await screen.findByTestId('ingredient-ing-2')).toBeInTheDocument();
  });

  it('AC4: editing an ingredient opens a pre-filled modal and calls PATCH /ingredients/:id', async () => {
    setOwner();
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => [makeIngredient()] })
      .mockResolvedValueOnce({ ok: true, json: async () => [makeMovement()] })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => makeIngredient({ name: 'Flour (updated)' }),
      });

    const { default: userEvent } = await import('@testing-library/user-event');
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <InventoryPage />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByTestId('ingredient-ing-1')).toBeInTheDocument());
    await user.click(within(screen.getByTestId('ingredient-ing-1')).getByRole('button', { name: 'Edit' }));

    // Row "Edit" opens a modal pre-filled with that row's values, not an inline
    // row-edit.
    const dialog = await screen.findByRole('dialog');
    expect((within(dialog).getByLabelText('Ingredient name') as HTMLInputElement).value).toBe('Flour');
    await user.click(within(dialog).getByRole('button', { name: 'Save Changes' }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenLastCalledWith(
        expect.stringContaining('/ingredients/ing-1'),
        expect.objectContaining({ method: 'PATCH' }),
      ),
    );
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('AC5: recording a stock receipt calls POST /ingredients/:id/stock/receive', async () => {
    setOwner();
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => [makeIngredient()] })
      .mockResolvedValueOnce({ ok: true, json: async () => [] })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ batch: {}, movement: makeMovement({ qty: 5 }) }),
      })
      .mockResolvedValueOnce({ ok: true, json: async () => [makeMovement({ qty: 5 })] });

    const { default: userEvent } = await import('@testing-library/user-event');
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <InventoryPage />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByTestId('ingredient-ing-1')).toBeInTheDocument());
    await user.click(
      within(screen.getByTestId('ingredient-ing-1')).getByRole('button', { name: 'Receive Stock' }),
    );
    await user.type(screen.getByLabelText('Receive quantity for Flour'), '5');
    await user.click(screen.getByRole('button', { name: 'Confirm' }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/ingredients/ing-1/stock/receive'),
        expect.objectContaining({ method: 'POST' }),
      ),
    );
  });

  it('AC6: a Viewer never renders write controls, and no write fetch is possible', async () => {
    setViewer();
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => [makeIngredient()] })
      .mockResolvedValueOnce({ ok: true, json: async () => [makeMovement()] });

    render(
      <MemoryRouter>
        <InventoryPage />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByTestId('ingredient-ing-1')).toBeInTheDocument());
    // Only the two read calls (list + movements) fire — no write endpoint is
    // ever called since no write control exists to trigger one.
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const calledMethods = fetchMock.mock.calls.map(([, init]) => (init as RequestInit | undefined)?.method);
    expect(calledMethods.every((m) => m === undefined || m === 'GET')).toBe(true);
  });

  it('AC7: API errors surface through the global error dialog, not a page crash', async () => {
    setOwner();
    const errorDialogModule = await import('../../errorDialog/ErrorDialogProvider');
    const notifySpy = vi.spyOn(errorDialogModule, 'notifyApiError');
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ message: 'Server error' }),
    });

    render(
      <MemoryRouter>
        <InventoryPage />
      </MemoryRouter>,
    );

    await waitFor(() => expect(notifySpy).toHaveBeenCalledWith('Server error'));
    // Page still renders, no crash
    expect(screen.getByText('Inventory')).toBeInTheDocument();
  });

  it('Edge case: empty ingredient list shows a sensible empty state', async () => {
    setOwner();
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => [] });

    render(
      <MemoryRouter>
        <InventoryPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText('No ingredients yet.')).toBeInTheDocument();
  });

  it('T041 AC1/AC7: create pre-fills threshold with 5 and sends it; blank threshold omits the key (not 0)', async () => {
    setOwner();
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => [] })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => makeIngredient({ id: 'ing-2', name: 'Sugar', minThreshold: 5 }),
      });

    const { default: userEvent } = await import('@testing-library/user-event');
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <InventoryPage />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByText('No ingredients yet.')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Add Ingredient' }));
    const dialog = await screen.findByRole('dialog');

    expect((within(dialog).getByLabelText('Low stock threshold') as HTMLInputElement).value).toBe('5');

    await user.type(within(dialog).getByLabelText('Ingredient name'), 'Sugar');
    await user.type(within(dialog).getByLabelText('Ingredient unit'), 'kg');
    await user.type(within(dialog).getByLabelText('Cost per unit'), '3');
    await user.click(within(dialog).getByRole('button', { name: 'Create Ingredient' }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenLastCalledWith(
        expect.stringContaining('/ingredients'),
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"minThreshold":5'),
        }),
      ),
    );
  });

  it('T041 AC7: clearing the threshold sends no minThreshold key (never 0)', async () => {
    setOwner();
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => [] })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => makeIngredient({ id: 'ing-2', name: 'Sugar', minThreshold: null }),
      });

    const { default: userEvent } = await import('@testing-library/user-event');
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <InventoryPage />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByText('No ingredients yet.')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Add Ingredient' }));
    const dialog = await screen.findByRole('dialog');

    await user.clear(within(dialog).getByLabelText('Low stock threshold'));
    await user.type(within(dialog).getByLabelText('Ingredient name'), 'Sugar');
    await user.type(within(dialog).getByLabelText('Ingredient unit'), 'kg');
    await user.type(within(dialog).getByLabelText('Cost per unit'), '3');
    await user.click(within(dialog).getByRole('button', { name: 'Create Ingredient' }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenLastCalledWith(
        expect.stringContaining('/ingredients'),
        expect.objectContaining({ method: 'POST' }),
      ),
    );
    const lastCall = fetchMock.mock.calls[fetchMock.mock.calls.length - 1];
    const sentBody = JSON.parse((lastCall[1] as RequestInit).body as string);
    expect(sentBody.minThreshold).toBeUndefined();
    expect('minThreshold' in sentBody).toBe(false);
  });

  it('T041 AC8: negative or non-numeric threshold is blocked client-side, no network call', async () => {
    setOwner();
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => [] });

    const { default: userEvent } = await import('@testing-library/user-event');
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <InventoryPage />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByText('No ingredients yet.')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Add Ingredient' }));
    const dialog = await screen.findByRole('dialog');

    await user.clear(within(dialog).getByLabelText('Low stock threshold'));
    await user.type(within(dialog).getByLabelText('Low stock threshold'), '-2');
    await user.type(within(dialog).getByLabelText('Ingredient name'), 'Sugar');
    await user.type(within(dialog).getByLabelText('Ingredient unit'), 'kg');
    await user.type(within(dialog).getByLabelText('Cost per unit'), '3');

    const callsBefore = fetchMock.mock.calls.length;
    await user.click(within(dialog).getByRole('button', { name: 'Create Ingredient' }));

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(fetchMock.mock.calls.length).toBe(callsBefore);
  });

  it('T041 AC2/AC3/AC6: edit pre-fills stored threshold and category, PATCHes both', async () => {
    setOwner();
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => [makeIngredient({ minThreshold: 3, category: 'Dry Goods' })] })
      .mockResolvedValueOnce({ ok: true, json: async () => [makeMovement()] })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => makeIngredient({ minThreshold: 7 }),
      });

    const { default: userEvent } = await import('@testing-library/user-event');
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <InventoryPage />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByTestId('ingredient-ing-1')).toBeInTheDocument());
    // T041 AC6: threshold is visible in the list row.
    expect(within(screen.getByTestId('ingredient-ing-1')).getByText(/Min: 3 kg/)).toBeInTheDocument();

    await user.click(within(screen.getByTestId('ingredient-ing-1')).getByRole('button', { name: 'Edit' }));
    const dialog = await screen.findByRole('dialog');

    expect((within(dialog).getByLabelText('Low stock threshold') as HTMLInputElement).value).toBe('3');
    await user.clear(within(dialog).getByLabelText('Low stock threshold'));
    await user.type(within(dialog).getByLabelText('Low stock threshold'), '7');
    await user.click(within(dialog).getByRole('button', { name: 'Save Changes' }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenLastCalledWith(
        expect.stringContaining('/ingredients/ing-1'),
        expect.objectContaining({
          method: 'PATCH',
          body: expect.stringContaining('"minThreshold":7'),
        }),
      ),
    );
    const lastCall = fetchMock.mock.calls[fetchMock.mock.calls.length - 1];
    const sentBody = JSON.parse((lastCall[1] as RequestInit).body as string);
    expect(sentBody.category).toBe('Dry Goods');
  });

  it('T041 edge case: editing an ingredient with no stored threshold starts blank, not 5', async () => {
    setOwner();
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => [makeIngredient({ minThreshold: null })] })
      .mockResolvedValueOnce({ ok: true, json: async () => [makeMovement()] });

    const { default: userEvent } = await import('@testing-library/user-event');
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <InventoryPage />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByTestId('ingredient-ing-1')).toBeInTheDocument());
    await user.click(within(screen.getByTestId('ingredient-ing-1')).getByRole('button', { name: 'Edit' }));
    const dialog = await screen.findByRole('dialog');

    expect((within(dialog).getByLabelText('Low stock threshold') as HTMLInputElement).value).toBe('');
  });

  it('Edge case: zero/negative stock values render without crashing', async () => {
    setOwner();
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => [makeIngredient()] })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [makeMovement({ type: 'CONSUME', qty: 20 })],
      });

    render(
      <MemoryRouter>
        <InventoryPage />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByTestId('ingredient-ing-1')).toBeInTheDocument());
    expect(within(screen.getByTestId('ingredient-ing-1')).getByText(/Stock: -20 kg/)).toBeInTheDocument();
  });
});
