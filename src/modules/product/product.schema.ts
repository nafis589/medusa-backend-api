import { z } from 'zod';

const productCondition = z.enum(['NEW', 'VERY_GOOD', 'GOOD', 'FAIR']);
const productSort = z.enum(['newest', 'price_asc', 'price_desc', 'popularity']);
const productStatus = z.enum([
  'DRAFT',
  'PENDING_REVIEW',
  'ACTIVE',
  'SOLD',
  'ARCHIVED',
  'REJECTED',
]);

export const ProductListQuerySchema = z.object({
  category: z.string().min(1).max(100).optional(),
  category_id: z.string().uuid().optional(),
  subcategory: z.string().min(1).max(100).optional(),
  condition: productCondition.optional(),
  color: z.string().max(50).optional(),
  size: z.string().max(20).optional(),
  material: z.string().max(100).optional(),
  brand: z.string().max(100).optional(),
  price_min: z.coerce.number().int().min(0).optional(),
  price_max: z.coerce.number().int().min(0).optional(),
  sort: productSort.default('newest').optional(),
  page: z.coerce.number().int().min(1).default(1).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(24).optional(),
  ids: z.string().min(1).optional(),
  tag: z.enum(['offer', 'we_love']).optional(),
});

const searchFilterFields = {
  condition: productCondition.optional(),
  color: z.string().max(50).optional(),
  size: z.string().max(20).optional(),
  material: z.string().max(100).optional(),
  brand: z.string().max(100).optional(),
  price_min: z.coerce.number().int().min(0).optional(),
  price_max: z.coerce.number().int().min(0).optional(),
  sort: productSort.default('newest').optional(),
};

export const ProductSearchQuerySchema = z
  .object({
    q: z.string().min(1).max(100),
    page: z.coerce.number().int().min(1).default(1).optional(),
    limit: z.coerce.number().int().min(1).max(50).default(24).optional(),
    suggest: z
      .enum(['true', 'false'])
      .optional()
      .transform((v) => v === 'true'),
    ...searchFilterFields,
  })
  .superRefine((data, ctx) => {
    if (!data.suggest && data.q.trim().length < 2) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Search query must be at least 2 characters',
        path: ['q'],
      });
    }
  });

export const ProductSearchFiltersQuerySchema = z.object({
  q: z.string().min(2).max(100),
});

export const ProductFilterScopeQuerySchema = ProductListQuerySchema.pick({
  category: true,
  category_id: true,
  subcategory: true,
  tag: true,
});

export const ProductIdSchema = z.object({
  id: z.string().uuid('ID must be a valid UUID'),
});

export const CreateProductSchema = z.object({
  title: z.string().min(1, 'Title is required').max(300),
  description: z.string().nullable().optional(),
  price: z.number().int('Price must be an integer').positive('Price must be positive'),
  category_id: z.string().uuid().nullable().optional(),
  brand: z.string().max(100).nullable().optional(),
  condition: productCondition.nullable().optional(),
  material: z.string().max(100).nullable().optional(),
  color: z.string().max(50).nullable().optional(),
  size: z.string().max(20).nullable().optional(),
  images: z.array(z.string().min(1)).min(1, 'At least one image is required'),
});

export const UpdateProductSchema = CreateProductSchema.partial().omit({ images: true });

export const AdminProductListQuerySchema = ProductListQuerySchema.extend({
  status: productStatus.optional(),
  search: z.string().max(100).optional(),
});

export const VendorProductListQuerySchema = z.object({
  status: productStatus.optional(),
  search: z.string().max(100).optional(),
  category_id: z.string().uuid().optional(),
  low_stock: z.enum(['true']).optional(),
  page: z.coerce.number().int().min(1).default(1).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(24).optional(),
});

export const VendorCreateProductSchema = CreateProductSchema.extend({
  status: z.enum(['DRAFT', 'PENDING_REVIEW']).default('PENDING_REVIEW'),
  stock: z.coerce.number().int().min(1).default(1),
});

export const VendorUpdateProductSchema = CreateProductSchema.partial()
  .omit({ images: true })
  .extend({
    images: z.array(z.string().min(1)).optional(),
    status: z.enum(['DRAFT', 'PENDING_REVIEW', 'ACTIVE']).optional(),
    stock: z.coerce.number().int().min(1).optional(),
  });

export const RejectProductSchema = z.object({
  reason: z.string().min(1, 'Reason is required').max(1000),
});

export type ProductListQueryInput = z.infer<typeof ProductListQuerySchema>;
export type ProductFilterScopeQueryInput = z.infer<typeof ProductFilterScopeQuerySchema>;
export type ProductSearchQueryInput = z.infer<typeof ProductSearchQuerySchema>;
export type ProductSearchFiltersQueryInput = z.infer<typeof ProductSearchFiltersQuerySchema>;
export type CreateProductBody = z.infer<typeof CreateProductSchema>;
export type UpdateProductBody = z.infer<typeof UpdateProductSchema>;
export type AdminProductListQueryInput = z.infer<typeof AdminProductListQuerySchema>;
export type VendorProductListQueryInput = z.infer<typeof VendorProductListQuerySchema>;
export type VendorCreateProductBody = z.infer<typeof VendorCreateProductSchema>;
export type VendorUpdateProductBody = z.infer<typeof VendorUpdateProductSchema>;
export type RejectProductBody = z.infer<typeof RejectProductSchema>;
