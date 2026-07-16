import { z } from 'zod';
import { TOGO_REGIONS } from './togo-regions';

const togoRegionIds = TOGO_REGIONS.map((r) => r.id) as [string, ...string[]];

export const TogoRegionIdSchema = z.enum(togoRegionIds);

export const VendorLocationSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  region_id: TogoRegionIdSchema,
  address: z.string().max(500).nullable().optional(),
  city: z.string().max(100).nullable().optional(),
  is_valid: z.boolean().optional(),
});

export const VendorShippingRegionInputSchema = z
  .object({
    region_id: TogoRegionIdSchema,
    is_home_region: z.boolean().default(false),
    price_per_km: z.number().int().positive().nullable().optional(),
    min_fee: z.number().int().positive().optional(),
    fixed_price: z.number().int().positive().nullable().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.is_home_region) {
      if (data.price_per_km == null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'price_per_km is required when is_home_region is true',
          path: ['price_per_km'],
        });
      }
      if (data.min_fee == null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'min_fee is required when is_home_region is true',
          path: ['min_fee'],
        });
      }
    } else if (data.fixed_price == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'fixed_price is required when is_home_region is false',
        path: ['fixed_price'],
      });
    }
  });

export const VendorShippingRegionsSchema = z
  .array(VendorShippingRegionInputSchema)
  .min(1, 'At least one shipping region is required');

export const CalculateShippingSchema = z.object({
  client_lat: z.number().min(-90).max(90),
  client_lng: z.number().min(-180).max(180),
  cart_id: z.string().uuid().optional(),
});

export const ValidateLocationSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

export const SaveVendorShippingSchema = z
  .object({
    location: z
      .object({
        lat: z.number().min(-90).max(90),
        lng: z.number().min(-180).max(180),
        address: z.string().max(500).nullable().optional(),
        city: z.string().max(100).nullable().optional(),
      })
      .optional(),
    regions: VendorShippingRegionsSchema.optional(),
  })
  .refine((data) => data.location !== undefined || data.regions !== undefined, {
    message: 'At least one of location or regions must be provided',
  });
