/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment */
import dotenv from 'dotenv';
dotenv.config({ override: true });
process.env.NODE_ENV = 'test';

import request from 'supertest';
import { randomUUID } from 'crypto';
import app from '@/index';
import { getRedis } from '@shared/utils/redis';
import { closePool, clearDatabase, getPool, initializeDatabase } from '@shared/utils/db';
import { hashPassword } from '@shared/utils/hash';
import { signToken } from '@shared/utils/jwt.util';

const PRODUCT_ID = 'c0000000-0000-4000-8000-000000000001';

describe('Shipping API Integration Tests', () => {
  let vendorId: string;
  let vendorToken: string;

  beforeAll(async () => {
    await initializeDatabase();
  });

  beforeEach(async () => {
    await clearDatabase();
    try {
      const redis = getRedis();
      const keys = await redis.keys('blacklist:*');
      if (keys.length > 0) await redis.del(...keys);
    } catch {
      // Redis may be unavailable in some test runs
    }

    const db = getPool();
    const userId = randomUUID();
    vendorId = randomUUID();
    const hashed = await hashPassword('password123');

    await db.query(
      'INSERT INTO users (id, email, password_hash, first_name, last_name, role) VALUES (?, ?, ?, ?, ?, ?)',
      [userId, 'vendor@shipping.test', hashed, 'Vendor', 'Test', 'VENDOR'],
    );

    await db.query(
      'INSERT INTO vendors (id, user_id, shop_name, shop_description, status) VALUES (?, ?, ?, ?, ?)',
      [vendorId, userId, 'Shop Test', 'Description', 'ACTIVE'],
    );

    await db.query(
      `INSERT INTO products (
        id, vendor_id, title, description, price, status, stock, views_count
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [PRODUCT_ID, vendorId, 'Test Product', 'Description', 15000, 'ACTIVE', 5, 0],
    );

    vendorToken = signToken({ id: userId, email: 'vendor@shipping.test', role: 'VENDOR' });
  });

  afterAll(async () => {
    await clearDatabase();
    const redis = getRedis();
    await redis.quit();
    await closePool();
  });

  async function createCartWithProduct() {
    const agent = request.agent(app);
    await agent.post('/api/store/cart/items').send({ product_id: PRODUCT_ID, quantity: 1 });
    return agent;
  }

  describe('POST /api/store/shipping/validate-location', () => {
    it('returns isInTogo true for Lomé', async () => {
      const res = await request(app)
        .post('/api/store/shipping/validate-location')
        .send({ lat: 6.14, lng: 1.21 });

      expect(res.status).toBe(200);
      expect(res.body.data.isInTogo).toBe(true);
      expect(res.body.data.region.id).toBe('maritime');
      expect(res.body.data.region.capital).toBe('Lomé');
    });

    it('returns isInTogo false for Paris', async () => {
      const res = await request(app)
        .post('/api/store/shipping/validate-location')
        .send({ lat: 48.85, lng: 2.35 });

      expect(res.status).toBe(200);
      expect(res.body.data.isInTogo).toBe(false);
      expect(res.body.data.region).toBeUndefined();
    });
  });

  describe('POST /api/store/shipping/calculate', () => {
    it('returns vendor error when vendor has no shipping config', async () => {
      const agent = await createCartWithProduct();
      const res = await agent.post('/api/store/shipping/calculate').send({
        client_lat: 6.14,
        client_lng: 1.21,
      });

      expect(res.status).toBe(200);
      expect(res.body.data.vendors).toHaveLength(1);
      expect(res.body.data.vendors[0].vendor_id).toBe(vendorId);
      expect(res.body.data.vendors[0].shipping.error.code).toBe('VENDOR_SHIPPING_NOT_SET');
      expect(res.body.data.vendors[0].shipping.fee).toBe(0);
      expect(res.body.data.summary.can_checkout).toBe(false);
      expect(res.body.data.summary.has_errors).toBe(true);
    });

    it('returns LOCATION_OUTSIDE_TOGO for client outside Togo', async () => {
      await request(app)
        .patch('/api/vendor/shipping')
        .set('Authorization', `Bearer ${vendorToken}`)
        .send({
          location: { lat: 6.1375, lng: 1.2123 },
          regions: [
            { region_id: 'maritime', is_home_region: true, price_per_km: 150, min_fee: 500 },
          ],
        });

      const agent = await createCartWithProduct();
      const res = await agent.post('/api/store/shipping/calculate').send({
        client_lat: 48.85,
        client_lng: 2.35,
      });

      expect(res.status).toBe(200);
      expect(res.body.data.vendors[0].shipping.error.code).toBe('LOCATION_OUTSIDE_TOGO');
      expect(res.body.data.summary.can_checkout).toBe(false);
    });

    it('returns PER_KM fee per vendor for same-region delivery', async () => {
      await request(app)
        .patch('/api/vendor/shipping')
        .set('Authorization', `Bearer ${vendorToken}`)
        .send({
          location: { lat: 6.1375, lng: 1.2123 },
          regions: [
            { region_id: 'maritime', is_home_region: true, price_per_km: 150, min_fee: 500 },
          ],
        });

      const agent = await createCartWithProduct();
      const res = await agent.post('/api/store/shipping/calculate').send({
        client_lat: 6.2,
        client_lng: 1.25,
      });

      expect(res.status).toBe(200);
      expect(res.body.data.vendors).toHaveLength(1);
      expect(res.body.data.vendors[0].shipping.method).toBe('PER_KM');
      expect(res.body.data.vendors[0].shipping.fee).toBeGreaterThanOrEqual(500);
      expect(res.body.data.vendors[0].shipping.error).toBeUndefined();
      expect(res.body.data.summary.shipping_total).toBeGreaterThanOrEqual(500);
      expect(res.body.data.summary.can_checkout).toBe(true);
      expect(res.body.data.summary.has_errors).toBe(false);
    });
  });

  describe('GET /api/vendor/shipping', () => {
    it('returns 401 without token', async () => {
      const res = await request(app).get('/api/vendor/shipping');
      expect(res.status).toBe(401);
    });

    it('returns empty config for vendor without shipping setup', async () => {
      const res = await request(app)
        .get('/api/vendor/shipping')
        .set('Authorization', `Bearer ${vendorToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.location).toBeNull();
      expect(res.body.data.regions).toEqual([]);
    });
  });

  describe('PATCH /api/vendor/shipping', () => {
    it('saves vendor shipping config', async () => {
      const res = await request(app)
        .patch('/api/vendor/shipping')
        .set('Authorization', `Bearer ${vendorToken}`)
        .send({
          location: { lat: 6.1375, lng: 1.2123, city: 'Lomé' },
          regions: [
            { region_id: 'maritime', is_home_region: true, price_per_km: 150, min_fee: 500 },
            { region_id: 'plateaux', is_home_region: false, fixed_price: 3000 },
          ],
        });

      expect(res.status).toBe(200);
      expect(res.body.data.location.region_id).toBe('maritime');
      expect(res.body.data.regions).toHaveLength(2);
    });

    it('returns 400 for location outside Togo', async () => {
      const res = await request(app)
        .patch('/api/vendor/shipping')
        .set('Authorization', `Bearer ${vendorToken}`)
        .send({
          location: { lat: 48.85, lng: 2.35 },
          regions: [
            { region_id: 'maritime', is_home_region: true, price_per_km: 150, min_fee: 500 },
          ],
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('LOCATION_OUTSIDE_TOGO');
    });
  });
});
