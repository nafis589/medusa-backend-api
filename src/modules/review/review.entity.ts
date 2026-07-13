export interface Review {
  id: string;
  product_id: string;
  buyer_id: string;
  order_id: string;
  rating: number;
  comment: string | null;
  created_at: Date;
}

export interface CreateReviewData {
  id: string;
  product_id: string;
  buyer_id: string;
  order_id: string;
  rating: number;
  comment: string | null;
}
