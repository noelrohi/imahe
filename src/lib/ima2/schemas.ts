import { z } from 'zod';

export const ima2HealthSchema = z
  .object({
    status: z.string().optional(),
  })
  .passthrough();

export const authProviderSchema = z.enum(['codex', 'grok']);

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

export type Ima2Health = z.infer<typeof ima2HealthSchema>;
export type AuthProvider = z.infer<typeof authProviderSchema>;
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
