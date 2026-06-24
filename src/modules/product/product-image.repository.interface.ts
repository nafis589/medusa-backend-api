import type { CreateProductImageData, ProductImage } from './product-image.entity';

export interface IProductImageRepository {
  findByProductId(productId: string): Promise<ProductImage[]>;
  create(data: CreateProductImageData & { id: string }): Promise<ProductImage>;
  createMany(images: (CreateProductImageData & { id: string })[]): Promise<ProductImage[]>;
  deleteByProductId(productId: string): Promise<void>;
}
