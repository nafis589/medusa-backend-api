import { z } from 'zod';

export const UpdateVendorProfileSchema = z
  .object({
    first_name: z.string().min(1).max(100).optional(),
    last_name: z.string().min(1).max(100).optional(),
    phone: z.string().max(20).nullable().optional(),
    avatar_url: z.string().optional(),
    shop_name: z.string().min(1).max(255).optional(),
    shop_description: z.string().max(5000).nullable().optional(),
  })
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: 'At least one field must be provided',
  });
