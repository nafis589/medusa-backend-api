import type { CreateReviewData, Review } from './review.entity';

export interface IReviewRepository {
  findByBuyerAndProduct(buyerId: string, productId: string): Promise<Review | null>;
  create(data: CreateReviewData): Promise<Review>;
  recalculateProductRating(productId: string): Promise<void>;
  recalculateVendorRating(vendorId: string): Promise<void>;
}
