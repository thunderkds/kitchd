import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { LowStockWidget } from './LowStockWidget';
import * as api from './api';

describe('LowStockWidget', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders a list of below-threshold ingredients', async () => {
    vi.spyOn(api, 'fetchLowStock').mockResolvedValue([
      { id: 'ing-1', name: 'Flour', unit: 'kg', minThreshold: 5, currentStock: 2 },
    ]);

    render(<LowStockWidget />);

    await waitFor(() =>
      expect(screen.getByTestId('low-stock-row-ing-1')).toBeInTheDocument(),
    );
    expect(screen.getByText('Flour')).toBeInTheDocument();
  });

  it('shows an empty state when nothing is low on stock', async () => {
    vi.spyOn(api, 'fetchLowStock').mockResolvedValue([]);

    render(<LowStockWidget />);

    await waitFor(() =>
      expect(screen.getByTestId('low-stock-empty')).toBeInTheDocument(),
    );
  });

  it('shows an error message if the fetch fails', async () => {
    vi.spyOn(api, 'fetchLowStock').mockRejectedValue(new Error('boom'));

    render(<LowStockWidget />);

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('boom'));
  });
});
