import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CompleteTaskDialog } from './CompleteTaskDialog';
import type { CompletionPreview } from '../types';

function makePreview(overrides: Partial<CompletionPreview> = {}): CompletionPreview {
  return {
    requiresConfirmation: true,
    deductions: [
      {
        ingredientId: 'ingredient-1',
        deductQty: 6,
        currentStock: 10,
        resultingStock: 4,
        wouldGoNegative: false,
      },
    ],
    hasNegativeWarning: false,
    ...overrides,
  };
}

describe('CompleteTaskDialog', () => {
  it('lists each ingredient deduction and calls onConfirm/onCancel', async () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();

    render(
      <CompleteTaskDialog
        preview={makePreview()}
        loading={false}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByTestId('deduction-row-ingredient-1')).toBeInTheDocument();
    expect(screen.getByText(/-6/)).toBeInTheDocument();

    const { default: userEvent } = await import('@testing-library/user-event');
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('shows a negative-stock warning banner but does not block confirming', () => {
    render(
      <CompleteTaskDialog
        preview={makePreview({
          hasNegativeWarning: true,
          deductions: [
            {
              ingredientId: 'ingredient-1',
              deductQty: 5,
              currentStock: 2,
              resultingStock: -3,
              wouldGoNegative: true,
            },
          ],
        })}
        loading={false}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByText(/go below zero/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Confirm' })).not.toBeDisabled();
  });

  // T035 — FR-008: the confirmation must be human-reviewable by ingredient
  // name, not a raw UUID prefix.
  it('T035: shows the ingredient name instead of a raw id when a lookup is provided', () => {
    render(
      <CompleteTaskDialog
        preview={makePreview()}
        loading={false}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
        ingredientNameById={{ 'ingredient-1': 'Basil' }}
      />,
    );

    expect(screen.getByText('Basil')).toBeInTheDocument();
    expect(screen.queryByText('ingredie')).not.toBeInTheDocument();
  });

  it('T035: falls back to the raw id prefix when no name lookup matches (deleted ingredient)', () => {
    render(
      <CompleteTaskDialog
        preview={makePreview()}
        loading={false}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
        ingredientNameById={{}}
      />,
    );

    expect(screen.getByText('ingredie')).toBeInTheDocument();
  });

  it('disables both buttons while loading', () => {
    render(
      <CompleteTaskDialog
        preview={makePreview()}
        loading
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Confirming/ })).toBeDisabled();
  });
});
