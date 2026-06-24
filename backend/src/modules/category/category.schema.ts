import { z } from 'zod';

export const CreateCategorySchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name cannot exceed 100 characters'),
  slug: z.string().max(100, 'Slug cannot exceed 100 characters').optional(),
  parent_id: z.string().uuid('Parent ID must be a valid UUID').nullable().optional(),
  column_group: z.string().max(100, 'Column group cannot exceed 100 characters').nullable().optional(),
  image_url: z.string().max(500, 'Image URL cannot exceed 500 characters').nullable().optional(),
  position: z.number().int('Position must be an integer').default(0).optional(),
});

export const UpdateCategorySchema = CreateCategorySchema.partial();

export const CategorySlugSchema = z.object({
  slug: z.string().min(1, 'Slug is required').max(100, 'Slug cannot exceed 100 characters'),
});

export const CategoryIdSchema = z.object({
  id: z.string().uuid('ID must be a valid UUID'),
});

export type CreateCategoryInput = z.infer<typeof CreateCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof UpdateCategorySchema>;
