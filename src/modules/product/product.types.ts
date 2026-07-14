import type { Product, ProductCondition } from './product.entity';
import type { ProductImage } from './product-image.entity';

export type ProductSort = 'newest' | 'price_asc' | 'price_desc' | 'popularity';

export interface ProductListFilters {
  /** Category slug or UUID */
  category?: string;
  category_id?: string;
  category_ids?: string[];
  subcategory?: string;
  condition?: ProductCondition;
  color?: string;
  size?: string;
  material?: string;
  brand?: string;
  price_min?: number;
  price_max?: number;
  sort?: ProductSort;
  page?: number;
  limit?: number;
  ids?: string;
  tag?: 'offer' | 'we_love';
  low_stock?: boolean;
  search?: string;
  status?: import('./product.entity').ProductStatus;
}

export interface ProductListItem extends Product {
  primary_image: string | null;
  shop_name?: string | null;
  category_name?: string | null;
  /** Région Togo du vendeur (ex. Maritime, Kara) */
  vendor_region?: string | null;
}

export interface FilterFacetOption {
  value: string;
  label?: string;
  count: number;
}

export interface ProductFilterFacets {
  conditions: FilterFacetOption[];
  sizes: FilterFacetOption[];
  colors: FilterFacetOption[];
  materials: FilterFacetOption[];
  brands: FilterFacetOption[];
  price: { min: number; max: number } | null;
}

export type SearchSuggestionType = 'query' | 'brand' | 'category';

export interface SearchSuggestion {
  type: SearchSuggestionType;
  label: string;
  count: number;
}

export interface ProductVendorSummary {
  shop_name: string;
  shop_logo: string | null;
  rating: number;
  total_sales: number;
}

export interface ProductCategoryPath {
  universe: string | null;
  category: string | null;
  subcategory: string | null;
}

export interface ProductReview {
  id: string;
  buyer_id: string;
  rating: number;
  comment: string | null;
  created_at: Date;
}

export interface ProductDetail extends Product {
  images: ProductImage[];
  vendor: ProductVendorSummary;
  reviews: ProductReview[];
  vendor_region?: string | null;
  category_path?: ProductCategoryPath;
}

export interface CreateProductInput {
  title: string;
  description?: string | null;
  price: number;
  category_id?: string | null;
  brand?: string | null;
  condition?: ProductCondition | null;
  material?: string | null;
  color?: string | null;
  size?: string | null;
  /** Base64 data URLs or temporary HTTP(S) image URLs */
  images: string[];
  status?: 'DRAFT' | 'PENDING_REVIEW';
  stock?: number;
}

export type UpdateProductInput = Partial<Omit<CreateProductInput, 'images' | 'status'>> & {
  images?: string[];
  status?: import('./product.entity').ProductStatus;
  stock?: number;
};

export interface VendorProductDetail extends Product {
  images: ProductImage[];
  category_name: string | null;
  orders_count: number;
}

export interface AdminProductListFilters extends ProductListFilters {
  status?: import('./product.entity').ProductStatus;
}

export interface AdminProductVendorInfo {
  shop_name: string;
  email: string;
  status: string;
}

export interface AdminProductDetail extends Product {
  images: ProductImage[];
  category_name: string | null;
  orders_count: number;
  vendor: AdminProductVendorInfo;
}
