import { useEffect, useMemo, useState } from 'react';
import {
  type QueryClient,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

import { ima2Client, type Ima2Client } from '@/lib/ima2/client';
import {
  subscribeToEvents,
  type EventSourceConstructor,
  type Ima2SseEvent,
} from '@/lib/ima2/events';
import type {
  GenerationProvider,
  InflightJob,
  InflightResponse,
  SseDoneEventPayload,
  SseImageEventPayload,
  SsePartialEventPayload,
} from '@/lib/ima2/schemas';
import { historyQueryKey } from '@/features/gallery/useHistory';

export const generateQueryKeys = {
  jobs: ['generate', 'jobs'] as const,
};

export type UiGenerationProvider = 'codex' | 'grok';

export type GenerateFormValues = {
  prompt: string;
  provider: UiGenerationProvider;
  model: string;
  count: number;
  size: string;
  quality?: string;
  format?: string;
  moderation?: string;
  references?: string[];
  requestId?: string;
};

export type GenerateClient = Pick<Ima2Client, 'generate' | 'multimode'>;
export type JobEventsClient = Pick<Ima2Client, 'inflight' | 'cancelJob'>;

export type GenerationJobStatus =
  | 'queued'
  | 'running'
  | 'completed'
  | 'error'
  | 'canceling'
  | 'canceled'
  | 'stale';

export type GenerationJobImage = {
  image?: string;
  filename?: string;
  createdAt?: number | string;
  index?: number;
};

export type GenerationJob = {
  requestId: string;
  prompt: string;
  provider: UiGenerationProvider;
  apiProvider: GenerationProvider;
  model: string;
  count: number;
  size: string;
  quality: string;
  status: GenerationJobStatus;
  phase: string;
  progress: number;
  partialImages: GenerationJobImage[];
  finalImages: GenerationJobImage[];
  error?: string;
  stale: boolean;
  createdAt: number;
  updatedAt: number;
};

export type GenerateMutationResult = {
  requestId: string;
  job: GenerationJob;
};

export type UseGenerateOptions = {
  client?: GenerateClient;
};

export type UseJobEventsOptions = {
  client?: JobEventsClient;
  getBaseUrl?: () => Promise<string | null> | string | null;
  subscribe?: typeof subscribeToEvents;
  EventSource?: EventSourceConstructor;
};

export function useGenerate(options: UseGenerateOptions = {}) {
  const queryClient = useQueryClient();
  const client = options.client ?? ima2Client;

  return useMutation({
    mutationKey: ['generate', 'submit'],
    mutationFn: async (values: GenerateFormValues): Promise<GenerateMutationResult> => {
      const requestId = values.requestId ?? createGenerateRequestId();
      const prompt = values.prompt.trim();

      if (!prompt) {
        throw new Error('Prompt is required.');
      }

      const count = normalizeCount(values.count);
      const apiProvider = uiProviderToApiProvider(values.provider);
      const job = createGenerationJob({
        ...values,
        prompt,
        count,
        requestId,
        apiProvider,
      });

      upsertGenerationJob(queryClient, job);

      const common = {
        prompt,
        provider: apiProvider,
        model: values.model,
        quality: values.quality ?? 'medium',
        size: values.size,
        format: values.format ?? 'png',
        moderation: values.moderation ?? 'low',
        references: values.references ?? [],
        async: true as const,
        requestId,
      };

      try {
        if (count === 1) {
          await client.generate({
            ...common,
            n: 1,
          });
        } else {
          await client.multimode({
            ...common,
            maxImages: count,
          });
        }

        updateKnownJob(queryClient, requestId, (currentJob) => ({
          ...currentJob,
          status: 'running',
          phase: 'submitted',
          progress: Math.max(currentJob.progress, 5),
          updatedAt: Date.now(),
        }));

        return { requestId, job };
      } catch (error) {
        updateKnownJob(queryClient, requestId, (currentJob) => ({
          ...currentJob,
          status: 'error',
          phase: 'error',
          error: errorToMessage(error),
          stale: false,
          updatedAt: Date.now(),
        }));
        throw error;
      }
    },
  });
}

export function useJobEvents(options: UseJobEventsOptions = {}) {
  const queryClient = useQueryClient();
  const client = options.client ?? ima2Client;
  const subscribe = options.subscribe ?? subscribeToEvents;
  const [baseUrl, setBaseUrl] = useState<string | null>(null);

  const jobsQuery = useQuery({
    queryKey: generateQueryKeys.jobs,
    queryFn: () => queryClient.getQueryData<GenerationJob[]>(generateQueryKeys.jobs) ?? [],
    initialData: () => queryClient.getQueryData<GenerationJob[]>(generateQueryKeys.jobs) ?? [],
    staleTime: Infinity,
  });

  useEffect(() => {
    let canceled = false;
    const getBaseUrl = options.getBaseUrl ?? defaultGetBaseUrl;

    Promise.resolve(getBaseUrl()).then((nextBaseUrl) => {
      if (!canceled) {
        setBaseUrl(nextBaseUrl);
      }
    });

    return () => {
      canceled = true;
    };
  }, [options.getBaseUrl]);

  useEffect(() => {
    if (!baseUrl) {
      return undefined;
    }

    return subscribe(
      baseUrl,
      {
        onPhase: (event) => {
          const requestId = getEventRequestId(event);
          if (!requestId) {
            return;
          }

          updateKnownJob(queryClient, requestId, (job) => ({
            ...job,
            status: 'running',
            phase: event.data.phase ?? job.phase,
            progress: Math.max(job.progress, 10),
            stale: false,
            updatedAt: Date.now(),
          }));
        },
        onPartial: (event) => {
          const requestId = getEventRequestId(event);
          if (!requestId) {
            return;
          }

          updateKnownJob(queryClient, requestId, (job) => {
            const partialImages = upsertImage(job.partialImages, imageFromPartial(event.data));

            return {
              ...job,
              status: 'running',
              phase: 'preview',
              partialImages,
              progress: Math.max(job.progress, 25),
              stale: false,
              updatedAt: Date.now(),
            };
          });
        },
        onImage: (event) => {
          const requestId = getEventRequestId(event);
          if (!requestId) {
            return;
          }

          updateKnownJob(queryClient, requestId, (job) => {
            const finalImages = upsertImage(job.finalImages, imageFromImageEvent(event.data));

            return {
              ...job,
              status: 'running',
              phase: 'saving',
              finalImages,
              progress: progressForImages(finalImages.length, job.count),
              stale: false,
              updatedAt: Date.now(),
            };
          });
          void queryClient.invalidateQueries({ queryKey: historyQueryKey });
        },
        onDone: (event) => {
          const requestId = getEventRequestId(event);
          if (!requestId) {
            return;
          }

          updateKnownJob(queryClient, requestId, (job) => {
            const finalImages = mergeDoneImages(job.finalImages, event.data);

            return {
              ...job,
              status: 'completed',
              phase: event.data.status ?? 'done',
              finalImages,
              progress: 100,
              stale: false,
              updatedAt: Date.now(),
            };
          });
          void queryClient.invalidateQueries({ queryKey: historyQueryKey });
        },
        onError: (event) => {
          const requestId = getEventRequestId(event);
          if (!requestId) {
            return;
          }

          updateKnownJob(queryClient, requestId, (job) => ({
            ...job,
            status: event.data.code === 'GENERATION_CANCELED' ? 'canceled' : 'error',
            phase: 'error',
            error: errorToMessage(event.data.error),
            stale: false,
            updatedAt: Date.now(),
          }));
        },
        onReplayGap: () => {
          markRunningJobsStale(queryClient);
          void reconcileInflightJobs(client, queryClient);
        },
      },
      { EventSource: options.EventSource },
    );
  }, [baseUrl, client, options.EventSource, queryClient, subscribe]);

  const cancelMutation = useMutation({
    mutationKey: ['generate', 'cancel'],
    mutationFn: (requestId: string) => client.cancelJob(requestId),
    onMutate: (requestId) => {
      updateKnownJob(queryClient, requestId, (job) => ({
        ...job,
        status: 'canceling',
        phase: 'canceling',
        updatedAt: Date.now(),
      }));
    },
    onSuccess: (response, requestId) => {
      if (response.active || response.aborted) {
        return;
      }

      updateKnownJob(queryClient, requestId, (job) => ({
        ...job,
        status: 'canceled',
        phase: 'canceled',
        stale: false,
        updatedAt: Date.now(),
      }));
    },
    onError: (error, requestId) => {
      updateKnownJob(queryClient, requestId, (job) => ({
        ...job,
        status: 'error',
        phase: 'cancel failed',
        error: errorToMessage(error),
        updatedAt: Date.now(),
      }));
    },
  });

  const runningJobs = useMemo(
    () => jobsQuery.data.filter((job) => !isTerminalJobStatus(job.status)),
    [jobsQuery.data],
  );

  return {
    jobs: jobsQuery.data,
    runningJobs,
    cancelJob: cancelMutation.mutate,
    cancelJobAsync: cancelMutation.mutateAsync,
    cancelingRequestId: cancelMutation.isPending ? cancelMutation.variables : null,
  };
}

export function uiProviderToApiProvider(provider: UiGenerationProvider): GenerationProvider {
  return provider === 'codex' ? 'oauth' : 'grok';
}

export function isTerminalJobStatus(status: GenerationJobStatus) {
  return status === 'completed' || status === 'error' || status === 'canceled';
}

export function upsertGenerationJob(queryClient: QueryClient, job: GenerationJob) {
  queryClient.setQueryData<GenerationJob[]>(generateQueryKeys.jobs, (current = []) => {
    const existingIndex = current.findIndex((currentJob) => currentJob.requestId === job.requestId);

    if (existingIndex === -1) {
      return [job, ...current];
    }

    return current.map((currentJob) =>
      currentJob.requestId === job.requestId ? job : currentJob,
    );
  });
}

function updateKnownJob(
  queryClient: QueryClient,
  requestId: string,
  updater: (job: GenerationJob) => GenerationJob,
) {
  queryClient.setQueryData<GenerationJob[]>(generateQueryKeys.jobs, (current = []) => {
    if (!current.some((job) => job.requestId === requestId)) {
      return current;
    }

    return current.map((job) => (job.requestId === requestId ? updater(job) : job));
  });
}

function createGenerationJob(
  values: GenerateFormValues & {
    requestId: string;
    apiProvider: GenerationProvider;
    count: number;
  },
): GenerationJob {
  const now = Date.now();

  return {
    requestId: values.requestId,
    prompt: values.prompt,
    provider: values.provider,
    apiProvider: values.apiProvider,
    model: values.model,
    count: values.count,
    size: values.size,
    quality: values.quality ?? 'medium',
    status: 'queued',
    phase: 'queued',
    progress: 0,
    partialImages: [],
    finalImages: [],
    stale: false,
    createdAt: now,
    updatedAt: now,
  };
}

function createGenerateRequestId() {
  if (globalThis.crypto?.randomUUID) {
    return `req_${globalThis.crypto.randomUUID()}`;
  }

  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
}

function normalizeCount(count: number) {
  return Math.max(1, Math.trunc(Number.isFinite(count) ? count : 1));
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

function imageFromPartial(payload: SsePartialEventPayload): GenerationJobImage {
  return {
    image: payload.image,
    index: payload.index,
  };
}

function imageFromImageEvent(payload: SseImageEventPayload): GenerationJobImage {
  return {
    image: payload.image,
    filename: payload.filename,
    createdAt: payload.createdAt,
    index: payload.sequenceIndex,
  };
}

function mergeDoneImages(
  currentImages: GenerationJobImage[],
  payload: SseDoneEventPayload,
) {
  const images = [...currentImages];

  if (payload.filename || payload.image) {
    return upsertImage(images, {
      filename: payload.filename,
      image: payload.image,
    });
  }

  if (!Array.isArray(payload.images)) {
    return images;
  }

  return payload.images.reduce<GenerationJobImage[]>((nextImages, image, index) => {
    if (!isRecord(image)) {
      return nextImages;
    }

    return upsertImage(nextImages, {
      image: typeof image.image === 'string' ? image.image : undefined,
      filename: typeof image.filename === 'string' ? image.filename : undefined,
      createdAt: readCreatedAt(image.createdAt),
      index: readNumber(image.sequenceIndex) ?? index + 1,
    });
  }, images);
}

function upsertImage(images: GenerationJobImage[], image: GenerationJobImage) {
  if (!image.image && !image.filename) {
    return images;
  }

  const imageKey = getImageKey(image);
  const existingIndex = images.findIndex((currentImage) => getImageKey(currentImage) === imageKey);

  if (existingIndex === -1) {
    return [...images, image];
  }

  return images.map((currentImage, index) =>
    index === existingIndex ? { ...currentImage, ...image } : currentImage,
  );
}

function getImageKey(image: GenerationJobImage) {
  return image.filename ?? (image.index !== undefined ? `index:${image.index}` : image.image);
}

function progressForImages(imageCount: number, requestedCount: number) {
  return Math.max(40, Math.min(95, Math.round((imageCount / requestedCount) * 95)));
}

function markRunningJobsStale(queryClient: QueryClient) {
  queryClient.setQueryData<GenerationJob[]>(generateQueryKeys.jobs, (current = []) =>
    current.map((job) =>
      isTerminalJobStatus(job.status)
        ? job
        : {
            ...job,
            status: 'stale',
            phase: 'reconnecting',
            stale: true,
            updatedAt: Date.now(),
          },
    ),
  );
}

async function reconcileInflightJobs(client: JobEventsClient, queryClient: QueryClient) {
  try {
    const snapshot = await client.inflight({ includeTerminal: true });
    applyInflightSnapshot(queryClient, snapshot);
  } catch {
    // Stale markers remain visible; the next live SSE event will update them.
  }
}

function applyInflightSnapshot(queryClient: QueryClient, snapshot: InflightResponse) {
  const activeJobs = new Map(snapshot.jobs.map((job) => [job.requestId, job]));
  const terminalJobs = new Map(
    (snapshot.terminalJobs ?? []).map((job) => [job.requestId, job]),
  );
  let shouldInvalidateHistory = false;

  queryClient.setQueryData<GenerationJob[]>(generateQueryKeys.jobs, (current = []) =>
    current.map((job) => {
      const activeJob = activeJobs.get(job.requestId);
      if (activeJob) {
        return mergeInflightJob(job, activeJob);
      }

      const terminalJob = terminalJobs.get(job.requestId);
      if (!terminalJob) {
        return job;
      }

      const status = terminalStatus(terminalJob.status);
      if (status === 'completed') {
        shouldInvalidateHistory = true;
      }

      return {
        ...job,
        status,
        phase: terminalJob.phase ?? terminalJob.status ?? status,
        progress: status === 'completed' ? 100 : job.progress,
        stale: false,
        updatedAt: Date.now(),
      };
    }),
  );

  if (shouldInvalidateHistory) {
    void queryClient.invalidateQueries({ queryKey: historyQueryKey });
  }
}

function mergeInflightJob(job: GenerationJob, inflightJob: InflightJob): GenerationJob {
  return {
    ...job,
    status: 'running',
    phase: inflightJob.phase ?? job.phase,
    stale: false,
    updatedAt: Date.now(),
  };
}

function terminalStatus(status: string | undefined): GenerationJobStatus {
  if (status === 'canceled') {
    return 'canceled';
  }

  if (status === 'error') {
    return 'error';
  }

  return 'completed';
}

function defaultGetBaseUrl() {
  return window.imahe?.getSidecarBaseUrl?.() ?? null;
}

function readCreatedAt(value: unknown): number | string | undefined {
  return typeof value === 'string' || typeof value === 'number' ? value : undefined;
}

function readNumber(value: unknown): number | undefined {
  return typeof value === 'number' ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function errorToMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  if (isRecord(error) && typeof error.message === 'string') {
    return error.message;
  }

  return 'Generation failed.';
}
