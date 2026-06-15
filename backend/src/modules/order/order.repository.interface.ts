import type { PoolConnection } from 'mysql2/promise';
import type { Order, CreateOrderData } from './order.entity';
import type { OrderListFilters, OrderStatus, OrderVendorSummary } from './order.types';

export interface IOrderRepository {
  findById(id: string): Promise<Order | null>;
  create(data: CreateOrderData & { id: string }, connection?: PoolConnection): Promise<Order>;
  list(filters: OrderListFilters): Promise<{ orders: Order[]; total: number }>;
  updateStatus(
    id: string,
    status: OrderStatus,
    connection?: PoolConnection,
  ): Promise<Order>;
  findVendorSummary(vendorId: string): Promise<OrderVendorSummary | null>;
}
