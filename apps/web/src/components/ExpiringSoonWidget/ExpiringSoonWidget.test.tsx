import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { ExpiringSoonWidget } from './ExpiringSoonWidget';
import * as api from './api';

describe('ExpiringSoonWidget', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders a list of batches that are expiring soon', async () => {
    vi.spyOn(api, 'fetchExpiringSoon').mockResolvedValue([
      {
        id: 'batch-1',
        ingredientId: 'ing-1',
        qty: 5,
        expiryDate: '2026-09-10T00:00:00.000Z',
        location: 'Dry storage',
        createdAt: '2026-09-01T00:00:00.000Z',
        ingredient: { id: 'ing-1', name: 'Milk', unit: 'L' },
      },
    ]);

    render(<ExpiringSoonWidget />);

    await waitFor(() =>
      expect(screen.getByTestId('expiring-soon-row-batch-1')).toBeInTheDocument(),
    );
    expect(screen.getByTestId('expiring-soon-row-batch-1')).toHaveTextContent('Milk');
  });

  it('shows an empty state when nothing is expiring soon', async () => {
    vi.spyOn(api, 'fetchExpiringSoon').mockResolvedValue([]);

    render(<ExpiringSoonWidget />);

    await waitFor(() =>
      expect(screen.getByTestId('expiring-soon-empty')).toBeInTheDocument(),
    );
  });

  it('shows an error message if the fetch fails', async () => {
    vi.spyOn(api, 'fetchExpiringSoon').mockRejectedValue(new Error('boom'));

    render(<ExpiringSoonWidget />);

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('boom'));
  });
});
