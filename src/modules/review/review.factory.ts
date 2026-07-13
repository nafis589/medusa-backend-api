import { OrderRepository } from '@modules/order/order.repository';
import { OrderItemRepository } from '@modules/order/order-item.repository';
import { ProductRepository } from '@modules/product/product.repository';
import { ReviewRepository } from './review.repository';
import { ReviewService } from './review.service';

export function createReviewService(): ReviewService {
  return new ReviewService(
    new ReviewRepository(),
    new OrderRepository(),
    new OrderItemRepository(),
    new ProductRepository(),
  );
}
