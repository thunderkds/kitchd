import { io, type Socket } from 'socket.io-client';
import { getToken } from '../../routes/auth';

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';

export type RealtimeEvent = 'task.updated' | 'comment.created' | 'announcement.created';

interface EventEnvelope {
  eventId: string;
  [key: string]: unknown;
}

let socket: Socket | null = null;
// Bounded set of recently-seen event ids, so a reconnect that happens
// to overlap with an in-flight broadcast can never deliver the same
// event twice to the app (defense in depth — the server itself never
// buffers/replays events missed while disconnected, per T017's Edge
// Case Checklist).
const seenEventIds = new Set<string>();
const MAX_SEEN_IDS = 500;

function rememberEventId(eventId: string): boolean {
  if (seenEventIds.has(eventId)) return false;
  seenEventIds.add(eventId);
  if (seenEventIds.size > MAX_SEEN_IDS) {
    const oldest = seenEventIds.values().next().value;
    if (oldest !== undefined) seenEventIds.delete(oldest);
  }
  return true;
}

export function connectSocket(): Socket {
  if (socket) return socket;
  socket = io(API_BASE, {
    auth: { token: getToken() ?? '' },
  });
  return socket;
}

export function disconnectSocket(): void {
  socket?.disconnect();
  socket = null;
  seenEventIds.clear();
}

/**
 * Subscribes to a realtime event, deduping by `eventId` so a
 * reconnecting client never double-processes an event it already saw.
 */
export function onRealtimeEvent<T extends EventEnvelope>(
  event: RealtimeEvent,
  handler: (payload: T) => void,
): () => void {
  const client = connectSocket();
  const wrapped = (payload: T) => {
    if (rememberEventId(payload.eventId)) {
      handler(payload);
    }
  };
  client.on(event, wrapped);
  return () => client.off(event, wrapped);
}
