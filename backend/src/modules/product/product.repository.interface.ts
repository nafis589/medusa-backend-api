import type { Product, ProductStatus, UpdateProductData } from './product.entity';
import type { ProductListItem, ProductReview, ProductVendorSummary, ProductFilterFacets } from './product.types';
import type { PoolConnection } from 'mysql2/promise';

export interface ProductListQuery {
  category_id?: string;
  category_ids?: string[];
  condition?: string;
  color?: string;
  size?: string;
  material?: string;
  brand?: string;
  price_min?: number;
  price_max?: number;
  sort: string;
  offset: number;
  limit: number;
  status?: ProductStatus | ProductStatus[];
  vendor_id?: string;
  skipStatusFilter?: boolean;
  ids?: string[];
  tag?: 'offer' | 'we_love';
  low_stock?: boolean;
  search?: string;
}

export interface VendorContact {
  email: string;
  shop_name: string;
  product_title: string;
}

export interface ProductDetailRow {
  product: Product;
  images: import('./product-image.entity').ProductImage[];
  vendor: ProductVendorSummary;
  reviews: ProductReview[];
  vendor_region: string | null;
  category_path: import('./product.types').ProductCategoryPath;
}

export interface IProductRepository {
  findById(id: string): Promise<Product | null>;
  findActiveById(id: string): Promise<Product | null>;
  findDetailById(id: string): Promise<ProductDetailRow | null>;
  list(query: ProductListQuery): Promise<{ products: ProductListItem[]; total: number }>;
  create(data: import('./product.entity').CreateProductData & { id: string }): Promise<Product>;
  update(id: string, data: UpdateProductData): Promise<Product>;
  updateStatus(id: string, status: ProductStatus): Promise<Product>;
  incrementViews(id: string): Promise<void>;
  search(
    query: string,
    offset: number,
    limit: number,
  ): Promise<{ products: ProductListItem[]; total: number }>;
  findTrending(limit: number): Promise<ProductListItem[]>;
  getFilterFacets(scope: ProductListQuery): Promise<ProductFilterFacets>;
  findVendorContactByProductId(productId: string): Promise<VendorContact | null>;
  findByIdForUpdate(id: string, connection: PoolConnection): Promise<Product | null>;
  decrementStock(id: string, quantity: number, connection: PoolConnection): Promise<void>;
  incrementStock(id: string, quantity: number, connection?: PoolConnection): Promise<void>;
}
