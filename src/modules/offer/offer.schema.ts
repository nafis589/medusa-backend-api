import { z } from 'zod';

export const CreateOfferSchema = z.object({
  product_id: z.string().min(1),
  amount: z.coerce.number().int().min(100, 'Le montant minimum est de 100 FCFA'),
});

export const CounterOfferSchema = z.object({
  counter_amount: z.coerce.number().int().min(100, 'Le montant minimum est de 100 FCFA'),
});

export const OfferIdSchema = z.object({
  id: z.string().min(1),
});

const offerStatusValues = ['PENDING', 'ACCEPTED', 'DECLINED', 'COUNTER', 'EXPIRED'] as const;

export const OfferListQuerySchema = z.object({
  status: z.enum(offerStatusValues).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreateOfferInput = z.infer<typeof CreateOfferSchema>;
export type CounterOfferInput = z.infer<typeof CounterOfferSchema>;
export type OfferListQueryInput = z.infer<typeof OfferListQuerySchema>;
