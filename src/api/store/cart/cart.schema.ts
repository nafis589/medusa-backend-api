import { z } from 'zod';

export const AddCartItemSchema = z.object({
  product_id: z.string().uuid('product_id must be a valid UUID'),
  quantity: z.coerce.number().int().min(1).default(1),
});

export const AddOfferCartItemSchema = z.object({
  offer_id: z.string().uuid('offer_id must be a valid UUID'),
});

export const UpdateCartItemSchema = z.object({
  quantity: z.coerce.number().int().min(0),
});

export const CartItemIdSchema = z.object({
  id: z.string().uuid('Item id must be a valid UUID'),
});
