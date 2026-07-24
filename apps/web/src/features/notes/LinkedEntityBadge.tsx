import { useEffect, useState } from 'react';
import { getToken } from '../../routes/auth';
import type { LinkedEntityType } from './types';

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';

/**
 * Best-effort resolution of a Note's polymorphic link. The link itself
 * has no FK (see Note.linkedEntityType/Id) so a linked Task/Recipe/
 * Ingredient may have been deleted since the Note was created — this
 * must render a graceful fallback, never crash (Edge Case Checklist).
 *
 * Only `task` has a frontend GET-by-id today (Recipes/Ingredients have
 * no frontend module yet in this milestone), so resolution is
 * best-effort: unresolved types render the raw type/id without a live
 * existence check rather than adding speculative fetch plumbing.
 */
export function LinkedEntityBadge({
  type,
  id,
}: {
  type: LinkedEntityType;
  id: string;
}) {
  const [state, setState] = useState<'loading' | 'found' | 'missing' | 'unknown'>(
    type === 'task' ? 'loading' : 'unknown',
  );
  const [title, setTitle] = useState<string | null>(null);

  useEffect(() => {
    if (type !== 'task') return;
    let cancelled = false;
    fetch(`${API_BASE}/tasks/${id}`, {
      headers: { Authorization: `Bearer ${getToken() ?? ''}` },
    })
      .then(async (res) => {
        if (cancelled) return;
        if (!res.ok) {
          setState('missing');
          return;
        }
        const data = await res.json();
        setTitle(data.title ?? null);
        setState('found');
      })
      .catch(() => {
        if (!cancelled) setState('missing');
      });
    return () => {
      cancelled = true;
    };
  }, [type, id]);

  if (state === 'missing') {
    return (
      <span className="text-xs italic text-muted" data-testid="linked-entity-missing">
        Linked item no longer exists
      </span>
    );
  }

  return (
    <span className="text-xs text-muted" data-testid="linked-entity-badge">
      Linked to {type}
      {title ? `: ${title}` : ` #${id.slice(0, 8)}`}
    </span>
  );
}
