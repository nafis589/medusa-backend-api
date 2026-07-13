import { z } from 'zod';

export const CreateReviewSchema = z.object({
  product_id: z.string().uuid('product_id must be a valid UUID'),
  order_id: z.string().uuid('order_id must be a valid UUID'),
  rating: z.coerce.number().int().min(1).max(5),
  comment: z.string().trim().max(2000).optional().nullable(),
});

export type CreateReviewInput = z.infer<typeof CreateReviewSchema>;
