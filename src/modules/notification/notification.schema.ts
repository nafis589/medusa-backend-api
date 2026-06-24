import { z } from 'zod';

export const NotificationListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20).optional(),
});

export const NotificationIdSchema = z.object({
  id: z.string().uuid('Notification id must be a valid UUID'),
});

export type NotificationListQueryInput = z.infer<typeof NotificationListQuerySchema>;
