import { randomUUID } from 'crypto';
import { AppError } from '@shared/errors/app-error';
import type { IOrderItemRepository } from '@modules/order/order-item.repository.interface';
import type { IOrderRepository } from '@modules/order/order.repository.interface';
import type { IProductRepository } from '@modules/product/product.repository.interface';
import type { IReviewRepository } from './review.repository.interface';
import type { Review } from './review.entity';

export class ReviewService {
  constructor(
    private readonly reviewRepo: IReviewRepository,
    private readonly orderRepo: IOrderRepository,
    private readonly orderItemRepo: IOrderItemRepository,
    private readonly productRepo: IProductRepository,
  ) {}

  async create(
    buyerId: string,
    input: { product_id: string; order_id: string; rating: number; comment?: string | null },
  ): Promise<Review> {
    const order = await this.orderRepo.findById(input.order_id);
    if (!order) {
      throw new AppError(404, 'NOT_FOUND', 'Order not found');
    }
    if (order.buyer_id !== buyerId) {
      throw new AppError(403, 'FORBIDDEN', 'You can only review your own orders');
    }
    if (order.status !== 'DELIVERED') {
      throw new AppError(400, 'ORDER_NOT_DELIVERED', 'Order must be delivered before reviewing');
    }

    const items = await this.orderItemRepo.findByOrderId(input.order_id);
    const hasProduct = items.some((item) => item.product_id === input.product_id);
    if (!hasProduct) {
      throw new AppError(400, 'PRODUCT_NOT_IN_ORDER', 'Product is not part of this order');
    }

    const product = await this.productRepo.findById(input.product_id);
    if (!product) {
      throw new AppError(404, 'NOT_FOUND', 'Product not found');
    }

    const existing = await this.reviewRepo.findByBuyerAndProduct(buyerId, input.product_id);
    if (existing) {
      throw new AppError(409, 'REVIEW_EXISTS', 'You have already reviewed this product');
    }

    const review = await this.reviewRepo.create({
      id: randomUUID(),
      product_id: input.product_id,
      buyer_id: buyerId,
      order_id: input.order_id,
      rating: input.rating,
      comment: input.comment?.trim() ? input.comment.trim() : null,
    });

    await this.reviewRepo.recalculateProductRating(input.product_id);
    await this.reviewRepo.recalculateVendorRating(product.vendor_id);

    return review;
  }
}

export function serializeReview(review: Review) {
  return {
    id: review.id,
    product_id: review.product_id,
    buyer_id: review.buyer_id,
    order_id: review.order_id,
    rating: review.rating,
    comment: review.comment,
    created_at:
      review.created_at instanceof Date
        ? review.created_at.toISOString()
        : String(review.created_at),
  };
}
