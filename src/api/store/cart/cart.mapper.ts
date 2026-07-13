import type { CartWithItems } from '@modules/cart/cart.types';

export function mapCartResponse(cart: CartWithItems) {
  const itemCount = cart.items.reduce((sum, item) => sum + item.quantity, 0);

  return {
    id: cart.cart.id,
    items: cart.items.map((item) => ({
      id: item.id,
      product_id: item.product_id,
      quantity: item.quantity,
      price_snapshot: item.price_snapshot,
      offer_id: item.offer_id,
      product: item.product,
    })),
    total: cart.total,
    itemCount,
  };
}
