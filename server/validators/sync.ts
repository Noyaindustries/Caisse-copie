import { z } from 'zod'

const syncItemSchema = z.object({
  kind: z.string().min(1),
  createdAt: z.number().int().nonnegative(),
  payload: z.unknown(),
})

export const syncBatchSchema = z.object({
  batchId: z.string().uuid(),
  sentAt: z.number().int().nonnegative(),
  items: z.array(syncItemSchema),
})
