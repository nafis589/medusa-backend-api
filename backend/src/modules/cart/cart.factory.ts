import { ProductRepository } from '@modules/product/product.repository';
import { CartRepository } from './cart.repository';
import { CartItemRepository } from './cart-item.repository';
import { CartService } from './cart.service';

export function createCartService(): CartService {
  return new CartService(new CartRepository(), new CartItemRepository(), new ProductRepository());
}
