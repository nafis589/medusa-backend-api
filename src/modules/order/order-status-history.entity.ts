import type { OrderStatus } from './order.types';

/** Audit trail entry for an order status change */
export interface OrderStatusHistory {
  id: string;
  order_id: string;
  status: OrderStatus;
  note: string | null;
  created_by: string;
  created_at: Date;
}

export interface CreateOrderStatusHistoryData {
  id?: string;
  order_id: string;
  status: OrderStatus;
  note?: string | null;
  created_by: string;
}
