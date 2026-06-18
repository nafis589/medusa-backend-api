/* eslint-disable @typescript-eslint/unbound-method */
import { CartService } from '../cart.service';
import type { ICartRepository } from '../cart.repository.interface';
import type { ICartItemRepository } from '../cart-item.repository.interface';
import type { IProductRepository } from '@modules/product/product.repository.interface';
import type { Cart } from '../cart.entity';
import type { CartItem } from '../cart-item.entity';
import type { Product } from '@modules/product/product.entity';
import type { CartItemWithProduct } from '../cart.types';

function makeCart(overrides: Partial<Cart> = {}): Cart {
  return {
    id: 'cart-1',
    user_id: 'user-1',
    session_id: null,
    created_at: new Date('2026-01-01'),
    updated_at: new Date('2026-01-01'),
    ...overrides,
  };
}

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: 'prod-1',
    vendor_id: 'vendor-1',
    title: 'Robe wax',
    description: 'Belle robe',
    price: 15000,
    category_id: 'cat-1',
    brand: 'Local',
    condition: 'VERY_GOOD',
    material: 'Coton',
    color: 'Rouge',
    size: 'M',
    status: 'ACTIVE',
    stock: 1,
    views_count: 10,
    created_at: new Date('2026-01-01'),
    updated_at: new Date('2026-01-01'),
    ...overrides,
  };
}

function makeCartItem(overrides: Partial<CartItem> = {}): CartItem {
  return {
    id: 'item-1',
    cart_id: 'cart-1',
    product_id: 'prod-1',
    quantity: 1,
    price_snapshot: 15000,
    ...overrides,
  };
}

function makeCartItemWithProduct(overrides: Partial<CartItemWithProduct> = {}): CartItemWithProduct {
  return {
    ...makeCartItem(),
    product: {
      title: 'Robe wax',
      primary_image: null,
      price: 15000,
      status: 'ACTIVE',
      vendor: {
        id: 'vendor-1',
        shop_name: 'Boutique Test',
        total_sales: 12,
        active_products: 8,
        region: 'Maritime',
      },
    },
    ...overrides,
  };
}

function buildCartRepo(overrides: Partial<ICartRepository> = {}): ICartRepository {
  return {
    findById: jest.fn().mockResolvedValue(null),
    findByUserId: jest.fn().mockResolvedValue(null),
    findBySessionId: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockImplementation((data: { id: string; user_id?: string | null; session_id?: string | null }) =>
      Promise.resolve(
        makeCart({
          id: data.id,
          user_id: data.user_id ?? null,
          session_id: data.session_id ?? null,
        }),
      ),
    ),
    delete: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function buildCartItemRepo(overrides: Partial<ICartItemRepository> = {}): ICartItemRepository {
  return {
    findById: jest.fn().mockResolvedValue(null),
    findByCartId: jest.fn().mockResolvedValue([]),
    findByCartAndProduct: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockImplementation((data: CartItem) => Promise.resolve(makeCartItem(data))),
    updateQuantity: jest.fn().mockImplementation((id: string, quantity: number) =>
      Promise.resolve(makeCartItem({ id, quantity })),
    ),
    delete: jest.fn().mockResolvedValue(undefined),
    deleteByCartId: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function buildProductRepo(overrides: Partial<IProductRepository> = {}): IProductRepository {
  return {
    findById: jest.fn().mockResolvedValue(null),
    findActiveById: jest.fn().mockResolvedValue(makeProduct()),
    findDetailById: jest.fn().mockResolvedValue(null),
    list: jest.fn().mockResolvedValue({ products: [], total: 0 }),
    create: jest.fn(),
    update: jest.fn(),
    updateStatus: jest.fn(),
    incrementViews: jest.fn(),
    search: jest.fn().mockResolvedValue({ products: [], total: 0 }),
    findTrending: jest.fn().mockResolvedValue([]),
    findVendorContactByProductId: jest.fn().mockResolvedValue(null),
    findByIdForUpdate: jest.fn().mockResolvedValue(null),
    decrementStock: jest.fn().mockResolvedValue(undefined),
    incrementStock: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function buildService(
  cartRepo: Partial<ICartRepository> = {},
  cartItemRepo: Partial<ICartItemRepository> = {},
  productRepo: Partial<IProductRepository> = {},
): CartService {
  return new CartService(buildCartRepo(cartRepo), buildCartItemRepo(cartItemRepo), buildProductRepo(productRepo));
}

describe('CartService', () => {
  describe('getOrCreate', () => {
    it('creates a user cart when none exists', async () => {
      const create = jest.fn().mockResolvedValue(makeCart({ user_id: 'user-1' }));
      const svc = buildService({ findByUserId: jest.fn().mockResolvedValue(null), create });

      const cart = await svc.getOrCreate('user-1');

      expect(cart.user_id).toBe('user-1');
      expect(create).toHaveBeenCalled();
    });

    it('creates a session cart when none exists', async () => {
      const create = jest.fn().mockResolvedValue(makeCart({ session_id: 'sess-1', user_id: null }));
      const svc = buildService({ findBySessionId: jest.fn().mockResolvedValue(null), create });

      const cart = await svc.getOrCreate(undefined, 'sess-1');

      expect(cart.session_id).toBe('sess-1');
      expect(create).toHaveBeenCalled();
    });
  });

  describe('getCart', () => {
    it('returns items and total', async () => {
      const svc = buildService(
        { findByUserId: jest.fn().mockResolvedValue(makeCart()) },
        {
          findByCartId: jest.fn().mockResolvedValue([
            makeCartItemWithProduct({ quantity: 2, price_snapshot: 10000 }),
          ]),
        },
      );

      const result = await svc.getCart('user-1');

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(20000);
    });
  });

  describe('addItem', () => {
    it('throws PRODUCT_NOT_AVAILABLE when product is not active', async () => {
      const svc = buildService({}, {}, { findActiveById: jest.fn().mockResolvedValue(null) });

      await expect(svc.addItem('cart-1', 'prod-1', 1)).rejects.toMatchObject({
        code: 'PRODUCT_NOT_AVAILABLE',
      });
    });

    it('throws OUT_OF_STOCK when stock is zero', async () => {
      const svc = buildService(
        {},
        {},
        { findActiveById: jest.fn().mockResolvedValue(makeProduct({ stock: 0 })) },
      );

      await expect(svc.addItem('cart-1', 'prod-1', 1)).rejects.toMatchObject({
        code: 'OUT_OF_STOCK',
      });
    });

    it('increments quantity when item already exists', async () => {
      const updateQuantity = jest.fn().mockResolvedValue(makeCartItem({ quantity: 3 }));
      const svc = buildService(
        {},
        {
          findByCartAndProduct: jest.fn().mockResolvedValue(makeCartItem({ quantity: 2 })),
          updateQuantity,
        },
      );

      const item = await svc.addItem('cart-1', 'prod-1', 1);

      expect(updateQuantity).toHaveBeenCalledWith('item-1', 3);
      expect(item.quantity).toBe(3);
    });

    it('creates item with current price snapshot', async () => {
      const create = jest.fn().mockResolvedValue(makeCartItem({ price_snapshot: 15000 }));
      const svc = buildService({}, { create });

      await svc.addItem('cart-1', 'prod-1', 1);

      expect(create).toHaveBeenCalledWith(
        expect.objectContaining({
          cart_id: 'cart-1',
          product_id: 'prod-1',
          quantity: 1,
          price_snapshot: 15000,
        }),
      );
    });
  });

  describe('updateItem', () => {
    it('deletes item when quantity is zero', async () => {
      const deleteItem = jest.fn().mockResolvedValue(undefined);
      const svc = buildService(
        {},
        {
          findById: jest.fn().mockResolvedValue(makeCartItem()),
          delete: deleteItem,
        },
      );

      const result = await svc.updateItem('cart-1', 'item-1', 0);

      expect(deleteItem).toHaveBeenCalledWith('item-1');
      expect(result).toBeNull();
    });

    it('throws when item does not belong to cart', async () => {
      const svc = buildService(
        {},
        { findById: jest.fn().mockResolvedValue(makeCartItem({ cart_id: 'other-cart' })) },
      );

      await expect(svc.updateItem('cart-1', 'item-1', 2)).rejects.toMatchObject({
        statusCode: 403,
      });
    });
  });

  describe('mergeGuestCart', () => {
    it('merges session items into user cart and deletes session cart', async () => {
      const sessionCart = makeCart({ id: 'sess-cart', session_id: 'sess-1', user_id: null });
      const userCart = makeCart({ id: 'user-cart', user_id: 'user-1' });
      const deleteCart = jest.fn().mockResolvedValue(undefined);
      const addItemSpy = jest.spyOn(CartService.prototype, 'addItem').mockResolvedValue(makeCartItem());

      const svc = buildService(
        {
          findBySessionId: jest.fn().mockResolvedValue(sessionCart),
          findByUserId: jest.fn().mockResolvedValue(userCart),
          delete: deleteCart,
        },
        {
          findByCartId: jest.fn().mockResolvedValue([
            makeCartItemWithProduct({ product_id: 'prod-1', quantity: 2 }),
          ]),
        },
      );

      await svc.mergeGuestCart('sess-1', 'user-1');

      expect(addItemSpy).toHaveBeenCalledWith('user-cart', 'prod-1', 2);
      expect(deleteCart).toHaveBeenCalledWith('sess-cart');

      addItemSpy.mockRestore();
    });
  });
});
