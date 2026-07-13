/** Line item in a cart with price frozen at add time */
export interface CartItem {
  id: string;
  cart_id: string;
  product_id: string;
  quantity: number;
  price_snapshot: number;
  /** Set when this line comes from an accepted offer (discounted price). */
  offer_id: string | null;
}

export interface CreateCartItemData {
  cart_id: string;
  product_id: string;
  quantity: number;
  price_snapshot: number;
  offer_id?: string | null;
}
