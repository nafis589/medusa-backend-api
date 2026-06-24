import type { Cart, CreateCartData } from './cart.entity';

export interface ICartRepository {
  findById(id: string): Promise<Cart | null>;
  findByUserId(userId: string): Promise<Cart | null>;
  findBySessionId(sessionId: string): Promise<Cart | null>;
  create(data: CreateCartData & { id: string }): Promise<Cart>;
  delete(id: string): Promise<void>;
}
