import { getToken } from '../../routes/auth';
import { notifyApiError } from '../../errorDialog/ErrorDialogProvider';

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

// T029 — fetch() itself can reject outright (network failure) before a
// Response ever exists; wrap each call site so that case also surfaces
// the shared dialog instead of an unhandled rejection (Acceptance
// Criterion 2).
async function safeFetch(input: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(input, init);
  } catch {
    const message = 'Network error — unable to reach the server. Please check your connection and try again.';
    notifyApiError(message);
    throw new Error(message);
  }
}

async function handle<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const message = data?.message ?? `Request failed (${res.status})`;
    notifyApiError(message);
    throw new Error(message);
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
  const res = await safeFetch(
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
  const res = await safeFetch(`${API_BASE}/comments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getToken() ?? ''}`,
    },
    body: JSON.stringify({ entityType, entityId, body, parentId }),
  });
  return handle<CommentItem>(res);
}
