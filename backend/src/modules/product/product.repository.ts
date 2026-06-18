import { TOGO_REGIONS } from '@modules/shipping/togo-regions';
import { getPool } from '@shared/utils/db';
import { AppError } from '@shared/errors/app-error';
import type mysql from 'mysql2/promise';
import type { PoolConnection } from 'mysql2/promise';
import type { CreateProductData, Product, ProductStatus, UpdateProductData } from './product.entity';
import type {
  IProductRepository,
  ProductDetailRow,
  ProductListQuery,
} from './product.repository.interface';
import type { ProductListItem, ProductReview, ProductVendorSummary, ProductCategoryPath, ProductFilterFacets, FilterFacetOption } from './product.types';
import type { VendorContact } from './product.repository.interface';
import { ProductImageRepository } from './product-image.repository';

function resolveVendorRegionName(regionId: string | null | undefined): string | null {
  if (!regionId) return null;
  return TOGO_REGIONS.find((r) => r.id === regionId)?.name ?? regionId;
}

function mapListItem(row: mysql.RowDataPacket): ProductListItem {
  return {
    ...mapProduct(row),
    primary_image: (row.primary_image as string | null) ?? null,
    shop_name: (row.shop_name as string | null) ?? null,
    category_name: (row.category_name as string | null) ?? null,
    vendor_region: resolveVendorRegionName(row.vendor_region_id as string | null),
  };
}

function resolveCategoryPath(
  leaf: string | null | undefined,
  parent: string | null | undefined,
  root: string | null | undefined,
): ProductCategoryPath {
  if (!leaf) return { universe: null, category: null, subcategory: null };
  if (root) return { universe: root, category: parent ?? null, subcategory: leaf };
  if (parent) return { universe: parent, category: leaf, subcategory: null };
  return { universe: leaf, category: null, subcategory: null };
}

function mapProduct(row: mysql.RowDataPacket): Product {
  return {
    id: row.id as string,
    vendor_id: row.vendor_id as string,
    title: row.title as string,
    description: row.description as string | null,
    price: Number(row.price),
    category_id: row.category_id as string | null,
    brand: row.brand as string | null,
    condition: row.condition as Product['condition'],
    material: row.material as string | null,
    color: row.color as string | null,
    size: row.size as string | null,
    status: row.status as ProductStatus,
    stock: Number(row.stock ?? 1),
    views_count: Number(row.views_count),
    created_at: row.created_at as Date,
    updated_at: row.updated_at as Date,
  };
}

export class ProductRepository implements IProductRepository {
  private readonly imageRepo = new ProductImageRepository();

  private get pool(): mysql.Pool {
    return getPool();
  }

  private buildListWhere(query: ProductListQuery): { clause: string; params: unknown[] } {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (!query.skipStatusFilter) {
      const statuses = query.status
        ? Array.isArray(query.status)
          ? query.status
          : [query.status]
        : ['ACTIVE'];

      conditions.push(`p.status IN (${statuses.map(() => '?').join(', ')})`);
      params.push(...statuses);
    } else if (query.status) {
      const statuses = Array.isArray(query.status) ? query.status : [query.status];
      conditions.push(`p.status IN (${statuses.map(() => '?').join(', ')})`);
      params.push(...statuses);
    }

    if (query.vendor_id) {
      conditions.push('p.vendor_id = ?');
      params.push(query.vendor_id);
    }
    if (query.category_ids && query.category_ids.length > 0) {
      conditions.push(`p.category_id IN (${query.category_ids.map(() => '?').join(', ')})`);
      params.push(...query.category_ids);
    } else if (query.category_id) {
      conditions.push('p.category_id = ?');
      params.push(query.category_id);
    }
    if (query.condition) {
      conditions.push('p.`condition` = ?');
      params.push(query.condition);
    }
    if (query.color) {
      conditions.push('p.color = ?');
      params.push(query.color);
    }
    if (query.size) {
      conditions.push('p.size = ?');
      params.push(query.size);
    }
    if (query.material) {
      conditions.push('p.material = ?');
      params.push(query.material);
    }
    if (query.brand) {
      conditions.push('p.brand = ?');
      params.push(query.brand);
    }
    if (query.ids && query.ids.length > 0) {
      conditions.push(`p.id IN (${query.ids.map(() => '?').join(', ')})`);
      params.push(...query.ids);
    }
    if (query.tag === 'offer') {
      conditions.push('p.price <= 25000');
    }
    if (query.tag === 'we_love') {
      conditions.push('p.views_count >= 5');
    }
    if (query.price_min !== undefined) {
      conditions.push('p.price >= ?');
      params.push(query.price_min);
    }
    if (query.price_max !== undefined) {
      conditions.push('p.price <= ?');
      params.push(query.price_max);
    }
    if (query.low_stock) {
      conditions.push('p.stock <= 2');
      conditions.push("p.status = 'ACTIVE'");
    }
    if (query.search?.trim()) {
      conditions.push('(p.title LIKE ? OR p.brand LIKE ?)');
      const term = `%${query.search.trim()}%`;
      params.push(term, term);
    }

    return {
      clause: conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '',
      params,
    };
  }

  private buildOrderBy(sort: string): string {
    switch (sort) {
      case 'price_asc':
        return 'ORDER BY p.price ASC, p.created_at DESC';
      case 'price_desc':
        return 'ORDER BY p.price DESC, p.created_at DESC';
      case 'popularity':
        return 'ORDER BY p.views_count DESC, p.created_at DESC';
      case 'newest':
      default:
        return 'ORDER BY p.created_at DESC';
    }
  }

  async findById(id: string): Promise<Product | null> {
    const [rows] = await this.pool.query('SELECT * FROM products WHERE id = ?', [id]);
    const results = rows as mysql.RowDataPacket[];
    return results.length > 0 ? mapProduct(results[0]) : null;
  }

  async findActiveById(id: string): Promise<Product | null> {
    const [rows] = await this.pool.query(
      "SELECT * FROM products WHERE id = ? AND status = 'ACTIVE'",
      [id],
    );
    const results = rows as mysql.RowDataPacket[];
    return results.length > 0 ? mapProduct(results[0]) : null;
  }

  async findDetailById(id: string): Promise<ProductDetailRow | null> {
    const [rows] = await this.pool.query(
      `SELECT p.*, v.shop_name, v.rating AS vendor_rating, v.total_sales AS vendor_total_sales,
              vl.region_id AS vendor_region_id,
              cat.name AS category_name,
              cat_parent.name AS parent_category_name,
              cat_root.name AS root_category_name
       FROM products p
       INNER JOIN vendors v ON v.id = p.vendor_id
       LEFT JOIN vendor_locations vl ON vl.vendor_id = p.vendor_id
       LEFT JOIN categories cat ON cat.id = p.category_id
       LEFT JOIN categories cat_parent ON cat_parent.id = cat.parent_id
       LEFT JOIN categories cat_root ON cat_root.id = cat_parent.parent_id
       WHERE p.id = ?`,
      [id],
    );
    const results = rows as mysql.RowDataPacket[];
    if (results.length === 0) return null;

    const row = results[0];
    const product = mapProduct(row);
    const vendor: ProductVendorSummary = {
      shop_name: row.shop_name as string,
      rating: Number(row.vendor_rating),
      total_sales: Number(row.vendor_total_sales),
    };
    const vendor_region = resolveVendorRegionName(row.vendor_region_id as string | null);
    const category_path = resolveCategoryPath(
      row.category_name as string | null,
      row.parent_category_name as string | null,
      row.root_category_name as string | null,
    );

    const [images, reviews] = await Promise.all([
      this.imageRepo.findByProductId(id),
      this.findReviewsByProductId(id, 5),
    ]);

    return { product, images, vendor, reviews, vendor_region, category_path };
  }

  /** Reviews table is added in Phase 10 — returns an empty list until then. */
  private async findReviewsByProductId(productId: string, limit: number): Promise<ProductReview[]> {
    const [tables] = await this.pool.query<mysql.RowDataPacket[]>(
      `SELECT COUNT(*) AS cnt FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'reviews'`,
    );
    if (Number(tables[0]?.cnt) === 0) {
      return [];
    }

    const [rows] = await this.pool.query(
      `SELECT id, buyer_id, rating, comment, created_at
       FROM reviews
       WHERE product_id = ?
       ORDER BY created_at DESC
       LIMIT ?`,
      [productId, limit],
    );

    return (rows as mysql.RowDataPacket[]).map((r) => ({
      id: r.id as string,
      buyer_id: r.buyer_id as string,
      rating: Number(r.rating),
      comment: r.comment as string | null,
      created_at: r.created_at as Date,
    }));
  }

  async list(query: ProductListQuery): Promise<{ products: ProductListItem[]; total: number }> {
    const { clause, params } = this.buildListWhere(query);
    const orderBy = this.buildOrderBy(query.sort);

    const [countRows] = await this.pool.query(
      `SELECT COUNT(*) AS total
       FROM products p
       LEFT JOIN vendors v ON v.id = p.vendor_id
       ${clause}`,
      params,
    );
    const total = Number((countRows as mysql.RowDataPacket[])[0]?.total ?? 0);

    const orderClause =
      query.ids && query.ids.length > 0
        ? `ORDER BY FIELD(p.id, ${query.ids.map(() => '?').join(', ')})`
        : orderBy;
    const orderParams = query.ids && query.ids.length > 0 ? [...query.ids] : [];

    const [rows] = await this.pool.query(
      `SELECT p.*, pi.url AS primary_image, v.shop_name, vl.region_id AS vendor_region_id,
              cat.name AS category_name
       FROM products p
       LEFT JOIN product_images pi ON pi.product_id = p.id AND pi.is_primary = TRUE
       LEFT JOIN vendors v ON v.id = p.vendor_id
       LEFT JOIN vendor_locations vl ON vl.vendor_id = p.vendor_id
       LEFT JOIN categories cat ON cat.id = p.category_id
       ${clause}
       ${orderClause}
       LIMIT ? OFFSET ?`,
      [...params, ...orderParams, query.limit, query.offset],
    );

    const products = (rows as mysql.RowDataPacket[]).map((row) => mapListItem(row));

    return { products, total };
  }

  async create(data: CreateProductData & { id: string }): Promise<Product> {
    await this.pool.query(
      `INSERT INTO products (
        id, vendor_id, title, description, price, category_id, brand,
        \`condition\`, material, color, size, status, stock, views_count
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.id,
        data.vendor_id,
        data.title,
        data.description ?? null,
        data.price,
        data.category_id ?? null,
        data.brand ?? null,
        data.condition ?? null,
        data.material ?? null,
        data.color ?? null,
        data.size ?? null,
        data.status ?? 'DRAFT',
        data.stock ?? 1,
        data.views_count ?? 0,
      ],
    );

    const created = await this.findById(data.id);
    if (!created) {
      throw new Error(`Failed to find created product with id: ${data.id}`);
    }
    return created;
  }

  async update(id: string, data: UpdateProductData): Promise<Product> {
    const fields: string[] = [];
    const params: unknown[] = [];

    for (const [key, value] of Object.entries(data) as [string, unknown][]) {
      if (value !== undefined) {
        const column = key === 'condition' ? '`condition`' : key;
        fields.push(`${column} = ?`);
        params.push(value);
      }
    }

    if (fields.length > 0) {
      params.push(id);
      await this.pool.query(`UPDATE products SET ${fields.join(', ')} WHERE id = ?`, params);
    }

    const updated = await this.findById(id);
    if (!updated) {
      throw new Error(`Failed to find updated product with id: ${id}`);
    }
    return updated;
  }

  async updateStatus(id: string, status: ProductStatus): Promise<Product> {
    await this.pool.query('UPDATE products SET status = ? WHERE id = ?', [status, id]);
    const updated = await this.findById(id);
    if (!updated) {
      throw new Error(`Failed to find updated product with id: ${id}`);
    }
    return updated;
  }

  async incrementViews(id: string): Promise<void> {
    await this.pool.query('UPDATE products SET views_count = views_count + 1 WHERE id = ?', [id]);
  }

  async search(
    query: string,
    offset: number,
    limit: number,
  ): Promise<{ products: ProductListItem[]; total: number }> {
    const term = query.trim();
    const baseWhere = `WHERE p.status = 'ACTIVE'
      AND MATCH(p.title, p.description) AGAINST(? IN NATURAL LANGUAGE MODE)`;

    const [countRows] = await this.pool.query(
      `SELECT COUNT(*) AS total FROM products p ${baseWhere}`,
      [term],
    );
    const total = Number((countRows as mysql.RowDataPacket[])[0]?.total ?? 0);

    const [rows] = await this.pool.query(
      `SELECT p.*, pi.url AS primary_image, vl.region_id AS vendor_region_id,
              MATCH(p.title, p.description) AGAINST(? IN NATURAL LANGUAGE MODE) AS relevance
       FROM products p
       LEFT JOIN product_images pi ON pi.product_id = p.id AND pi.is_primary = TRUE
       LEFT JOIN vendor_locations vl ON vl.vendor_id = p.vendor_id
       ${baseWhere}
       ORDER BY relevance DESC, p.created_at DESC
       LIMIT ? OFFSET ?`,
      [term, term, limit, offset],
    );

    const products = (rows as mysql.RowDataPacket[]).map((row) => mapListItem(row));

    return { products, total };
  }

  async findTrending(limit: number): Promise<ProductListItem[]> {
    const [rows] = await this.pool.query(
      `SELECT p.*, pi.url AS primary_image, v.shop_name, vl.region_id AS vendor_region_id
       FROM products p
       LEFT JOIN product_images pi ON pi.product_id = p.id AND pi.is_primary = TRUE
       LEFT JOIN vendors v ON v.id = p.vendor_id
       LEFT JOIN vendor_locations vl ON vl.vendor_id = p.vendor_id
       WHERE p.status = 'ACTIVE'
         AND p.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
       ORDER BY p.views_count DESC, p.created_at DESC
       LIMIT ?`,
      [limit],
    );

    return (rows as mysql.RowDataPacket[]).map((row) => mapListItem(row));
  }

  async getFilterFacets(scope: ProductListQuery): Promise<ProductFilterFacets> {
    const { clause, params } = this.buildListWhere({
      ...scope,
      condition: undefined,
      color: undefined,
      size: undefined,
      material: undefined,
      brand: undefined,
      price_min: undefined,
      price_max: undefined,
      sort: 'newest',
      offset: 0,
      limit: 1,
      status: 'ACTIVE',
    });

    const baseFrom = `FROM products p ${clause}`;
    const append = clause ? ' AND' : ' WHERE';

    const facetQuery = async (column: string): Promise<FilterFacetOption[]> => {
      const [rows] = await this.pool.query(
        `SELECT p.\`${column}\` AS value, COUNT(*) AS count
         ${baseFrom}${append} p.\`${column}\` IS NOT NULL AND TRIM(p.\`${column}\`) <> ''
         GROUP BY p.\`${column}\`
         ORDER BY count DESC, value ASC`,
        params,
      );
      return (rows as mysql.RowDataPacket[]).map((row) => ({
        value: String(row.value),
        count: Number(row.count),
      }));
    };

    const [priceRows] = await this.pool.query(
      `SELECT MIN(p.price) AS min_price, MAX(p.price) AS max_price ${baseFrom}`,
      params,
    );
    const priceRow = (priceRows as mysql.RowDataPacket[])[0];
    const minPrice = priceRow?.min_price != null ? Number(priceRow.min_price) : null;
    const maxPrice = priceRow?.max_price != null ? Number(priceRow.max_price) : null;

    const [conditions, sizes, colors, materials, brands] = await Promise.all([
      facetQuery('condition'),
      facetQuery('size'),
      facetQuery('color'),
      facetQuery('material'),
      facetQuery('brand'),
    ]);

    return {
      conditions,
      sizes,
      colors,
      materials,
      brands,
      price:
        minPrice != null && maxPrice != null && maxPrice >= minPrice
          ? { min: minPrice, max: maxPrice }
          : null,
    };
  }

  async findVendorContactByProductId(productId: string): Promise<VendorContact | null> {
    const [rows] = await this.pool.query(
      `SELECT u.email, v.shop_name, p.title AS product_title
       FROM products p
       INNER JOIN vendors v ON v.id = p.vendor_id
       INNER JOIN users u ON u.id = v.user_id
       WHERE p.id = ?`,
      [productId],
    );
    const results = rows as mysql.RowDataPacket[];
    if (results.length === 0) return null;

    const row = results[0];
    return {
      email: row.email as string,
      shop_name: row.shop_name as string,
      product_title: row.product_title as string,
    };
  }

  async findByIdForUpdate(id: string, connection: PoolConnection): Promise<Product | null> {
    const [rows] = await connection.query('SELECT * FROM products WHERE id = ? FOR UPDATE', [id]);
    const results = rows as mysql.RowDataPacket[];
    return results.length > 0 ? mapProduct(results[0]) : null;
  }

  async decrementStock(
    id: string,
    quantity: number,
    connection: PoolConnection,
  ): Promise<void> {
    const [result] = await connection.query(
      'UPDATE products SET stock = stock - ? WHERE id = ? AND stock >= ?',
      [quantity, id, quantity],
    );
    const affected = (result as mysql.ResultSetHeader).affectedRows;
    if (affected === 0) {
      throw new AppError(400, 'INSUFFICIENT_STOCK', 'Insufficient stock for this product');
    }
  }

  async incrementStock(
    id: string,
    quantity: number,
    connection?: PoolConnection,
  ): Promise<void> {
    const db = connection ?? this.pool;
    await db.query('UPDATE products SET stock = stock + ? WHERE id = ?', [quantity, id]);
  }
}
