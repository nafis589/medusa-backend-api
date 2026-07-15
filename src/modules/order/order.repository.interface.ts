import type { PoolConnection } from 'mysql2/promise';
import type { Order, CreateOrderData } from './order.entity';
import type { OrderListFilters, OrderStatus, OrderVendorSummary, AdminOrderListRow } from './order.types';

export interface IOrderRepository {
  findById(id: string): Promise<Order | null>;
  create(data: CreateOrderData & { id: string }, connection?: PoolConnection): Promise<Order>;
  list(filters: OrderListFilters): Promise<{ orders: Order[]; total: number }>;
  listForAdmin(filters: OrderListFilters): Promise<{ orders: AdminOrderListRow[]; total: number }>;
  updateStatus(
    id: string,
    status: OrderStatus,
    connection?: PoolConnection,
  ): Promise<Order>;
  findVendorSummary(vendorId: string): Promise<OrderVendorSummary | null>;
  findAdminVendorSummary(vendorId: string): Promise<{ id: string; shop_name: string; email: string; user_id: string } | null>;
  findAdminBuyerSummary(buyerId: string): Promise<{ id: string; first_name: string; last_name: string; email: string; phone: string | null } | null>;
}
