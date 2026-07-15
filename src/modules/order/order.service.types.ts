import type { Order } from './order.entity';
import type { OrderItem } from './order-item.entity';
import type { OrderStatusHistory } from './order-status-history.entity';
import type {
  AdminOrderBuyerSummary,
  AdminOrderItemWithStatus,
  AdminOrderStatusHistoryEntry,
  AdminOrderVendorSummary,
  OrderVendorSummary,
} from './order.types';

export interface OrderDetail {
  order: Order;
  items: OrderItem[];
  status_history: OrderStatusHistory[];
  vendor: OrderVendorSummary;
}

export interface AdminOrderDetail {
  order: Order;
  items: AdminOrderItemWithStatus[];
  status_history: AdminOrderStatusHistoryEntry[];
  vendor: AdminOrderVendorSummary;
  buyer: AdminOrderBuyerSummary;
}

export interface OrderListResult {
  orders: Order[];
  total: number;
  page: number;
  limit: number;
}
