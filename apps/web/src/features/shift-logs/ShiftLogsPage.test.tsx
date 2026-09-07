import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import * as shiftLogsApi from './api';
import type { ShiftLog } from './types';

let currentUser: {
  id: string;
  email: string;
  organizationId: string;
  kitchenId: string;
  role: 'OWNER' | 'ADMIN' | 'CHEF' | 'STAFF' | 'VIEWER';
  themePreference?: 'simple' | 'dark-neon';
} | null = null;

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

import { ShiftLogsPage } from './ShiftLogsPage';
import { setUser, clearUser } from '../../routes/auth';

function makeShiftLog(overrides: Partial<ShiftLog> = {}): ShiftLog {
  return {
    id: 'log-1',
    kitchenId: 'kitchen-1',
    authorId: 'user-1',
    shift: 'MORNING',
    body: 'Prepped the walk-in',
    createdAt: '2026-09-07T08:00:00.000Z',
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

function setStaff() {
  setUser({
    id: 'staff-1',
    email: 'staff@example.com',
    organizationId: 'org-1',
    kitchenId: 'kitchen-1',
    role: 'STAFF',
  });
}

describe('ShiftLogsPage', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    currentUser = null;
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(shiftLogsApi, 'createShiftLog');
    vi.spyOn(shiftLogsApi, 'listShiftLogs');
  });

  afterEach(() => {
    clearUser();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('renders the shift-log feed newest-first from GET /shift-logs', async () => {
    setOwner();
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => [
        makeShiftLog({ id: 'log-2', shift: 'EVENING', body: 'Closed the line', createdAt: '2026-09-07T17:00:00.000Z' }),
        makeShiftLog(),
      ],
    });

    render(
      <MemoryRouter>
        <ShiftLogsPage />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByTestId('shift-logs-list')).toBeInTheDocument());
    const rows = screen.getAllByTestId('shift-log-row');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent('Evening');
    expect(rows[0]).toHaveTextContent('Closed the line');
    expect(rows[1]).toHaveTextContent('Morning');
    expect(screen.getByText('Shift Log')).toBeInTheDocument();
  });

  it('lets a writer create a shift log and append it to the feed', async () => {
    setStaff();
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => [] })
      .mockResolvedValueOnce({ ok: true, json: async () => makeShiftLog({ id: 'log-2', shift: 'EVENING', body: 'Closed the line' }) });

    const { default: userEvent } = await import('@testing-library/user-event');
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <ShiftLogsPage />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByRole('button', { name: 'New Shift Log' })).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'New Shift Log' }));

    const dialog = await screen.findByRole('dialog');
    await user.selectOptions(within(dialog).getByLabelText('Shift'), 'EVENING');
    await user.type(within(dialog).getByLabelText('Shift log body'), 'Closed the line');
    await user.click(within(dialog).getByRole('button', { name: 'Add Shift Log' }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenLastCalledWith(
        expect.stringContaining('/shift-logs'),
        expect.objectContaining({ method: 'POST' }),
      ),
    );
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(await screen.findByText('Closed the line')).toBeInTheDocument();
  });

  it('Viewer sees the feed but not the create control', async () => {
    setViewer();
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => [makeShiftLog()] });

    render(
      <MemoryRouter>
        <ShiftLogsPage />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByTestId('shift-logs-list')).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: 'New Shift Log' })).not.toBeInTheDocument();
  });

  it('shows an empty state when there are no shift logs', async () => {
    setOwner();
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => [] });

    render(
      <MemoryRouter>
        <ShiftLogsPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText('No shift logs yet.')).toBeInTheDocument();
  });

  it('surfaces a failed list fetch through the existing error surface', async () => {
    setOwner();
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ message: 'Server error' }),
    });

    render(
      <MemoryRouter>
        <ShiftLogsPage />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('alert')).toHaveTextContent('Server error');
  });
});
