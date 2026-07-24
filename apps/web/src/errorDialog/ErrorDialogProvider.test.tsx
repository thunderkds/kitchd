import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ErrorDialogProvider, notifyApiError } from './ErrorDialogProvider';

describe('ErrorDialogProvider / notifyApiError (T029)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('AC1: shows the server error message when notifyApiError is called with a message', async () => {
    render(
      <ErrorDialogProvider>
        <div>app content</div>
      </ErrorDialogProvider>,
    );

    notifyApiError('Ingredient not found');

    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
    expect(screen.getByTestId('error-dialog-message')).toHaveTextContent('Ingredient not found');
  });

  it('AC2: falls back to a generic message when no message is provided', async () => {
    render(
      <ErrorDialogProvider>
        <div>app content</div>
      </ErrorDialogProvider>,
    );

    notifyApiError(undefined);

    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
    expect(screen.getByTestId('error-dialog-message')).not.toHaveTextContent('undefined');
    expect(screen.getByTestId('error-dialog-message').textContent?.length).toBeGreaterThan(0);
  });

  it('AC3: close button dismisses the dialog and app remains usable', async () => {
    const user = userEvent.setup();
    render(
      <ErrorDialogProvider>
        <div>app content</div>
      </ErrorDialogProvider>,
    );

    notifyApiError('Boom');
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /close/i }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByText('app content')).toBeInTheDocument();
  });

  it('AC3: overlay click dismisses the dialog', async () => {
    const user = userEvent.setup();
    render(
      <ErrorDialogProvider>
        <div>app content</div>
      </ErrorDialogProvider>,
    );

    notifyApiError('Boom');
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());

    await user.click(screen.getByRole('dialog'));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('AC5: two failures in quick succession update the message rather than stacking dialogs', async () => {
    render(
      <ErrorDialogProvider>
        <div>app content</div>
      </ErrorDialogProvider>,
    );

    notifyApiError('First failure');
    notifyApiError('Second failure');

    await waitFor(() => expect(screen.getAllByRole('dialog')).toHaveLength(1));
    expect(screen.getByTestId('error-dialog-message')).toHaveTextContent('Second failure');
  });

  it('AC6: mounting without calling notifyApiError never shows a dialog', () => {
    render(
      <ErrorDialogProvider>
        <div>app content</div>
      </ErrorDialogProvider>,
    );

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
