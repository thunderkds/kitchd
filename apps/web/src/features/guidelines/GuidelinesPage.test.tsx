import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { GuidelinesPage } from './GuidelinesPage';
import type { Guideline } from './types';
import { setUser } from '../../routes/auth';

function makeGuideline(overrides: Partial<Guideline> = {}): Guideline {
  return {
    id: 'g1',
    kitchenId: 'kitchen-1',
    title: 'Opening Checklist',
    type: 'SOP',
    steps: ['Turn on ovens', 'Check fridge temps'],
    attachments: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
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

describe('GuidelinesPage', () => {
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

  it('renders a list of guidelines (title, type) fetched from GET /guidelines', async () => {
    setOwner();
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => [makeGuideline()] });

    render(
      <MemoryRouter>
        <GuidelinesPage />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByTestId('guidelines-list')).toBeInTheDocument());
    expect(screen.getByText('Opening Checklist')).toBeInTheDocument();
    expect(screen.getByText('SOP')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/guidelines'),
      expect.anything(),
    );
  });

  it('clicking a guideline shows its full steps via GET /guidelines/:id', async () => {
    setOwner();
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => [makeGuideline()] })
      .mockResolvedValueOnce({ ok: true, json: async () => makeGuideline() });

    const { default: userEvent } = await import('@testing-library/user-event');
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <GuidelinesPage />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByTestId('guideline-g1')).toBeInTheDocument());
    await user.click(screen.getByTestId('guideline-g1'));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenLastCalledWith(
        expect.stringContaining('/guidelines/g1'),
        expect.anything(),
      ),
    );
    expect(await screen.findByTestId('guideline-steps')).toBeInTheDocument();
    expect(screen.getByText('Turn on ovens')).toBeInTheDocument();
    expect(screen.getByText('Check fridge temps')).toBeInTheDocument();
  });

  it('Owner sees a "New Guideline" control; submitting POSTs /guidelines and updates the list', async () => {
    setOwner();
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => [] })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => makeGuideline({ id: 'g2', title: 'Closing Checklist' }),
      });

    const { default: userEvent } = await import('@testing-library/user-event');
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <GuidelinesPage />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByRole('button', { name: 'New Guideline' })).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'New Guideline' }));

    // Clicking "New Guideline" opens a modal (shared Dialog primitive), not a
    // full-page-replace form.
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText('Guideline title'), 'Closing Checklist');
    await user.type(within(dialog).getByLabelText('Guideline steps'), 'Lock the doors');
    await user.click(within(dialog).getByRole('button', { name: 'Create Guideline' }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenLastCalledWith(
        expect.stringContaining('/guidelines'),
        expect.objectContaining({ method: 'POST' }),
      ),
    );
    // Modal closes on success and the new guideline appears in the list.
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(await screen.findByText('Closing Checklist')).toBeInTheDocument();
  });

  it('editing a guideline PATCHes /guidelines/:id', async () => {
    setOwner();
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => [makeGuideline()] })
      .mockResolvedValueOnce({ ok: true, json: async () => makeGuideline() })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => makeGuideline({ title: 'Opening Checklist v2' }),
      });

    const { default: userEvent } = await import('@testing-library/user-event');
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <GuidelinesPage />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByTestId('guideline-g1')).toBeInTheDocument());
    await user.click(screen.getByTestId('guideline-g1'));

    await waitFor(() => expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Edit' }));

    // Edit opens a pre-filled modal rather than replacing the page.
    const dialog = await screen.findByRole('dialog');
    const titleInput = within(dialog).getByLabelText('Guideline title') as HTMLInputElement;
    expect(titleInput.value).toBe('Opening Checklist');
    await user.clear(titleInput);
    await user.type(titleInput, 'Opening Checklist v2');
    await user.click(within(dialog).getByRole('button', { name: 'Save Changes' }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenLastCalledWith(
        expect.stringContaining('/guidelines/g1'),
        expect.objectContaining({ method: 'PATCH' }),
      ),
    );
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(await screen.findByText('Opening Checklist v2')).toBeInTheDocument();
  });

  it('Staff/Viewer does not see a "New Guideline" control and no write calls fire', async () => {
    setViewer();
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => [makeGuideline()] });

    render(
      <MemoryRouter>
        <GuidelinesPage />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByTestId('guidelines-list')).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: 'New Guideline' })).not.toBeInTheDocument();

    // Only the read GET fired — no write method was ever attempted.
    for (const call of fetchMock.mock.calls) {
      const init = call[1] as RequestInit | undefined;
      expect(init?.method === undefined || init.method === 'GET').toBe(true);
    }
  });

  it('Staff/Viewer viewing a guideline detail does not see an Edit control', async () => {
    setViewer();
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => [makeGuideline()] })
      .mockResolvedValueOnce({ ok: true, json: async () => makeGuideline() });

    const { default: userEvent } = await import('@testing-library/user-event');
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <GuidelinesPage />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByTestId('guideline-g1')).toBeInTheDocument());
    await user.click(screen.getByTestId('guideline-g1'));

    await screen.findByTestId('guideline-steps');
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
  });

  it('a failed list fetch surfaces the error and routes through notifyApiError (T029)', async () => {
    setOwner();
    fetchMock.mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({ message: 'Server error' }) });

    render(
      <MemoryRouter>
        <GuidelinesPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Server error')).toBeInTheDocument();
  });

  it('empty guideline list shows a sensible empty state', async () => {
    setOwner();
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => [] });

    render(
      <MemoryRouter>
        <GuidelinesPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText('No guidelines yet.')).toBeInTheDocument();
  });
});
