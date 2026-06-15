import type { Cart } from './cart.entity';
import type { CartItem } from './cart-item.entity';
import type { ProductStatus } from '@modules/product/product.entity';

export interface CartItemProductSummary {
  title: string;
  primary_image: string | null;
  price: number;
  status: ProductStatus;
}

export interface CartItemWithProduct extends CartItem {
  product: CartItemProductSummary;
}

export interface CartWithItems {
  cart: Cart;
  items: CartItemWithProduct[];
  total: number;
}
