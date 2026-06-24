import type { Category, CreateCategoryData, UpdateCategoryData } from './category.entity';

/**
 * Repository interface for Category persistence.
 * Implementations can use mysql2, MikroORM, or any other adapter.
 */
export interface ICategoryRepository {
  /** Fetch all categories ordered by position ASC */
  findAll(): Promise<Category[]>;

  /** Find a single category by its primary key */
  findById(id: string): Promise<Category | null>;

  /** Find a category by slug */
  findBySlug(slug: string): Promise<Category | null>;

  /** Check whether a slug is already taken (excluding a given id) */
  isSlugTaken(slug: string, excludeId?: string): Promise<boolean>;

  /** Count products linked to a category */
  countProducts(categoryId: string): Promise<number>;

  /** Category id plus all descendant category ids */
  findDescendantIds(rootId: string): Promise<string[]>;

  /** Insert and return a new category */
  create(data: CreateCategoryData & { id: string; slug: string }): Promise<Category>;

  /** Update and return the modified category */
  update(id: string, data: UpdateCategoryData): Promise<Category>;

  /** Delete a category by id */
  delete(id: string): Promise<void>;
}
