import { z } from 'zod';

export const ima2HealthSchema = z
  .object({
    status: z.string().optional(),
  })
  .passthrough();

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
export type HistoryCursor = z.infer<typeof historyCursorSchema>;
export type HistoryItem = z.infer<typeof historyItemSchema>;
export type HistoryResponse = z.infer<typeof historyResponseSchema>;
export type DeleteAssetResponse = z.infer<typeof deleteAssetResponseSchema>;
export type RestoreAssetResponse = z.infer<typeof restoreAssetResponseSchema>;
