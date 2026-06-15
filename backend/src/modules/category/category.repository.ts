import type { ICategoryRepository } from './category.repository.interface';
import type { Category, CreateCategoryData, UpdateCategoryData } from './category.entity';
import { getPool } from '@shared/utils/db';

import type mysql from 'mysql2/promise';

export class CategoryRepository implements ICategoryRepository {
  private get pool(): mysql.Pool {
    return getPool();
  }

  async findAll(): Promise<Category[]> {
    const [rows] = await this.pool.query('SELECT * FROM categories ORDER BY position ASC, created_at ASC');
    return rows as Category[];
  }

  async findById(id: string): Promise<Category | null> {
    const [rows] = await this.pool.query('SELECT * FROM categories WHERE id = ?', [id]);
    const results = rows as Category[];
    return results.length > 0 ? results[0] : null;
  }

  async findBySlug(slug: string): Promise<Category | null> {
    const [rows] = await this.pool.query('SELECT * FROM categories WHERE slug = ?', [slug]);
    const results = rows as Category[];
    return results.length > 0 ? results[0] : null;
  }

  async isSlugTaken(slug: string, excludeId?: string): Promise<boolean> {
    let query = 'SELECT COUNT(*) as count FROM categories WHERE slug = ?';
    const params: (string | number)[] = [slug];

    if (excludeId !== undefined) {
      query += ' AND id != ?';
      params.push(excludeId);
    }

    const [rows] = await this.pool.query(query, params);
    const results = rows as { count: number }[];
    return results[0].count > 0;
  }

  async countProducts(categoryId: string): Promise<number> {
    const [rows] = await this.pool.query('SELECT COUNT(*) as count FROM products WHERE category_id = ?', [categoryId]);
    const results = rows as { count: number }[];
    return results[0].count;
  }

  async findDescendantIds(rootId: string): Promise<string[]> {
    const [rows] = await this.pool.query(
      `WITH RECURSIVE cat_tree AS (
        SELECT id FROM categories WHERE id = ?
        UNION ALL
        SELECT c.id FROM categories c
        INNER JOIN cat_tree ct ON c.parent_id = ct.id
      )
      SELECT id FROM cat_tree`,
      [rootId],
    );
    return (rows as { id: string }[]).map((row) => row.id);
  }

  async create(data: CreateCategoryData & { id: string; slug: string }): Promise<Category> {
    await this.pool.query(
      'INSERT INTO categories (id, name, slug, parent_id, column_group, image_url, position) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [
        data.id,
        data.name,
        data.slug,
        data.parent_id ?? null,
        data.column_group ?? null,
        data.image_url ?? null,
        data.position ?? 0,
      ],
    );

    const created = await this.findById(data.id);
    if (!created) {
      throw new Error(`Failed to find created category with id: ${data.id}`);
    }
    return created;
  }

  async update(id: string, data: UpdateCategoryData): Promise<Category> {
    const fields: string[] = [];
    const params: unknown[] = [];

    for (const [key, value] of Object.entries(data) as [string, unknown][]) {
      if (value !== undefined) {
        fields.push(`\`${key}\` = ?`);
        params.push(value);
      }
    }

    if (fields.length > 0) {
      params.push(id);
      await this.pool.query(`UPDATE categories SET ${fields.join(', ')} WHERE id = ?`, params);
    }

    const updated = await this.findById(id);
    if (!updated) {
      throw new Error(`Failed to find updated category with id: ${id}`);
    }
    return updated;
  }

  async delete(id: string): Promise<void> {
    await this.pool.query('DELETE FROM categories WHERE id = ?', [id]);
  }
}
