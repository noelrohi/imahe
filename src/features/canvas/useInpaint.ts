import { useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { historyQueryKey } from '@/features/gallery/useHistory';
import { ima2Client, type Ima2Client } from '@/lib/ima2/client';
import type { EditResponse, HistoryItem } from '@/lib/ima2/schemas';
import type { ImaheStoreApi } from '@/shared/ipc';

import { CANVAS_INPAINT_PROVIDER } from './constants';

export const canvasQueryKeys = {
  lineage: (sourceId: string) => ['lineage', sourceId] as const,
  assetChildren: (sourceId: string) => ['assets', 'children', sourceId] as const,
};

export type InpaintClient = Pick<Ima2Client, 'edit' | 'cancelJob'>;
export type InpaintStore = Pick<ImaheStoreApi['assets'], 'upsert'>;

export type InpaintValues = {
  source: HistoryItem;
  prompt: string;
  sourcePng: string;
  maskPng: string;
  model?: string;
  quality?: string;
  size?: string;
  moderation?: string;
  requestId?: string;
};

export type InpaintResult = {
  requestId: string;
  response: EditResponse;
};

export type UseInpaintOptions = {
  client?: InpaintClient;
  store?: InpaintStore;
};

export function useInpaint(options: UseInpaintOptions = {}) {
  const queryClient = useQueryClient();
  const client = options.client ?? ima2Client;

  const mutation = useMutation({
    mutationKey: ['canvas', 'inpaint'],
    mutationFn: async (values: InpaintValues): Promise<InpaintResult> => {
      const prompt = values.prompt.trim();

      if (!prompt) {
        throw new Error('Prompt is required.');
      }

      const requestId = values.requestId ?? createInpaintRequestId();
      const response = await client.edit({
        prompt,
        image: values.sourcePng,
        mask: values.maskPng,
        provider: CANVAS_INPAINT_PROVIDER,
        model: values.model,
        quality: values.quality ?? 'medium',
        size: values.size ?? '1024x1024',
        moderation: values.moderation ?? 'low',
        requestId,
      });

      await getStore(options.store).upsert({
        id: response.filename,
        parentId: values.source.filename,
        createdAt: normalizeCreatedAt(response.createdAt) ?? Date.now(),
      });

      return { requestId, response };
    },
    onSuccess: async (_result, values) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: historyQueryKey }),
        queryClient.invalidateQueries({ queryKey: canvasQueryKeys.lineage(values.source.filename) }),
        queryClient.invalidateQueries({ queryKey: canvasQueryKeys.assetChildren(values.source.filename) }),
      ]);
    },
  });

  const cancelMutation = useMutation({
    mutationKey: ['canvas', 'cancel'],
    mutationFn: (requestId: string) => client.cancelJob(requestId),
  });

  const cancelInFlight = useCallback(() => {
    const requestId = mutation.variables?.requestId;

    if (requestId) {
      cancelMutation.mutate(requestId);
    }
  }, [cancelMutation, mutation.variables?.requestId]);

  const cancelInFlightAsync = useCallback(async () => {
    const requestId = mutation.variables?.requestId;

    if (!requestId) {
      return undefined;
    }

    return cancelMutation.mutateAsync(requestId);
  }, [cancelMutation, mutation.variables?.requestId]);

  return {
    ...mutation,
    cancelInFlight,
    cancelInFlightAsync,
    cancelMutation,
  };
}

export function createInpaintRequestId(): string {
  if (globalThis.crypto?.randomUUID) {
    return `req_${globalThis.crypto.randomUUID()}`;
  }

  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
}

function getStore(store: InpaintStore | undefined): InpaintStore {
  return store ?? window.imahe.store.assets;
}

function normalizeCreatedAt(value: number | string | undefined): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value !== 'string') {
    return undefined;
  }

  const numeric = Number(value);
  if (Number.isFinite(numeric)) {
    return numeric;
  }

  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}
