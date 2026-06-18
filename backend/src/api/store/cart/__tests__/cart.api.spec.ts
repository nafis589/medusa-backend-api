/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment */
import dotenv from 'dotenv';
dotenv.config({ override: true });
process.env.NODE_ENV = 'test';

import request from 'supertest';
import app from '@/index';
import { closePool, clearDatabase, getPool, initializeDatabase } from '@shared/utils/db';
import { hashPassword } from '@shared/utils/hash';
import { signToken } from '@shared/utils/jwt.util';

const PRODUCT_ID = 'c0000000-0000-4000-8000-000000000001';
const VENDOR_ID = 'b0000000-0000-4000-8000-000000000001';
const USER_ID = 'a0000000-0000-4000-8000-000000000001';

async function seedActiveProduct(): Promise<void> {
  const db = getPool();
  const hashed = await hashPassword('password123');

  await db.query(
    `INSERT INTO users (id, email, password_hash, first_name, last_name, role)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [USER_ID, 'buyer@example.com', hashed, 'Buyer', 'Test', 'BUYER'],
  );

  await db.query(
    `INSERT INTO vendors (id, user_id, shop_name, status)
     VALUES (?, ?, ?, ?)`,
    [VENDOR_ID, USER_ID, 'Test Shop', 'ACTIVE'],
  );

  await db.query(
    `INSERT INTO products (
      id, vendor_id, title, description, price, status, stock, views_count
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [PRODUCT_ID, VENDOR_ID, 'Test Product', 'Description', 15000, 'ACTIVE', 5, 0],
  );
}

describe('Cart API Integration Tests', () => {
  jest.setTimeout(60_000);

  beforeAll(async () => {
    await initializeDatabase();
  });

  beforeEach(async () => {
    await clearDatabase();
    await seedActiveProduct();
  });

  afterAll(async () => {
    await clearDatabase();
    await closePool();
  });

  it('GET /api/store/cart returns empty cart and sets session_id cookie', async () => {
    const agent = request.agent(app);
    const res = await agent.get('/api/store/cart');

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBeDefined();
    expect(res.body.data.items).toEqual([]);
    expect(res.body.data.total).toBe(0);
    expect(res.body.data.itemCount).toBe(0);
    expect(res.headers['set-cookie']?.[0]).toMatch(/session_id=/);
  });

  it('GET /api/store/cart falls back to guest cart when JWT user no longer exists', async () => {
    const staleToken = signToken({
      id: 'df3d0f49-1009-401c-b7c2-df860d618a61',
      email: 'deleted@example.com',
      role: 'BUYER',
    });

    const res = await request(app)
      .get('/api/store/cart')
      .set('Authorization', `Bearer ${staleToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.items).toEqual([]);
    expect(res.body.data.total).toBe(0);
  });

  it('POST /api/store/cart/items adds a product and returns updated cart', async () => {
    const agent = request.agent(app);

    const res = await agent
      .post('/api/store/cart/items')
      .send({ product_id: PRODUCT_ID, quantity: 2 });

    expect(res.status).toBe(201);
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.items[0].product_id).toBe(PRODUCT_ID);
    expect(res.body.data.items[0].quantity).toBe(2);
    expect(res.body.data.total).toBe(30000);
    expect(res.body.data.itemCount).toBe(2);
  });

  it('PATCH /api/store/cart/items/:id updates quantity', async () => {
    const agent = request.agent(app);

    const created = await agent
      .post('/api/store/cart/items')
      .send({ product_id: PRODUCT_ID, quantity: 1 });

    const itemId = created.body.data.items[0].id as string;

    const res = await agent.patch(`/api/store/cart/items/${itemId}`).send({ quantity: 3 });

    expect(res.status).toBe(200);
    expect(res.body.data.items[0].quantity).toBe(3);
    expect(res.body.data.total).toBe(45000);
  });

  it('PATCH with quantity 0 removes the item', async () => {
    const agent = request.agent(app);

    const created = await agent
      .post('/api/store/cart/items')
      .send({ product_id: PRODUCT_ID, quantity: 1 });

    const itemId = created.body.data.items[0].id as string;
    const res = await agent.patch(`/api/store/cart/items/${itemId}`).send({ quantity: 0 });

    expect(res.status).toBe(200);
    expect(res.body.data.items).toEqual([]);
    expect(res.body.data.itemCount).toBe(0);
  });

  it('DELETE /api/store/cart/items/:id removes one item', async () => {
    const agent = request.agent(app);

    const created = await agent
      .post('/api/store/cart/items')
      .send({ product_id: PRODUCT_ID, quantity: 1 });

    const itemId = created.body.data.items[0].id as string;
    const res = await agent.delete(`/api/store/cart/items/${itemId}`);

    expect(res.status).toBe(200);
    expect(res.body.data.items).toEqual([]);
  });

  it('DELETE /api/store/cart clears all items', async () => {
    const agent = request.agent(app);

    await agent.post('/api/store/cart/items').send({ product_id: PRODUCT_ID, quantity: 1 });
    const res = await agent.delete('/api/store/cart');

    expect(res.status).toBe(200);
    expect(res.body.data.items).toEqual([]);
    expect(res.body.data.total).toBe(0);
  });

  it('returns 400 PRODUCT_NOT_AVAILABLE for inactive product', async () => {
    const db = getPool();
    await db.query("UPDATE products SET status = 'DRAFT' WHERE id = ?", [PRODUCT_ID]);

    const agent = request.agent(app);
    const res = await agent
      .post('/api/store/cart/items')
      .send({ product_id: PRODUCT_ID, quantity: 1 });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('PRODUCT_NOT_AVAILABLE');
  });
});
