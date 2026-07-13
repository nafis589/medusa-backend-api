import type { ProductSnapshot } from './order.types';

/** Line item belonging to an order */
export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string | null;
  quantity: number;
  unit_price: number;
  /** Accepted-offer id when this line was purchased through a negotiated offer. */
  offer_id: string | null;
  /** Original product price when discounted via an offer (for struck-through display). */
  original_price: number | null;
  product_snapshot: ProductSnapshot;
}

export interface CreateOrderItemData {
  id?: string;
  order_id: string;
  product_id: string | null;
  quantity: number;
  unit_price: number;
  offer_id?: string | null;
  original_price?: number | null;
  product_snapshot: ProductSnapshot;
}
