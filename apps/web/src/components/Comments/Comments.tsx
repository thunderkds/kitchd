import { useEffect, useState } from 'react';
import { fetchComments, postComment, type CommentItem, type EntityType } from './api';

interface CommentsProps {
  entityType: EntityType;
  entityId: string;
}

/**
 * T015 — standalone, host-page-agnostic Comments thread component (same
 * pattern as T007's LowStockWidget). Attaches to any Recipe/Task/Ingredient
 * via (entityType, entityId) — no detail page exists yet to mount this on
 * (see Supervisor scope correction 2026-07-05), so it performs its own
 * fetch/post and has no dependency on a host page/shell.
 *
 * Reply threading is single-level only for MVP: a reply's `parentId` must
 * reference a top-level comment (server-enforced) — this component only
 * ever renders one level of nesting, matching that contract.
 */
export function Comments({ entityType, entityId }: CommentsProps) {
  const [comments, setComments] = useState<CommentItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function load() {
    fetchComments(entityType, entityId)
      .then(setComments)
      .catch((err: Error) => setError(err.message));
  }

  useEffect(() => {
    setComments(null);
    setError(null);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityType, entityId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      await postComment(entityType, entityId, draft, replyTo ?? undefined);
      setDraft('');
      setReplyTo(null);
      load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  const topLevel = (comments ?? []).filter((c) => !c.parentId);
  const repliesOf = (parentId: string) =>
    (comments ?? []).filter((c) => c.parentId === parentId);

  return (
    <div className="border rounded-lg p-4 w-full" data-testid="comments">
      <h3 className="text-sm font-semibold text-gray-900 mb-3">Comments</h3>

      {error && (
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      )}

      {!error && comments === null && (
        <p className="text-sm text-gray-500">Loading…</p>
      )}

      {!error && comments !== null && topLevel.length === 0 && (
        <p className="text-sm text-gray-500" data-testid="comments-empty">
          No comments yet.
        </p>
      )}

      {!error && comments !== null && topLevel.length > 0 && (
        <ul className="divide-y" data-testid="comments-list">
          {topLevel.map((comment) => (
            <li key={comment.id} data-testid={`comment-${comment.id}`} className="py-2">
              <p className="text-sm text-gray-900">{comment.body}</p>
              {comment.mentions.length > 0 && (
                <div className="flex gap-1 mt-1">
                  {comment.mentions.map((userId) => (
                    <span
                      key={userId}
                      className="text-xs bg-blue-50 text-blue-700 rounded px-1.5 py-0.5"
                      data-testid={`mention-chip-${userId}`}
                    >
                      @{userId}
                    </span>
                  ))}
                </div>
              )}
              <button
                type="button"
                className="text-xs text-gray-500 mt-1"
                onClick={() => setReplyTo(comment.id)}
                data-testid={`reply-button-${comment.id}`}
              >
                Reply
              </button>

              {repliesOf(comment.id).length > 0 && (
                <ul className="pl-4 mt-1 space-y-1" data-testid={`replies-${comment.id}`}>
                  {repliesOf(comment.id).map((reply) => (
                    <li key={reply.id} data-testid={`comment-${reply.id}`}>
                      <p className="text-sm text-gray-700">{reply.body}</p>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={handleSubmit} className="mt-3 flex flex-col gap-2">
        {replyTo && (
          <div className="text-xs text-gray-500 flex items-center gap-2">
            Replying to a comment
            <button
              type="button"
              className="underline"
              onClick={() => setReplyTo(null)}
            >
              cancel
            </button>
          </div>
        )}
        <textarea
          className="border rounded p-2 text-sm w-full"
          placeholder="Write a comment… use @username to mention a teammate"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          data-testid="comment-input"
        />
        <button
          type="submit"
          disabled={submitting || !draft.trim()}
          className="self-end text-sm bg-blue-600 text-white rounded px-3 py-1.5 disabled:opacity-50"
          data-testid="comment-submit"
        >
          Post
        </button>
      </form>
    </div>
  );
}
