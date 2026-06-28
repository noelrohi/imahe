import { z } from 'zod';

export const ima2HealthSchema = z
  .object({
    status: z.string().optional(),
  })
  .passthrough();

export const authProviderSchema = z.enum(['codex', 'grok']);

export const generationProviderSchema = z.enum(['oauth', 'grok']);

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

export const asyncGenerationResponseSchema = z
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
  images: z.array(z.unknown()).optional(),
  status: z.string().optional(),
  sequenceId: z.string().optional(),
});

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
export type GenerateRequest = z.infer<typeof generateRequestSchema>;
export type MultimodeRequest = z.infer<typeof multimodeRequestSchema>;
export type AsyncGenerationResponse = z.infer<typeof asyncGenerationResponseSchema>;
export type InflightJob = z.infer<typeof inflightJobSchema>;
export type TerminalInflightJob = z.infer<typeof terminalInflightJobSchema>;
export type InflightResponse = z.infer<typeof inflightResponseSchema>;
export type CancelJobResponse = z.infer<typeof cancelJobResponseSchema>;
export type Ima2SseEventName = z.infer<typeof ima2SseEventNameSchema>;
export type SsePhaseEventPayload = z.infer<typeof ssePhaseEventPayloadSchema>;
export type SsePartialEventPayload = z.infer<typeof ssePartialEventPayloadSchema>;
export type SseImageEventPayload = z.infer<typeof sseImageEventPayloadSchema>;
export type SseDoneEventPayload = z.infer<typeof sseDoneEventPayloadSchema>;
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
