import { randomUUID } from 'crypto';
import { AppError } from '@shared/errors/app-error';
import type { IProductRepository } from '@modules/product/product.repository.interface';
import type { ICartRepository } from './cart.repository.interface';
import type { ICartItemRepository } from './cart-item.repository.interface';
import type { Cart } from './cart.entity';
import type { CartItem } from './cart-item.entity';
import type { CartWithItems } from './cart.types';

export class CartService {
  constructor(
    private readonly cartRepo: ICartRepository,
    private readonly cartItemRepo: ICartItemRepository,
    private readonly productRepo: IProductRepository,
  ) {}

  async getOrCreate(userId?: string, sessionId?: string): Promise<Cart> {
    if (!userId && !sessionId) {
      throw new AppError(400, 'CART_IDENTIFIER_REQUIRED', 'userId or sessionId is required');
    }

    if (userId) {
      const existing = await this.cartRepo.findByUserId(userId);
      if (existing) return existing;
      return this.cartRepo.create({ id: randomUUID(), user_id: userId, session_id: null });
    }

    const existing = await this.cartRepo.findBySessionId(sessionId!);
    if (existing) return existing;
    return this.cartRepo.create({ id: randomUUID(), user_id: null, session_id: sessionId! });
  }

  async getCart(userId?: string, sessionId?: string): Promise<CartWithItems> {
    const cart = await this.getOrCreate(userId, sessionId);
    return this.buildCartWithItems(cart);
  }

  async addItem(
    cartId: string,
    productId: string,
    quantity: number,
    buyerVendorId?: string,
  ): Promise<CartItem> {
    if (quantity < 1) {
      throw AppError.badRequest('Quantity must be at least 1');
    }

    const product = await this.productRepo.findActiveById(productId);
    if (!product) {
      throw new AppError(400, 'PRODUCT_NOT_AVAILABLE', 'Product is not available');
    }

    if (buyerVendorId && product.vendor_id === buyerVendorId) {
      throw new AppError(
        403,
        'CANNOT_BUY_OWN_PRODUCT',
        'Vous ne pouvez pas acheter vos propres articles.',
      );
    }

    if (product.stock <= 0) {
      throw new AppError(400, 'OUT_OF_STOCK', 'Product is out of stock');
    }

    const existing = await this.cartItemRepo.findByCartAndProduct(cartId, productId);
    if (existing) {
      return this.cartItemRepo.updateQuantity(existing.id, existing.quantity + quantity);
    }

    return this.cartItemRepo.create({
      id: randomUUID(),
      cart_id: cartId,
      product_id: productId,
      quantity,
      price_snapshot: product.price,
    });
  }

  async updateItem(cartId: string, itemId: string, quantity: number): Promise<CartItem | null> {
    const item = await this.cartItemRepo.findById(itemId);
    if (!item || item.cart_id !== cartId) {
      throw AppError.forbidden('Cart item not found in this cart');
    }

    if (quantity === 0) {
      await this.cartItemRepo.delete(itemId);
      return null;
    }

    if (quantity < 0) {
      throw AppError.badRequest('Quantity cannot be negative');
    }

    return this.cartItemRepo.updateQuantity(itemId, quantity);
  }

  async removeItem(cartId: string, itemId: string): Promise<void> {
    const item = await this.cartItemRepo.findById(itemId);
    if (!item || item.cart_id !== cartId) {
      throw AppError.forbidden('Cart item not found in this cart');
    }
    await this.cartItemRepo.delete(itemId);
  }

  async clearCart(cartId: string): Promise<void> {
    await this.cartItemRepo.deleteByCartId(cartId);
  }

  async mergeGuestCart(sessionId: string, userId: string): Promise<void> {
    const sessionCart = await this.cartRepo.findBySessionId(sessionId);
    if (!sessionCart) return;

    const userCart = await this.getOrCreate(userId);
    const sessionItems = await this.cartItemRepo.findByCartId(sessionCart.id);

    for (const item of sessionItems) {
      await this.addItem(userCart.id, item.product_id, item.quantity);
    }

    await this.cartRepo.delete(sessionCart.id);
  }

  private async buildCartWithItems(cart: Cart): Promise<CartWithItems> {
    const items = await this.cartItemRepo.findByCartId(cart.id);
    const total = items.reduce((sum, item) => sum + item.price_snapshot * item.quantity, 0);
    return { cart, items, total };
  }
}
