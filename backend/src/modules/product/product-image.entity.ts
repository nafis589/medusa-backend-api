/** ProductImage entity — data shape stored in MySQL */
export interface ProductImage {
  id: string;
  product_id: string;
  url: string;
  position: number;
  is_primary: boolean;
}

/** Payload for creating a product image */
export interface CreateProductImageData {
  product_id: string;
  url: string;
  position?: number;
  is_primary?: boolean;
}

/** Payload for updating a product image (all fields optional) */
export type UpdateProductImageData = Partial<Omit<CreateProductImageData, 'product_id'>>;
