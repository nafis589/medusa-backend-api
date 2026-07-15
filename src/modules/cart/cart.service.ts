import { randomUUID } from 'crypto';
import { AppError } from '@shared/errors/app-error';
import type { IProductRepository } from '@modules/product/product.repository.interface';
import type { IOfferRepository } from '@modules/offer/offer.repository.interface';
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
    private readonly offerRepo?: IOfferRepository,
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

  async getCartById(cartId: string): Promise<CartWithItems | null> {
    const cart = await this.cartRepo.findById(cartId);
    if (!cart) return null;
    return this.buildCartWithItems(cart);
  }

  assertCartAccess(cart: Cart, userId?: string, sessionId?: string): void {
    if (userId) {
      if (cart.user_id !== userId) {
        throw AppError.forbidden('Cart access denied');
      }
      return;
    }
    if (sessionId && cart.session_id === sessionId && !cart.user_id) {
      return;
    }
    throw AppError.forbidden('Cart access denied');
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

  /**
   * Adds the product tied to an accepted offer to the cart at the agreed price.
   * The offer must belong to the buyer, be ACCEPTED and not already consumed.
   */
  async addOfferItem(cartId: string, buyerId: string, offerId: string): Promise<CartItem> {
    if (!this.offerRepo) {
      throw new AppError(500, 'OFFER_REPO_UNAVAILABLE', 'Offer support is not configured');
    }

    const offer = await this.offerRepo.findById(offerId);
    if (!offer || offer.buyer_id !== buyerId) {
      throw new AppError(404, 'OFFER_NOT_FOUND', 'Offer not found');
    }
    if (offer.status !== 'ACCEPTED') {
      throw new AppError(400, 'OFFER_NOT_ACCEPTED', 'Cette offre n\'est pas acceptée.');
    }
    if (offer.consumed_at) {
      throw new AppError(400, 'OFFER_ALREADY_USED', 'Cette offre a déjà été commandée.');
    }

    const product = await this.productRepo.findActiveById(offer.product_id);
    if (!product) {
      throw new AppError(400, 'PRODUCT_NOT_AVAILABLE', 'Product is not available');
    }
    if (product.stock <= 0) {
      throw new AppError(400, 'OUT_OF_STOCK', 'Product is out of stock');
    }

    return this.cartItemRepo.upsertOfferItem({
      id: randomUUID(),
      cart_id: cartId,
      product_id: offer.product_id,
      price_snapshot: offer.amount,
      offer_id: offer.id,
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
