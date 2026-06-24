export type ProductCondition = 'NEW' | 'VERY_GOOD' | 'GOOD' | 'FAIR';

export type ProductStatus =
  | 'DRAFT'
  | 'PENDING_REVIEW'
  | 'ACTIVE'
  | 'SOLD'
  | 'ARCHIVED'
  | 'REJECTED';

/** Product entity — data shape stored in MySQL */
export interface Product {
  id: string;
  vendor_id: string;
  title: string;
  description: string | null;
  price: number;
  category_id: string | null;
  brand: string | null;
  condition: ProductCondition | null;
  material: string | null;
  color: string | null;
  size: string | null;
  status: ProductStatus;
  stock: number;
  views_count: number;
  created_at: Date;
  updated_at: Date;
}

/** Payload for creating a product */
export interface CreateProductData {
  vendor_id: string;
  title: string;
  description?: string | null;
  price: number;
  category_id?: string | null;
  brand?: string | null;
  condition?: ProductCondition | null;
  material?: string | null;
  color?: string | null;
  size?: string | null;
  status?: ProductStatus;
  stock?: number;
  views_count?: number;
}

/** Payload for updating a product (all fields optional) */
export type UpdateProductData = Partial<Omit<CreateProductData, 'vendor_id'>>;
