import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Comments } from './Comments';
import * as api from './api';

describe('Comments', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders a list of top-level comments for the given entity', async () => {
    vi.spyOn(api, 'fetchComments').mockResolvedValue([
      {
        id: 'c-1',
        entityType: 'task',
        entityId: 'task-1',
        authorId: 'u-1',
        body: 'Looks good',
        mentions: [],
        parentId: null,
        createdAt: new Date().toISOString(),
      },
    ]);

    render(<Comments entityType="task" entityId="task-1" />);

    await waitFor(() =>
      expect(screen.getByTestId('comment-c-1')).toBeInTheDocument(),
    );
    expect(screen.getByText('Looks good')).toBeInTheDocument();
  });

  it('shows an empty state when there are no comments', async () => {
    vi.spyOn(api, 'fetchComments').mockResolvedValue([]);

    render(<Comments entityType="task" entityId="task-1" />);

    await waitFor(() =>
      expect(screen.getByTestId('comments-empty')).toBeInTheDocument(),
    );
  });

  it('shows an error message if the fetch fails', async () => {
    vi.spyOn(api, 'fetchComments').mockRejectedValue(new Error('boom'));

    render(<Comments entityType="task" entityId="task-1" />);

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('boom'));
  });

  it('renders resolved mentions as chips', async () => {
    vi.spyOn(api, 'fetchComments').mockResolvedValue([
      {
        id: 'c-2',
        entityType: 'task',
        entityId: 'task-1',
        authorId: 'u-1',
        body: '@bob check this',
        mentions: ['user-bob-id'],
        parentId: null,
        createdAt: new Date().toISOString(),
      },
    ]);

    render(<Comments entityType="task" entityId="task-1" />);

    await waitFor(() =>
      expect(screen.getByTestId('mention-chip-user-bob-id')).toBeInTheDocument(),
    );
  });

  it('renders a reply nested one level under its parent', async () => {
    vi.spyOn(api, 'fetchComments').mockResolvedValue([
      {
        id: 'c-3',
        entityType: 'task',
        entityId: 'task-1',
        authorId: 'u-1',
        body: 'Top comment',
        mentions: [],
        parentId: null,
        createdAt: new Date().toISOString(),
      },
      {
        id: 'c-4',
        entityType: 'task',
        entityId: 'task-1',
        authorId: 'u-2',
        body: 'A reply',
        mentions: [],
        parentId: 'c-3',
        createdAt: new Date().toISOString(),
      },
    ]);

    render(<Comments entityType="task" entityId="task-1" />);

    await waitFor(() =>
      expect(screen.getByTestId('replies-c-3')).toBeInTheDocument(),
    );
    expect(screen.getByText('A reply')).toBeInTheDocument();
  });

  it('submits a new comment and reloads the thread', async () => {
    vi.spyOn(api, 'fetchComments').mockResolvedValue([]);
    const postSpy = vi.spyOn(api, 'postComment').mockResolvedValue({
      id: 'c-5',
      entityType: 'task',
      entityId: 'task-1',
      authorId: 'u-1',
      body: 'New comment',
      mentions: [],
      parentId: null,
      createdAt: new Date().toISOString(),
    });

    render(<Comments entityType="task" entityId="task-1" />);
    await waitFor(() => expect(screen.getByTestId('comments-empty')).toBeInTheDocument());

    const user = userEvent.setup();
    await user.type(screen.getByTestId('comment-input'), 'New comment');
    await user.click(screen.getByTestId('comment-submit'));

    await waitFor(() =>
      expect(postSpy).toHaveBeenCalledWith('task', 'task-1', 'New comment', undefined),
    );
  });
});
