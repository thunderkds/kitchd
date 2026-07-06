import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const handlers: Record<string, (payload: unknown) => void> = {};

const mockSocket = {
  on: vi.fn((event: string, cb: (payload: unknown) => void) => {
    handlers[event] = cb;
  }),
  off: vi.fn((event: string) => {
    delete handlers[event];
  }),
  disconnect: vi.fn(),
};

vi.mock('socket.io-client', () => ({
  io: vi.fn(() => mockSocket),
}));

vi.mock('../../routes/auth', () => ({
  getToken: () => 'test-token',
}));

describe('onRealtimeEvent', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    mockSocket.on.mockClear();
    mockSocket.off.mockClear();
  });

  // AC3: client-side dedupe by eventId — a reconnecting client that
  // re-receives a buffered event must not double-process it.
  it('does not invoke the handler twice for the same eventId', async () => {
    const { onRealtimeEvent } = await import('./socket');
    const handler = vi.fn();

    onRealtimeEvent('task.updated', handler);
    const emit = handlers['task.updated'];

    emit({ eventId: 'evt-1', task: { id: 't1' } });
    emit({ eventId: 'evt-1', task: { id: 't1' } });
    emit({ eventId: 'evt-2', task: { id: 't1' } });

    expect(handler).toHaveBeenCalledTimes(2);
  });

  it('unsubscribes via the returned cleanup function', async () => {
    const { onRealtimeEvent } = await import('./socket');
    const handler = vi.fn();

    const unsubscribe = onRealtimeEvent('task.updated', handler);
    unsubscribe();

    expect(mockSocket.off).toHaveBeenCalledWith('task.updated', expect.any(Function));
  });
});
