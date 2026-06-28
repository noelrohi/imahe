import {
  ima2SseEventPayloadSchemas,
  type Ima2SseEventName,
  type SseDoneEventPayload,
  type SseErrorEventPayload,
  type SseImageEventPayload,
  type SsePartialEventPayload,
  type SsePhaseEventPayload,
  type SseReplayGapEventPayload,
} from './schemas';

type EventSourceListener = (event: Event) => void;

export type EventSourceLike = {
  addEventListener: (type: string, listener: EventSourceListener) => void;
  removeEventListener: (type: string, listener: EventSourceListener) => void;
  close: () => void;
};

export type EventSourceConstructor = new (
  url: string | URL,
  eventSourceInitDict?: EventSourceInit,
) => EventSourceLike;

export type Ima2SseEventPayloadByName = {
  phase: SsePhaseEventPayload;
  partial: SsePartialEventPayload;
  image: SseImageEventPayload;
  done: SseDoneEventPayload;
  error: SseErrorEventPayload;
  'replay-gap': SseReplayGapEventPayload;
};

export type Ima2SseEvent<TName extends Ima2SseEventName = Ima2SseEventName> = {
  type: TName;
  data: Ima2SseEventPayloadByName[TName];
  lastEventId: string;
};

export type SubscribeToEventsHandlers = {
  onEvent?: (event: Ima2SseEvent) => void;
  onPhase?: (event: Ima2SseEvent<'phase'>) => void;
  onPartial?: (event: Ima2SseEvent<'partial'>) => void;
  onImage?: (event: Ima2SseEvent<'image'>) => void;
  onDone?: (event: Ima2SseEvent<'done'>) => void;
  onError?: (event: Ima2SseEvent<'error'>) => void;
  onReplayGap?: (event: Ima2SseEvent<'replay-gap'>) => void;
  onInvalidEvent?: (error: Error, context: InvalidEventContext) => void;
  onConnectionError?: (event: Event) => void;
};

export type InvalidEventContext = {
  type: Ima2SseEventName;
  rawData: unknown;
  lastEventId: string;
};

export type SubscribeToEventsOptions = {
  EventSource?: EventSourceConstructor;
  lastEventId?: string | number;
  withCredentials?: boolean;
  logger?: Pick<Console, 'warn'>;
};

const EVENT_NAMES: Ima2SseEventName[] = [
  'phase',
  'partial',
  'image',
  'done',
  'error',
  'replay-gap',
];

export function subscribeToEvents(
  baseUrl: string,
  handlers: SubscribeToEventsHandlers,
  options: SubscribeToEventsOptions = {},
) {
  const EventSourceImpl = options.EventSource ?? globalThis.EventSource;

  if (!EventSourceImpl) {
    throw new Error('EventSource is not available in this environment.');
  }

  const eventSource = new EventSourceImpl(buildEventsUrl(baseUrl, options.lastEventId), {
    withCredentials: options.withCredentials,
  });
  const listeners = new Map<Ima2SseEventName, EventSourceListener>();

  for (const eventName of EVENT_NAMES) {
    const listener = createNamedEventListener(eventName, handlers, options.logger ?? console);
    listeners.set(eventName, listener);
    eventSource.addEventListener(eventName, listener);
  }

  return () => {
    for (const [eventName, listener] of listeners) {
      eventSource.removeEventListener(eventName, listener);
    }

    eventSource.close();
  };
}

function createNamedEventListener(
  eventName: Ima2SseEventName,
  handlers: SubscribeToEventsHandlers,
  logger: Pick<Console, 'warn'>,
): EventSourceListener {
  return (rawEvent) => {
    if (!isMessageEvent(rawEvent)) {
      if (eventName === 'error') {
        handlers.onConnectionError?.(rawEvent);
      }

      return;
    }

    const lastEventId = rawEvent.lastEventId;
    const rawData = rawEvent.data;
    let parsedJson: unknown;

    try {
      parsedJson = JSON.parse(rawData);
    } catch (error) {
      reportInvalidEvent(
        errorToError(error),
        { type: eventName, rawData, lastEventId },
        handlers,
        logger,
      );
      return;
    }

    const parsedPayload = ima2SseEventPayloadSchemas[eventName].safeParse(parsedJson);

    if (!parsedPayload.success) {
      reportInvalidEvent(
        parsedPayload.error,
        { type: eventName, rawData: parsedJson, lastEventId },
        handlers,
        logger,
      );
      return;
    }

    dispatchEventByName(
      {
        type: eventName,
        data: parsedPayload.data as Ima2SseEventPayloadByName[typeof eventName],
        lastEventId,
      },
      handlers,
      logger,
    );
  };
}

function dispatchEventByName(
  event: Ima2SseEvent,
  handlers: SubscribeToEventsHandlers,
  logger: Pick<Console, 'warn'>,
) {
  handlers.onEvent?.(event);

  switch (event.type) {
    case 'phase':
      handlers.onPhase?.(event as Ima2SseEvent<'phase'>);
      break;
    case 'partial':
      handlers.onPartial?.(event as Ima2SseEvent<'partial'>);
      break;
    case 'image':
      handlers.onImage?.(event as Ima2SseEvent<'image'>);
      break;
    case 'done':
      handlers.onDone?.(event as Ima2SseEvent<'done'>);
      break;
    case 'error':
      handlers.onError?.(event as Ima2SseEvent<'error'>);
      break;
    case 'replay-gap':
      if (handlers.onReplayGap) {
        handlers.onReplayGap(event as Ima2SseEvent<'replay-gap'>);
      } else {
        logger.warn('ima2 SSE replay gap received without an onReplayGap handler.', event.data);
      }
      break;
  }
}

function reportInvalidEvent(
  error: Error,
  context: InvalidEventContext,
  handlers: SubscribeToEventsHandlers,
  logger: Pick<Console, 'warn'>,
) {
  if (handlers.onInvalidEvent) {
    handlers.onInvalidEvent(error, context);
    return;
  }

  logger.warn('Invalid ima2 SSE event ignored.', { error, context });
}

function buildEventsUrl(baseUrl: string, lastEventId: string | number | undefined) {
  const url = new URL('/api/events', baseUrl);

  if (lastEventId !== undefined) {
    url.searchParams.set('lastEventId', String(lastEventId));
  }

  return url.toString();
}

function isMessageEvent(event: Event): event is MessageEvent<string> {
  return 'data' in event && typeof (event as MessageEvent).data === 'string';
}

function errorToError(error: unknown) {
  return error instanceof Error ? error : new Error(String(error));
}
