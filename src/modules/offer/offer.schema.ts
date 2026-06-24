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

export type CreateOfferInput = z.infer<typeof CreateOfferSchema>;
export type CounterOfferInput = z.infer<typeof CounterOfferSchema>;
