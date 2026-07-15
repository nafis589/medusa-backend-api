import { z } from 'zod';

const orderStatusValues = [
  'PENDING',
  'CONFIRMED',
  'PREPARING',
  'SHIPPED',
  'DELIVERED',
  'CANCELLED',
  'RETURNED',
] as const;

export const PlaceOrderSchema = z.object({
  payment_method: z.enum(['CASH_ON_DELIVERY', 'BANK_TRANSFER']).default('CASH_ON_DELIVERY'),
  shipping_address: z.object({
    first_name: z.string().min(1),
    last_name: z.string().min(1),
    phone: z.string().min(1),
    notes: z.string().optional().nullable(),
    latitude: z.coerce.number(),
    longitude: z.coerce.number(),
    region_id: z.string().min(1),
    address_label: z.string().optional().nullable(),
  }),
  vendor_shippings: z
    .array(
      z.object({
        vendor_id: z.string().uuid(),
        shipping_fee: z.coerce.number().int().min(0),
        shipping_method: z.enum(['PER_KM', 'FIXED']),
        shipping_distance_km: z.coerce.number().nullable().optional(),
        shipping_detail: z.string().min(1),
      }),
    )
    .min(1),
});

export const OrderListQuerySchema = z.object({
  status: z.enum(orderStatusValues).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const AdminOrderListQuerySchema = OrderListQuerySchema.extend({
  vendor_id: z.string().uuid().optional(),
  buyer_id: z.string().uuid().optional(),
  search: z.string().optional(),
  date_from: z.string().optional(),
  date_to: z.string().optional(),
});

export const AdminCancelOrderSchema = z.object({
  reason: z.string().min(1, 'La raison est obligatoire'),
});

export const OrderIdSchema = z.object({
  id: z.string().uuid('Order id must be a valid UUID'),
});

export const UpdateOrderStatusSchema = z.object({
  status: z.enum([
    'CONFIRMED',
    'CANCELLED',
    'PREPARING',
    'SHIPPED',
    'DELIVERED',
    'RETURNED',
  ]),
  note: z.string().optional().nullable(),
});

export type PlaceOrderBody = z.infer<typeof PlaceOrderSchema>;
export type OrderListQueryInput = z.infer<typeof OrderListQuerySchema>;
export type AdminOrderListQueryInput = z.infer<typeof AdminOrderListQuerySchema>;
export type AdminCancelOrderBody = z.infer<typeof AdminCancelOrderSchema>;
export type UpdateOrderStatusBody = z.infer<typeof UpdateOrderStatusSchema>;
