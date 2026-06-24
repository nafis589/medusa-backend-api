import type { Cart } from './cart.entity';
import type { CartItem } from './cart-item.entity';
import type { ProductStatus } from '@modules/product/product.entity';

export interface CartItemVendorSummary {
  id: string;
  shop_name: string;
  total_sales: number;
  active_products: number;
  region: string | null;
}

export interface CartItemProductSummary {
  title: string;
  primary_image: string | null;
  price: number;
  status: ProductStatus;
  vendor: CartItemVendorSummary;
}

export interface CartItemWithProduct extends CartItem {
  product: CartItemProductSummary;
}

export interface CartWithItems {
  cart: Cart;
  items: CartItemWithProduct[];
  total: number;
}
