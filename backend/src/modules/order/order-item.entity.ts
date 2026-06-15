import type { ProductSnapshot } from './order.types';

/** Line item belonging to an order */
export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string | null;
  quantity: number;
  unit_price: number;
  product_snapshot: ProductSnapshot;
}

export interface CreateOrderItemData {
  id?: string;
  order_id: string;
  product_id: string | null;
  quantity: number;
  unit_price: number;
  product_snapshot: ProductSnapshot;
}
