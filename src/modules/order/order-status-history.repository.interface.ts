import type { PoolConnection } from 'mysql2/promise';
import type { OrderStatusHistory, CreateOrderStatusHistoryData } from './order-status-history.entity';

export interface IOrderStatusHistoryRepository {
  findByOrderId(orderId: string): Promise<OrderStatusHistory[]>;
  create(
    data: CreateOrderStatusHistoryData & { id: string },
    connection?: PoolConnection,
  ): Promise<OrderStatusHistory>;
}
