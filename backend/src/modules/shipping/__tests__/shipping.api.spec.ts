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

describe('Shipping API Integration Tests', () => {
  let vendorId: string;
  let vendorToken: string;

  beforeAll(async () => {
    await initializeDatabase();
  });

  beforeEach(async () => {
    await clearDatabase();
    const redis = getRedis();
    const keys = await redis.keys('blacklist:*');
    if (keys.length > 0) await redis.del(...keys);

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

    vendorToken = signToken({ id: userId, email: 'vendor@shipping.test', role: 'VENDOR' });
  });

  afterAll(async () => {
    await clearDatabase();
    const redis = getRedis();
    await redis.quit();
    await closePool();
  });

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
    it('returns 200 with VENDOR_SHIPPING_NOT_SET when vendor has no config', async () => {
      const res = await request(app).post('/api/store/shipping/calculate').send({
        vendor_id: vendorId,
        client_lat: 6.14,
        client_lng: 1.21,
      });

      expect(res.status).toBe(200);
      expect(res.body.data.error.code).toBe('VENDOR_SHIPPING_NOT_SET');
    });

    it('returns 200 with LOCATION_OUTSIDE_TOGO for client outside Togo', async () => {
      await request(app)
        .patch('/api/vendor/shipping')
        .set('Authorization', `Bearer ${vendorToken}`)
        .send({
          location: { lat: 6.1375, lng: 1.2123 },
          regions: [
            { region_id: 'maritime', is_home_region: true, price_per_km: 150, min_fee: 500 },
          ],
        });

      const res = await request(app).post('/api/store/shipping/calculate').send({
        vendor_id: vendorId,
        client_lat: 48.85,
        client_lng: 2.35,
      });

      expect(res.status).toBe(200);
      expect(res.body.data.error.code).toBe('LOCATION_OUTSIDE_TOGO');
    });

    it('returns PER_KM fee for same-region delivery', async () => {
      await request(app)
        .patch('/api/vendor/shipping')
        .set('Authorization', `Bearer ${vendorToken}`)
        .send({
          location: { lat: 6.1375, lng: 1.2123 },
          regions: [
            { region_id: 'maritime', is_home_region: true, price_per_km: 150, min_fee: 500 },
          ],
        });

      const res = await request(app).post('/api/store/shipping/calculate').send({
        vendor_id: vendorId,
        client_lat: 6.2,
        client_lng: 1.25,
      });

      expect(res.status).toBe(200);
      expect(res.body.data.method).toBe('PER_KM');
      expect(res.body.data.fee).toBeGreaterThanOrEqual(500);
      expect(res.body.data.error).toBeUndefined();
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
