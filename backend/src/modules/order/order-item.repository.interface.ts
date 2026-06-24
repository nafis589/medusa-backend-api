import type { PoolConnection } from 'mysql2/promise';
import type { OrderItem, CreateOrderItemData } from './order-item.entity';

export interface IOrderItemRepository {
  findByOrderId(orderId: string): Promise<OrderItem[]>;
  create(
    data: CreateOrderItemData & { id: string },
    connection?: PoolConnection,
  ): Promise<OrderItem>;
}
