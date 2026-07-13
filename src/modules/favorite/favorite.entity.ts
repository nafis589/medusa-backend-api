export interface Favorite {
  id: string;
  user_id: string;
  product_id: string;
  created_at: Date;
}

export interface CreateFavoriteData {
  id: string;
  user_id: string;
  product_id: string;
}

export interface FavoriteProductRow {
  id: string;
  title: string;
  price: number;
  brand: string | null;
  size: string | null;
  condition: string | null;
  status: string;
  primary_image: string | null;
  shop_name: string | null;
  vendor_region_id: string | null;
  favorited_at: Date;
}
