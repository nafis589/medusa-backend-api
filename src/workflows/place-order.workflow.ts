import { randomUUID } from 'crypto';
import { getPool } from '@shared/utils/db';
import { AppError } from '@shared/errors/app-error';
import { eventBus } from '@shared/utils/event-bus';
import type { CartService } from '@modules/cart/cart.service';
import type { ICartItemRepository } from '@modules/cart/cart-item.repository.interface';
import type { IProductRepository } from '@modules/product/product.repository.interface';
import type { IOrderRepository } from '@modules/order/order.repository.interface';
import type { IOrderItemRepository } from '@modules/order/order-item.repository.interface';
import type { IOrderStatusHistoryRepository } from '@modules/order/order-status-history.repository.interface';
import type { IOfferRepository } from '@modules/offer/offer.repository.interface';
import type { Order } from '@modules/order/order.entity';
import type { Product } from '@modules/product/product.entity';
import type { CartItemWithProduct } from '@modules/cart/cart.types';
import type {
  PaymentMethod,
  ShippingAddress,
  ShippingMethod,
} from '@modules/order/order.types';

export interface PlaceOrderInput {
  buyerId: string;
  buyerVendorId?: string;
  shippingAddress: ShippingAddress;
  shippingFee: number;
  shippingMethod: ShippingMethod;
  shippingDistanceKm?: number | null;
  paymentMethod: PaymentMethod;
}

export interface PlaceOrderResult {
  orders: Order[];
}

interface VendorCartGroup {
  vendorId: string;
  items: CartItemWithProduct[];
  products: Map<string, Product>;
}

function allocateShippingFee(vendorIndex: number, vendorCount: number, totalFee: number): number {
  if (vendorCount <= 1) return totalFee;
  const base = Math.floor(totalFee / vendorCount);
  const remainder = totalFee % vendorCount;
  return base + (vendorIndex === 0 ? remainder : 0);
}

export class PlaceOrderWorkflow {
  constructor(
    private readonly cartService: CartService,
    private readonly productRepo: IProductRepository,
    private readonly orderRepo: IOrderRepository,
    private readonly orderItemRepo: IOrderItemRepository,
    private readonly orderStatusHistoryRepo: IOrderStatusHistoryRepository,
    private readonly cartItemRepo: ICartItemRepository,
    private readonly offerRepo?: IOfferRepository,
  ) {}

  async execute(input: PlaceOrderInput): Promise<PlaceOrderResult> {
    const cart = await this.cartService.getCart(input.buyerId);

    if (cart.items.length === 0) {
      throw new AppError(400, 'CART_EMPTY', 'Cart is empty');
    }

    const productById = new Map<string, Product>();

    for (const item of cart.items) {
      const product = await this.productRepo.findById(item.product_id);
      if (!product || product.status !== 'ACTIVE') {
        throw new AppError(400, 'PRODUCT_NOT_AVAILABLE', 'Product is not available');
      }
      if (input.buyerVendorId && product.vendor_id === input.buyerVendorId) {
        throw new AppError(
          403,
          'CANNOT_BUY_OWN_PRODUCT',
          'Votre panier contient un de vos propres articles.',
        );
      }
      if (product.stock < item.quantity) {
        throw new AppError(400, 'INSUFFICIENT_STOCK', 'Insufficient stock for this product');
      }

      if (item.offer_id) {
        if (!this.offerRepo) {
          throw new AppError(500, 'OFFER_REPO_UNAVAILABLE', 'Offer support is not configured');
        }
        const offer = await this.offerRepo.findById(item.offer_id);
        if (
          !offer ||
          offer.buyer_id !== input.buyerId ||
          offer.product_id !== item.product_id ||
          offer.status !== 'ACCEPTED'
        ) {
          throw new AppError(400, 'OFFER_INVALID', 'Cette offre n\'est plus valable.');
        }
        if (offer.consumed_at) {
          throw new AppError(400, 'OFFER_ALREADY_USED', 'Cette offre a déjà été commandée.');
        }
      }

      productById.set(item.product_id, product);
    }

    if (
      input.shippingFee === undefined ||
      input.shippingFee === null ||
      !Number.isFinite(input.shippingFee) ||
      input.shippingFee <= 0
    ) {
      throw new AppError(400, 'SHIPPING_NOT_CALCULATED', 'Shipping fee must be calculated');
    }

    const vendorGroups = this.groupItemsByVendor(cart.items, productById);
    const pool = getPool();
    const connection = await pool.getConnection();
    const createdOrders: Order[] = [];

    try {
      await connection.beginTransaction();

      for (const item of cart.items) {
        const locked = await this.productRepo.findByIdForUpdate(item.product_id, connection);
        if (!locked || locked.status !== 'ACTIVE') {
          throw new AppError(400, 'PRODUCT_NOT_AVAILABLE', 'Product is not available');
        }
        if (locked.stock < item.quantity) {
          throw new AppError(400, 'INSUFFICIENT_STOCK', 'Insufficient stock for this product');
        }
        await this.productRepo.decrementStock(item.product_id, item.quantity, connection);
      }

      const vendorIds = Array.from(vendorGroups.keys());

      for (let index = 0; index < vendorIds.length; index++) {
        const vendorId = vendorIds[index]!;
        const group = vendorGroups.get(vendorId)!;
        const itemsSubtotal = group.items.reduce(
          (sum, item) => sum + item.price_snapshot * item.quantity,
          0,
        );
        const shippingFee = allocateShippingFee(index, vendorIds.length, input.shippingFee);
        const orderId = randomUUID();

        const order = await this.orderRepo.create(
          {
            id: orderId,
            buyer_id: input.buyerId,
            vendor_id: vendorId,
            status: 'PENDING',
            total_amount: itemsSubtotal + shippingFee,
            shipping_fee: shippingFee,
            payment_method: input.paymentMethod,
            shipping_address: input.shippingAddress,
            shipping_region_id: input.shippingAddress.region_id,
            shipping_method: input.shippingMethod,
            shipping_distance_km: input.shippingDistanceKm ?? null,
          },
          connection,
        );

        for (const item of group.items) {
          const product = group.products.get(item.product_id)!;
          await this.orderItemRepo.create(
            {
              id: randomUUID(),
              order_id: orderId,
              product_id: item.product_id,
              quantity: item.quantity,
              unit_price: item.price_snapshot,
              offer_id: item.offer_id,
              original_price: item.offer_id ? product.price : null,
              product_snapshot: {
                title: item.product.title,
                image: item.product.primary_image,
                brand: product.brand,
              },
            },
            connection,
          );

          if (item.offer_id && this.offerRepo) {
            await this.offerRepo.markConsumed(item.offer_id, connection);
          }
        }

        await this.orderStatusHistoryRepo.create(
          {
            id: randomUUID(),
            order_id: orderId,
            status: 'PENDING',
            note: null,
            created_by: input.buyerId,
          },
          connection,
        );

        createdOrders.push(order);
      }

      await this.cartItemRepo.deleteByCartId(cart.cart.id, connection);

      await connection.commit();
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }

    for (const order of createdOrders) {
      eventBus.emitOrderPlaced({ order });
    }

    return { orders: createdOrders };
  }

  private groupItemsByVendor(
    items: CartItemWithProduct[],
    productById: Map<string, Product>,
  ): Map<string, VendorCartGroup> {
    const groups = new Map<string, VendorCartGroup>();

    for (const item of items) {
      const product = productById.get(item.product_id)!;
      const existing = groups.get(product.vendor_id);
      if (existing) {
        existing.items.push(item);
        existing.products.set(item.product_id, product);
      } else {
        groups.set(product.vendor_id, {
          vendorId: product.vendor_id,
          items: [item],
          products: new Map([[item.product_id, product]]),
        });
      }
    }

    return groups;
  }
}
