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

export type Ima2Health = z.infer<typeof ima2HealthSchema>;
export type AuthProvider = z.infer<typeof authProviderSchema>;
export type AuthSwitchResponse = z.infer<typeof authSwitchResponseSchema>;
export type AuthStatusResponse = z.infer<typeof authStatusResponseSchema>;
export type OAuthStatusResponse = z.infer<typeof oauthStatusResponseSchema>;
export type GrokStatusResponse = z.infer<typeof grokStatusResponseSchema>;
export type QuotaResponse = z.infer<typeof quotaResponseSchema>;
export type ProvidersRuntimeResponse = z.infer<typeof providersRuntimeResponseSchema>;
