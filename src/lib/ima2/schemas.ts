import { z } from 'zod';

export const ima2HealthSchema = z
  .object({
    status: z.string().optional(),
  })
  .passthrough();

export type Ima2Health = z.infer<typeof ima2HealthSchema>;
