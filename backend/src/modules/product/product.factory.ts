import { CategoryRepository } from '@modules/category/category.repository';
import { ProductImageRepository } from './product-image.repository';
import { ProductRepository } from './product.repository';
import { ProductService } from './product.service';

export function createProductService(): ProductService {
  return new ProductService(
    new ProductRepository(),
    new ProductImageRepository(),
    new CategoryRepository(),
  );
}
