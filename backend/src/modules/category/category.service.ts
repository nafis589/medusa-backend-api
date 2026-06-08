import { randomUUID } from 'crypto';
import { AppError } from '@shared/errors/app-error';
import { generateSlug } from '@shared/utils/slug';
import type {
  Category,
  CategoryWithChildren,
  CreateCategoryData,
  UpdateCategoryData,
} from './category.entity';
import type { ICategoryRepository } from './category.repository.interface';

export class CategoryService {
  constructor(private readonly repo: ICategoryRepository) {}

  // ── Private helpers ────────────────────────────────────────────────────────

  /** Recursively nest flat categories into a tree structure */
  private buildTree(
    categories: Category[],
    parentId: string | null = null,
  ): CategoryWithChildren[] {
    return categories
      .filter((c) => c.parent_id === parentId)
      .sort((a, b) => a.position - b.position)
      .map((c) => ({
        ...c,
        children: this.buildTree(categories, c.id),
      }));
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /**
   * Returns the full category tree: root nodes with nested children,
   * ordered by position ASC at every level.
   */
  async getTree(): Promise<CategoryWithChildren[]> {
    const all = await this.repo.findAll();
    return this.buildTree(all);
  }

  /**
   * Finds a category by slug and returns it with its direct children.
   * Throws 404 NOT_FOUND if the slug does not exist.
   */
  async findBySlug(slug: string): Promise<CategoryWithChildren> {
    const category = await this.repo.findBySlug(slug);
    if (!category) {
      throw new AppError(404, 'NOT_FOUND', `Category '${slug}' not found`);
    }

    const all = await this.repo.findAll();
    return {
      ...category,
      children: this.buildTree(all, category.id),
    };
  }

  /**
   * Creates a new category.
   * If `slug` is not provided, it is auto-generated from `name`.
   * Throws 409 CONFLICT if the generated/provided slug is already taken.
   */
  async create(data: CreateCategoryData): Promise<Category> {
    const slug = data.slug ?? generateSlug(data.name);

    const slugTaken = await this.repo.isSlugTaken(slug);
    if (slugTaken) {
      throw new AppError(409, 'CONFLICT', `Slug '${slug}' is already in use`);
    }

    return this.repo.create({
      ...data,
      id: randomUUID(),
      slug,
      parent_id: data.parent_id ?? null,
      column_group: data.column_group ?? null,
      image_url: data.image_url ?? null,
      position: data.position ?? 0,
    });
  }

  /**
   * Updates an existing category.
   * If `slug` changes, validates uniqueness.
   * Throws 404 NOT_FOUND if the category does not exist.
   */
  async update(id: string, data: UpdateCategoryData): Promise<Category> {
    const existing = await this.repo.findById(id);
    if (!existing) {
      throw new AppError(404, 'NOT_FOUND', `Category '${id}' not found`);
    }

    // If a new slug is provided, check it is not taken by another category
    if (data.slug !== undefined && data.slug !== existing.slug) {
      const slugTaken = await this.repo.isSlugTaken(data.slug, id);
      if (slugTaken) {
        throw new AppError(409, 'CONFLICT', `Slug '${data.slug}' is already in use`);
      }
    }

    return this.repo.update(id, data);
  }

  /**
   * Deletes a category.
   * Throws 404 NOT_FOUND if it does not exist.
   * Throws 409 CATEGORY_HAS_PRODUCTS if products are still attached.
   */
  async delete(id: string): Promise<void> {
    const existing = await this.repo.findById(id);
    if (!existing) {
      throw new AppError(404, 'NOT_FOUND', `Category '${id}' not found`);
    }

    const productCount = await this.repo.countProducts(id);
    if (productCount > 0) {
      throw new AppError(
        409,
        'CATEGORY_HAS_PRODUCTS',
        `Cannot delete category '${existing.name}': it still has ${String(productCount)} product(s) attached`,
      );
    }

    await this.repo.delete(id);
  }
}
