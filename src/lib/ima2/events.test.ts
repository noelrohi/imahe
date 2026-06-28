import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  subscribeToEvents,
  type EventSourceConstructor,
  type EventSourceLike,
  type Ima2SseEvent,
} from './events';

class FakeEventSource implements EventSourceLike {
  static instances: FakeEventSource[] = [];

  readonly listeners = new Map<string, Set<(event: Event) => void>>();
  readonly url: string | URL;
  closed = false;

  constructor(url: string | URL) {
    this.url = url;
    FakeEventSource.instances.push(this);
  }

  addEventListener(type: string, listener: (event: Event) => void) {
    const listeners = this.listeners.get(type) ?? new Set<(event: Event) => void>();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type: string, listener: (event: Event) => void) {
    this.listeners.get(type)?.delete(listener);
  }

  close() {
    this.closed = true;
  }

  emit(type: string, data: unknown, lastEventId = '42') {
    this.emitEvent(
      type,
      new MessageEvent(type, {
        data: JSON.stringify(data),
        lastEventId,
      }),
    );
  }

  emitRaw(type: string, data: string, lastEventId = '42') {
    this.emitEvent(
      type,
      new MessageEvent(type, {
        data,
        lastEventId,
      }),
    );
  }

  emitConnectionError() {
    this.emitEvent('error', new Event('error'));
  }

  private emitEvent(type: string, event: Event) {
    this.listeners.get(type)?.forEach((listener) => listener(event));
  }
}

const FakeEventSourceConstructor = FakeEventSource as unknown as EventSourceConstructor;

describe('subscribeToEvents', () => {
  beforeEach(() => {
    FakeEventSource.instances = [];
  });

  it('subscribes to named ima2 SSE events and dispatches typed payloads', () => {
    const received: Ima2SseEvent[] = [];
    const replayGap = vi.fn();
    const namedError = vi.fn();

    const unsubscribe = subscribeToEvents(
      'http://127.0.0.1:4890',
      {
        onEvent: (event) => received.push(event),
        onReplayGap: replayGap,
        onError: namedError,
      },
      { EventSource: FakeEventSourceConstructor },
    );

    const source = FakeEventSource.instances[0];
    expect(String(source.url)).toBe('http://127.0.0.1:4890/api/events');

    source.emit('phase', { requestId: 'req_1', phase: 'streaming' }, '1');
    source.emit('image', { jobId: 'req_1', filename: 'cat.png', image: 'data:image/png;base64,abc' }, '2');
    source.emit('done', { requestId: 'req_1', ok: true, filename: 'cat.png' }, '3');
    source.emit('error', { requestId: 'req_2', error: 'failed', code: 'BOOM' }, '4');
    source.emit('replay-gap', { lastEventId: 1, oldestAvailableId: 10 }, '5');

    expect(received.map((event) => event.type)).toEqual([
      'phase',
      'image',
      'done',
      'error',
      'replay-gap',
    ]);
    expect(received[0]).toMatchObject({
      type: 'phase',
      data: { requestId: 'req_1', phase: 'streaming' },
      lastEventId: '1',
    });
    expect(namedError).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'error', data: expect.objectContaining({ code: 'BOOM' }) }),
    );
    expect(replayGap).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'replay-gap',
        data: { lastEventId: 1, oldestAvailableId: 10 },
      }),
    );

    unsubscribe();
    expect(source.closed).toBe(true);

    source.emit('phase', { requestId: 'req_1', phase: 'ignored' }, '6');
    expect(received).toHaveLength(5);
  });

  it('reports malformed event data without dispatching it', () => {
    const invalid = vi.fn();
    const onPhase = vi.fn();
    const logger = { warn: vi.fn() };

    subscribeToEvents(
      'http://127.0.0.1:4890',
      {
        onInvalidEvent: invalid,
        onPhase,
      },
      { EventSource: FakeEventSourceConstructor, logger },
    );

    const source = FakeEventSource.instances[0];
    source.emitRaw('phase', '{not-json', '7');
    source.emit('phase', { phase: 'missing request id' }, '8');

    expect(onPhase).not.toHaveBeenCalled();
    expect(invalid).toHaveBeenCalledTimes(2);
    expect(invalid.mock.calls[0][1]).toMatchObject({
      type: 'phase',
      rawData: '{not-json',
      lastEventId: '7',
    });
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('separates EventSource connection errors from named error payloads', () => {
    const connectionError = vi.fn();
    const namedError = vi.fn();

    subscribeToEvents(
      'http://127.0.0.1:4890',
      {
        onConnectionError: connectionError,
        onError: namedError,
      },
      { EventSource: FakeEventSourceConstructor },
    );

    FakeEventSource.instances[0].emitConnectionError();

    expect(connectionError).toHaveBeenCalledTimes(1);
    expect(namedError).not.toHaveBeenCalled();
  });

  it('passes lastEventId as a reconnect query parameter', () => {
    subscribeToEvents(
      'http://127.0.0.1:4890/root',
      { onReplayGap: vi.fn() },
      { EventSource: FakeEventSourceConstructor, lastEventId: 123 },
    );

    expect(String(FakeEventSource.instances[0].url)).toBe(
      'http://127.0.0.1:4890/api/events?lastEventId=123',
    );
  });
});
