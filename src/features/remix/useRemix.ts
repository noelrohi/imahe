import { useMutation, useQueryClient } from '@tanstack/react-query';

import { ima2Client, type Ima2Client } from '@/lib/ima2/client';
import {
  subscribeToEvents,
  type EventSourceConstructor,
  type Ima2SseEvent,
} from '@/lib/ima2/events';
import {
  nodeGenerateDoneEventPayloadSchema,
  type HistoryItem,
  type NodeGenerateDoneEventPayload,
} from '@/lib/ima2/schemas';
import type { AssetRecord, ImaheStoreApi } from '@/shared/ipc';
import { historyQueryKey } from '@/features/gallery/useHistory';
import {
  uiProviderToApiProvider,
  type UiGenerationProvider,
} from '@/features/generate/hooks';

export const lineageQueryKeys = {
  all: ['lineage'] as const,
  asset: (id: string) => ['lineage', 'asset', id] as const,
  children: (parentId: string) => ['lineage', 'children', parentId] as const,
};

export type RemixFormValues = {
  source: HistoryItem;
  prompt: string;
  provider: UiGenerationProvider;
  model: string;
  size: string;
  quality?: string;
  format?: string;
  moderation?: string;
  requestId?: string;
};

export type RemixMutationResult = {
  requestId: string;
  source: HistoryItem;
  done: NodeGenerateDoneEventPayload;
  assetRecord: AssetRecord;
};

export type RemixClient = Pick<Ima2Client, 'nodeGenerate'>;

type RemixStoreAssets = Pick<ImaheStoreApi['assets'], 'upsert'>;

export type UseRemixOptions = {
  client?: RemixClient;
  store?: RemixStoreAssets;
  getBaseUrl?: () => Promise<string | null> | string | null;
  subscribe?: typeof subscribeToEvents;
  EventSource?: EventSourceConstructor;
  now?: () => number;
};

type NodeGenerateDoneWatcher = {
  promise: Promise<NodeGenerateDoneEventPayload>;
  cancel: () => void;
};

export function useRemix(options: UseRemixOptions = {}) {
  const queryClient = useQueryClient();
  const client = options.client ?? ima2Client;
  const store = options.store;
  const getBaseUrl = options.getBaseUrl ?? defaultGetBaseUrl;
  const subscribe = options.subscribe ?? subscribeToEvents;
  const now = options.now ?? Date.now;

  return useMutation({
    mutationKey: ['remix', 'submit'],
    mutationFn: async (values: RemixFormValues): Promise<RemixMutationResult> => {
      if (!values.source.filename) {
        throw new Error('A source asset filename is required to remix.');
      }

      const prompt = values.prompt.trim();
      if (!prompt) {
        throw new Error('Prompt is required to remix an asset.');
      }

      const requestId = values.requestId ?? createRemixRequestId();
      const apiProvider = uiProviderToApiProvider(values.provider);
      const baseUrl = await Promise.resolve(getBaseUrl());

      if (!baseUrl) {
        throw new Error('ima2 sidecar base URL is not available.');
      }

      const watcher = watchNodeGenerateDone({
        baseUrl,
        requestId,
        subscribe,
        EventSource: options.EventSource,
      });

      try {
        await client.nodeGenerate({
          prompt,
          provider: apiProvider,
          model: values.model,
          quality: values.quality ?? 'medium',
          size: values.size,
          format: values.format ?? 'png',
          moderation: values.moderation ?? 'low',
          externalSrc: values.source.filename,
          async: true,
          requestId,
        });

        const done = await watcher.promise;
        const storeAssets = store ?? window.imahe.store.assets;
        const assetRecord = await storeAssets.upsert({
          id: done.filename,
          parentId: values.source.filename,
          createdAt: normalizeCreatedAt(done.createdAt, now),
        });

        await Promise.all([
          queryClient.invalidateQueries({ queryKey: historyQueryKey }),
          queryClient.invalidateQueries({ queryKey: lineageQueryKeys.asset(values.source.filename) }),
          queryClient.invalidateQueries({ queryKey: lineageQueryKeys.children(values.source.filename) }),
          queryClient.invalidateQueries({ queryKey: lineageQueryKeys.asset(done.filename) }),
          queryClient.invalidateQueries({ queryKey: lineageQueryKeys.children(done.filename) }),
        ]);

        return {
          requestId,
          source: values.source,
          done,
          assetRecord,
        };
      } catch (error) {
        watcher.cancel();
        throw error;
      }
    },
  });
}

function watchNodeGenerateDone({
  baseUrl,
  requestId,
  subscribe,
  EventSource,
}: {
  baseUrl: string;
  requestId: string;
  subscribe: typeof subscribeToEvents;
  EventSource: EventSourceConstructor | undefined;
}): NodeGenerateDoneWatcher {
  let settled = false;
  let unsubscribe: (() => void) | undefined;

  const cleanup = () => {
    if (settled) {
      return;
    }

    settled = true;
    unsubscribe?.();
  };

  const promise = new Promise<NodeGenerateDoneEventPayload>((resolve, reject) => {
    unsubscribe = subscribe(
      baseUrl,
      {
        onDone: (event) => {
          if (getEventRequestId(event) !== requestId) {
            return;
          }

          const parsed = nodeGenerateDoneEventPayloadSchema.safeParse(event.data);
          cleanup();

          if (!parsed.success) {
            reject(new Error('Remix completed without a saved child filename.'));
            return;
          }

          resolve(parsed.data);
        },
        onError: (event) => {
          if (getEventRequestId(event) !== requestId) {
            return;
          }

          cleanup();
          reject(new Error(errorEventMessage(event.data.error)));
        },
      },
      { EventSource },
    );
  });

  return {
    promise,
    cancel: cleanup,
  };
}

function getEventRequestId(event: Ima2SseEvent): string | undefined {
  const data = event.data as { requestId?: unknown; jobId?: unknown };

  if (typeof data.requestId === 'string') {
    return data.requestId;
  }

  if (typeof data.jobId === 'string') {
    return data.jobId;
  }

  return undefined;
}

function createRemixRequestId() {
  if (globalThis.crypto?.randomUUID) {
    return `req_${globalThis.crypto.randomUUID()}`;
  }

  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
}

function normalizeCreatedAt(
  createdAt: NodeGenerateDoneEventPayload['createdAt'],
  now: () => number,
) {
  if (typeof createdAt === 'number' && Number.isFinite(createdAt)) {
    return createdAt;
  }

  if (typeof createdAt === 'string') {
    const timestamp = Number(createdAt);
    if (Number.isFinite(timestamp)) {
      return timestamp;
    }

    const parsedDate = Date.parse(createdAt);
    if (Number.isFinite(parsedDate)) {
      return parsedDate;
    }
  }

  return now();
}

function errorEventMessage(error: unknown) {
  if (typeof error === 'string' && error.length > 0) {
    return error;
  }

  if (isRecord(error) && typeof error.message === 'string') {
    return error.message;
  }

  return 'Remix failed.';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function defaultGetBaseUrl() {
  return window.imahe.getSidecarBaseUrl();
}

export function apiProviderToUiProvider(provider: string | null | undefined) {
  return provider === 'grok' ? 'grok' : 'codex';
}
