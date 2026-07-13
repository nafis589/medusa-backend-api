import { z } from 'zod';

export const CreateFavoriteSchema = z.object({
  product_id: z.string().uuid('product_id must be a valid UUID'),
});

export const FavoriteProductIdSchema = z.object({
  productId: z.string().uuid('productId must be a valid UUID'),
});

export type CreateFavoriteInput = z.infer<typeof CreateFavoriteSchema>;
