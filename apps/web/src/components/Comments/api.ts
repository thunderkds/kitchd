import { getToken } from '../../routes/auth';

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';

export type EntityType = 'recipe' | 'task' | 'ingredient';

export interface CommentItem {
  id: string;
  entityType: EntityType;
  entityId: string;
  authorId: string;
  body: string;
  mentions: string[];
  parentId: string | null;
  createdAt: string;
}

async function handle<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(data?.message ?? `Request failed (${res.status})`);
  }
  return data as T;
}

// T015 — standalone Comments component API client. Fetches/posts against
// the polymorphic /comments endpoint scoped by (entityType, entityId).
// Kept local to the component, same pattern as T007's LowStockWidget/api.ts.
export async function fetchComments(
  entityType: EntityType,
  entityId: string,
): Promise<CommentItem[]> {
  const res = await fetch(
    `${API_BASE}/comments?entityType=${encodeURIComponent(entityType)}&entityId=${encodeURIComponent(entityId)}`,
    {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${getToken() ?? ''}`,
      },
    },
  );
  return handle<CommentItem[]>(res);
}

export async function postComment(
  entityType: EntityType,
  entityId: string,
  body: string,
  parentId?: string,
): Promise<CommentItem> {
  const res = await fetch(`${API_BASE}/comments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getToken() ?? ''}`,
    },
    body: JSON.stringify({ entityType, entityId, body, parentId }),
  });
  return handle<CommentItem>(res);
}
