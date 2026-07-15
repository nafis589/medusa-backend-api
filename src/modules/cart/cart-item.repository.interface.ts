import type { PoolConnection } from 'mysql2/promise';
import type { CartItem, CreateCartItemData } from './cart-item.entity';
import type { CartItemWithProduct } from './cart.types';

export interface ICartItemRepository {
  findById(id: string): Promise<CartItem | null>;
  findByCartId(cartId: string): Promise<CartItemWithProduct[]>;
  findByCartAndProduct(cartId: string, productId: string): Promise<CartItem | null>;
  create(data: CreateCartItemData & { id: string }): Promise<CartItem>;
  upsertOfferItem(data: {
    id: string;
    cart_id: string;
    product_id: string;
    price_snapshot: number;
    offer_id: string;
  }): Promise<CartItem>;
  updateQuantity(id: string, quantity: number): Promise<CartItem>;
  delete(id: string): Promise<void>;
  deleteByIds(ids: string[], connection?: PoolConnection): Promise<void>;
  deleteByCartId(cartId: string, connection?: PoolConnection): Promise<void>;
}
