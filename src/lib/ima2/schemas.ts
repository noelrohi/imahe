import { z } from 'zod';

export const ima2HealthSchema = z
  .object({
    status: z.string().optional(),
  })
  .passthrough();

export const authProviderSchema = z.enum(['codex', 'grok']);

export const generationProviderSchema = z.enum(['oauth', 'grok']);

export const editProviderSchema = z.literal('oauth');

export const pngBase64OrDataUrlSchema = z
  .string()
  .min(1)
  .refine(isPngBase64OrDataUrl, {
    message: 'Expected PNG base64 or a data:image/png;base64 URL.',
  });

export const generateRequestSchema = z
  .object({
    prompt: z.string(),
    provider: generationProviderSchema,
    model: z.string().optional(),
    quality: z.string().optional(),
    size: z.string().optional(),
    format: z.string().optional(),
    moderation: z.string().optional(),
    n: z.number().int().positive().optional(),
    references: z.array(z.string()).optional(),
    async: z.boolean().optional(),
    requestId: z.string().optional(),
  })
  .passthrough();

export const multimodeRequestSchema = z
  .object({
    prompt: z.string(),
    provider: generationProviderSchema,
    model: z.string().optional(),
    quality: z.string().optional(),
    size: z.string().optional(),
    format: z.string().optional(),
    moderation: z.string().optional(),
    maxImages: z.number().int().positive().optional(),
    references: z.array(z.string()).optional(),
    async: z.boolean().optional(),
    requestId: z.string().optional(),
  })
  .passthrough();

export const nodeGenerateRequestSchema = z
  .object({
    prompt: z.string(),
    provider: generationProviderSchema,
    model: z.string().optional(),
    quality: z.string().optional(),
    size: z.string().optional(),
    format: z.string().optional(),
    moderation: z.string().optional(),
    references: z.array(z.string()).optional(),
    externalSrc: z.string().optional(),
    parentNodeId: z.string().optional(),
    async: z.boolean().optional(),
    requestId: z.string().optional(),
    contextMode: z.string().optional(),
    searchMode: z.string().optional(),
  })
  .passthrough();

export const editRequestSchema = z
  .object({
    prompt: z.string(),
    image: pngBase64OrDataUrlSchema,
    mask: pngBase64OrDataUrlSchema.optional(),
    provider: editProviderSchema,
    model: z.string().optional(),
    quality: z.string().optional(),
    size: z.string().optional(),
    moderation: z.string().optional(),
    requestId: z.string().optional(),
  })
  .passthrough();

export const asyncGenerationResponseSchema = z
  .object({
    requestId: z.string(),
    async: z.boolean().optional(),
  })
  .passthrough();

export const nodeGenerateAsyncResponseSchema = z
  .object({
    requestId: z.string(),
    async: z.boolean().optional(),
  })
  .passthrough();

const inflightTimestampSchema = z.union([z.number(), z.string()]);

export const inflightJobSchema = z
  .object({
    requestId: z.string(),
    kind: z.string().optional(),
    prompt: z.string().optional(),
    meta: z.record(z.string(), z.unknown()).optional(),
    startedAt: inflightTimestampSchema.optional(),
    phase: z.string().optional(),
    phaseAt: inflightTimestampSchema.optional(),
  })
  .passthrough();

export const terminalInflightJobSchema = inflightJobSchema
  .extend({
    status: z.string().optional(),
    finishedAt: inflightTimestampSchema.optional(),
    durationMs: z.number().optional(),
    httpStatus: z.number().optional(),
    errorCode: z.string().optional(),
  })
  .passthrough();

export const inflightResponseSchema = z
  .object({
    jobs: z.array(inflightJobSchema),
    terminalJobs: z.array(terminalInflightJobSchema).optional(),
  })
  .passthrough();

export const cancelJobResponseSchema = z
  .object({
    requestId: z.string(),
    active: z.boolean().optional(),
    aborted: z.boolean().optional(),
  })
  .passthrough();

export const editResponseSchema = z
  .object({
    filename: z.string(),
    createdAt: z.union([z.number(), z.string()]).optional(),
    image: z.string().optional(),
    url: z.string().optional(),
    provider: z.string().optional(),
    model: z.string().optional(),
    revisedPrompt: z.union([z.string(), z.null()]).optional(),
  })
  .passthrough();

export const ima2SseEventNameSchema = z.enum([
  'phase',
  'partial',
  'image',
  'done',
  'error',
  'replay-gap',
]);

export const ssePhaseEventPayloadSchema = jobEventPayloadSchema({
  phase: z.string().optional(),
  sequenceId: z.string().optional(),
  maxImages: z.number().optional(),
});

export const ssePartialEventPayloadSchema = jobEventPayloadSchema({
  image: z.string().optional(),
  index: z.number().optional(),
  sequenceId: z.string().optional(),
});

export const sseImageEventPayloadSchema = jobEventPayloadSchema({
  image: z.string().optional(),
  filename: z.string().optional(),
  createdAt: inflightTimestampSchema.optional(),
  sequenceId: z.string().optional(),
  sequenceIndex: z.number().optional(),
});

export const sseDoneEventPayloadSchema = jobEventPayloadSchema({
  ok: z.boolean().optional(),
  image: z.string().optional(),
  filename: z.string().optional(),
  url: z.string().optional(),
  images: z.array(z.unknown()).optional(),
  status: z.string().optional(),
  nodeId: z.string().optional(),
  parentNodeId: z.string().optional(),
  createdAt: inflightTimestampSchema.optional(),
  sequenceId: z.string().optional(),
});

export const nodeGenerateDoneEventPayloadSchema = z
  .object({
    requestId: z.string(),
    filename: z.string(),
    url: z.string(),
    nodeId: z.string().optional(),
    parentNodeId: z.string().optional(),
    createdAt: inflightTimestampSchema.optional(),
  })
  .passthrough();

export const sseErrorEventPayloadSchema = jobEventPayloadSchema({
  error: z.union([z.string(), z.record(z.string(), z.unknown())]).optional(),
  code: z.string().optional(),
  status: z.union([z.number(), z.string()]).optional(),
});

export const sseReplayGapEventPayloadSchema = z
  .object({
    lastEventId: z.union([z.number(), z.string()]).optional(),
    oldestAvailableId: z.union([z.number(), z.string(), z.null()]).optional(),
  })
  .passthrough();

export const ima2SseEventPayloadSchemas = {
  phase: ssePhaseEventPayloadSchema,
  partial: ssePartialEventPayloadSchema,
  image: sseImageEventPayloadSchema,
  done: sseDoneEventPayloadSchema,
  error: sseErrorEventPayloadSchema,
  'replay-gap': sseReplayGapEventPayloadSchema,
};

export const authSwitchResponseSchema = z
  .object({
    sessionId: z.string(),
    userCode: z.string(),
    verificationUrl: z.string().url(),
  })
  .passthrough();

export const authStatusResponseSchema = z
  .object({
    status: z.enum(['pending', 'complete', 'error', 'expired']),
    error: z.string().optional(),
  })
  .passthrough();

export const oauthStatusResponseSchema = z
  .object({
    status: z.string(),
    models: z.array(z.unknown()).optional(),
  })
  .passthrough();

export const grokStatusResponseSchema = z
  .object({
    status: z.string(),
    models: z.array(z.unknown()).optional(),
  })
  .passthrough();

const quotaProviderSchema = z
  .object({
    authenticated: z.boolean().optional(),
  })
  .passthrough();

export const quotaResponseSchema = z
  .object({
    codex: quotaProviderSchema.optional(),
    grok: quotaProviderSchema.optional(),
  })
  .passthrough();

export const providersRuntimeResponseSchema = z.object({}).passthrough();

export const historyCursorSchema = z
  .object({
    before: z.union([z.number(), z.string()]),
    beforeFilename: z.string(),
  })
  .passthrough();

export const historyItemSchema = z
  .object({
    filename: z.string(),
    url: z.string(),
    thumb: z.string().nullable().optional(),
    createdAt: z.union([z.number(), z.string()]).optional(),
    mediaType: z.string().nullable().optional(),
    prompt: z.string().nullable().optional(),
    model: z.string().nullable().optional(),
    provider: z.string().nullable().optional(),
    sessionId: z.string().nullable().optional(),
    nodeId: z.string().nullable().optional(),
    requestId: z.string().nullable().optional(),
    kind: z.string().nullable().optional(),
    refsCount: z.number().optional(),
    isFavorite: z.boolean().optional(),
  })
  .passthrough();

export const historyResponseSchema = z
  .object({
    items: z.array(historyItemSchema),
    total: z.number(),
    nextCursor: historyCursorSchema.nullable().optional(),
  })
  .passthrough();

export const deleteAssetResponseSchema = z
  .object({
    ok: z.boolean().optional(),
    filename: z.string().optional(),
    trash: z.unknown().optional(),
    trashId: z.string().optional(),
    restoreToken: z.string().optional(),
    undoableInApp: z.boolean().optional(),
  })
  .passthrough();

export const restoreAssetResponseSchema = z
  .object({
    ok: z.boolean().optional(),
  })
  .passthrough();

export const nodeResponseSchema = z
  .object({
    nodeId: z.string(),
    url: z.string(),
    meta: z.record(z.string(), z.unknown()).optional(),
  })
  .passthrough();

const PNG_DATA_URL_RE = /^data:image\/png;base64,/;
const BASE64_RE = /^[A-Za-z0-9+/]+={0,2}$/;
const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10] as const;

function isPngBase64OrDataUrl(value: string): boolean {
  const trimmed = value.trim();
  const payload = PNG_DATA_URL_RE.test(trimmed)
    ? trimmed.replace(PNG_DATA_URL_RE, '')
    : trimmed;

  const compactPayload = payload.replace(/\s+/g, '');

  return (
    compactPayload.length > 0 &&
    compactPayload.length % 4 === 0 &&
    BASE64_RE.test(compactPayload) &&
    hasPngSignature(compactPayload)
  );
}

function hasPngSignature(base64Payload: string): boolean {
  const signatureBytes = decodeBase64Prefix(base64Payload, 12);

  return Boolean(
    signatureBytes &&
      PNG_SIGNATURE.every((byte, index) => signatureBytes[index] === byte),
  );
}

function decodeBase64Prefix(base64Payload: string, chars: number): Uint8Array | null {
  try {
    const prefix = base64Payload.slice(0, chars);

    if (typeof atob === 'function') {
      const binary = atob(prefix);
      return Uint8Array.from(binary, (char) => char.charCodeAt(0));
    }

    const globalWithBuffer = globalThis as typeof globalThis & {
      Buffer?: { from: (input: string, encoding: 'base64') => Uint8Array };
    };

    if (globalWithBuffer.Buffer) {
      return globalWithBuffer.Buffer.from(prefix, 'base64');
    }
  } catch {
    return null;
  }

  return null;
}

function jobEventPayloadSchema<T extends z.ZodRawShape>(shape: T) {
  return z
    .object({
      requestId: z.string().optional(),
      jobId: z.string().optional(),
      ...shape,
    })
    .passthrough()
    .refine((payload) => Boolean(payload.requestId ?? payload.jobId), {
      message: 'SSE job event is missing requestId/jobId.',
    });
}

export type Ima2Health = z.infer<typeof ima2HealthSchema>;
export type AuthProvider = z.infer<typeof authProviderSchema>;
export type GenerationProvider = z.infer<typeof generationProviderSchema>;
export type EditProvider = z.infer<typeof editProviderSchema>;
export type GenerateRequest = z.infer<typeof generateRequestSchema>;
export type MultimodeRequest = z.infer<typeof multimodeRequestSchema>;
export type NodeGenerateRequest = z.infer<typeof nodeGenerateRequestSchema>;
export type EditRequest = z.infer<typeof editRequestSchema>;
export type AsyncGenerationResponse = z.infer<typeof asyncGenerationResponseSchema>;
export type NodeGenerateAsyncResponse = z.infer<typeof nodeGenerateAsyncResponseSchema>;
export type InflightJob = z.infer<typeof inflightJobSchema>;
export type TerminalInflightJob = z.infer<typeof terminalInflightJobSchema>;
export type InflightResponse = z.infer<typeof inflightResponseSchema>;
export type CancelJobResponse = z.infer<typeof cancelJobResponseSchema>;
export type EditResponse = z.infer<typeof editResponseSchema>;
export type Ima2SseEventName = z.infer<typeof ima2SseEventNameSchema>;
export type SsePhaseEventPayload = z.infer<typeof ssePhaseEventPayloadSchema>;
export type SsePartialEventPayload = z.infer<typeof ssePartialEventPayloadSchema>;
export type SseImageEventPayload = z.infer<typeof sseImageEventPayloadSchema>;
export type SseDoneEventPayload = z.infer<typeof sseDoneEventPayloadSchema>;
export type NodeGenerateDoneEventPayload = z.infer<typeof nodeGenerateDoneEventPayloadSchema>;
export type SseErrorEventPayload = z.infer<typeof sseErrorEventPayloadSchema>;
export type SseReplayGapEventPayload = z.infer<typeof sseReplayGapEventPayloadSchema>;
export type AuthSwitchResponse = z.infer<typeof authSwitchResponseSchema>;
export type AuthStatusResponse = z.infer<typeof authStatusResponseSchema>;
export type OAuthStatusResponse = z.infer<typeof oauthStatusResponseSchema>;
export type GrokStatusResponse = z.infer<typeof grokStatusResponseSchema>;
export type QuotaResponse = z.infer<typeof quotaResponseSchema>;
export type ProvidersRuntimeResponse = z.infer<typeof providersRuntimeResponseSchema>;
export type HistoryCursor = z.infer<typeof historyCursorSchema>;
export type HistoryItem = z.infer<typeof historyItemSchema>;
export type HistoryResponse = z.infer<typeof historyResponseSchema>;
export type DeleteAssetResponse = z.infer<typeof deleteAssetResponseSchema>;
export type RestoreAssetResponse = z.infer<typeof restoreAssetResponseSchema>;
export type NodeResponse = z.infer<typeof nodeResponseSchema>;
