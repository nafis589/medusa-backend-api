/** Shopping cart — user or guest session */
export interface Cart {
  id: string;
  user_id: string | null;
  session_id: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface CreateCartData {
  user_id?: string | null;
  session_id?: string | null;
}
