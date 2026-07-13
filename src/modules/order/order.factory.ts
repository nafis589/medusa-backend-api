import { CartService } from '@modules/cart/cart.service';
import { CartRepository } from '@modules/cart/cart.repository';
import { CartItemRepository } from '@modules/cart/cart-item.repository';
import { ProductRepository } from '@modules/product/product.repository';
import { OfferRepository } from '@modules/offer/offer.repository';
import { OrderRepository } from './order.repository';
import { OrderItemRepository } from './order-item.repository';
import { OrderStatusHistoryRepository } from './order-status-history.repository';
import { PlaceOrderWorkflow } from '@workflows/place-order.workflow';
import { OrderService } from './order.service';

export function createPlaceOrderWorkflow(): PlaceOrderWorkflow {
  const productRepo = new ProductRepository();
  const offerRepo = new OfferRepository();
  const cartService = new CartService(
    new CartRepository(),
    new CartItemRepository(),
    productRepo,
    offerRepo,
  );

  return new PlaceOrderWorkflow(
    cartService,
    productRepo,
    new OrderRepository(),
    new OrderItemRepository(),
    new OrderStatusHistoryRepository(),
    new CartItemRepository(),
    offerRepo,
  );
}

export function createOrderService(): OrderService {
  const productRepo = new ProductRepository();
  return new OrderService(
    createPlaceOrderWorkflow(),
    new OrderRepository(),
    new OrderItemRepository(),
    new OrderStatusHistoryRepository(),
    productRepo,
  );
}
