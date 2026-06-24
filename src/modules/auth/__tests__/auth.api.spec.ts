/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any */
import dotenv from 'dotenv';
dotenv.config({ override: true });
process.env.NODE_ENV = 'test';
import request from 'supertest';
import app from '@/index';
import { getRedis } from '@shared/utils/redis';
import { closePool, clearDatabase, getPool, initializeDatabase } from '@shared/utils/db';
import { hashPassword } from '@shared/utils/hash';

describe('Auth API Integration Tests', () => {
  beforeAll(async () => {
    await initializeDatabase();
  });

  beforeEach(async () => {
    await clearDatabase();
    const redis = getRedis();
    // Flush reset-tokens or blacklisted tokens if needed
    const keys = await redis.keys('blacklist:*');
    if (keys.length > 0) {
      await redis.del(...keys);
    }
    const resetKeys = await redis.keys('reset-token:*');
    if (resetKeys.length > 0) {
      await redis.del(...resetKeys);
    }
  });

  afterAll(async () => {
    await clearDatabase();
    const redis = getRedis();
    await redis.quit();
    await closePool();
  });

  describe('POST /api/store/auth/register', () => {
    it('should register a new BUYER and return tokens', async () => {
      const res = await request(app)
        .post('/api/store/auth/register')
        .send({
          email: 'buyer@example.com',
          password: 'password123',
          first_name: 'John',
          last_name: 'Doe',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.user.email).toBe('buyer@example.com');
      expect(res.body.data.user.role).toBe('BUYER');
      expect(res.body.data.user.password_hash).toBeUndefined();
      expect(res.body.data.accessToken).toBeDefined();
      expect(res.body.data.refreshToken).toBeDefined();
    });

    it('should return 409 CONFLICT if email is already registered', async () => {
      const db = getPool();
      const hashed = await hashPassword('password123');
      await db.query(
        'INSERT INTO users (id, email, password_hash, first_name, last_name, role) VALUES (?, ?, ?, ?, ?, ?)',
        ['user-1', 'buyer@example.com', hashed, 'John', 'Doe', 'BUYER'],
      );

      const res = await request(app)
        .post('/api/store/auth/register')
        .send({
          email: 'buyer@example.com',
          password: 'password123',
          first_name: 'John',
          last_name: 'Doe',
        });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('EMAIL_ALREADY_EXISTS');
    });

    it('should return 400 VALIDATION_ERROR if password is less than 8 characters', async () => {
      const res = await request(app)
        .post('/api/store/auth/register')
        .send({
          email: 'buyer@example.com',
          password: 'short',
          first_name: 'John',
          last_name: 'Doe',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('POST /api/store/auth/login', () => {
    it('should log in a registered user and return tokens', async () => {
      const db = getPool();
      const hashed = await hashPassword('password123');
      await db.query(
        'INSERT INTO users (id, email, password_hash, first_name, last_name, role) VALUES (?, ?, ?, ?, ?, ?)',
        ['user-1', 'login@example.com', hashed, 'John', 'Doe', 'BUYER'],
      );

      const res = await request(app)
        .post('/api/store/auth/login')
        .send({
          email: 'login@example.com',
          password: 'password123',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.user.email).toBe('login@example.com');
      expect(res.body.data.accessToken).toBeDefined();
      expect(res.body.data.refreshToken).toBeDefined();
    });

    it('should return 401 INVALID_CREDENTIALS for wrong password', async () => {
      const db = getPool();
      const hashed = await hashPassword('password123');
      await db.query(
        'INSERT INTO users (id, email, password_hash, first_name, last_name, role) VALUES (?, ?, ?, ?, ?, ?)',
        ['user-1', 'login@example.com', hashed, 'John', 'Doe', 'BUYER'],
      );

      const res = await request(app)
        .post('/api/store/auth/login')
        .send({
          email: 'login@example.com',
          password: 'wrongpassword',
        });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
    });
  });

  describe('POST /api/store/auth/refresh', () => {
    it('should return a new access token with a valid refresh token', async () => {
      const db = getPool();
      const hashed = await hashPassword('password123');
      await db.query(
        'INSERT INTO users (id, email, password_hash, first_name, last_name, role) VALUES (?, ?, ?, ?, ?, ?)',
        ['user-1', 'refresh@example.com', hashed, 'John', 'Doe', 'BUYER'],
      );

      const loginRes = await request(app)
        .post('/api/store/auth/login')
        .send({
          email: 'refresh@example.com',
          password: 'password123',
        });

      const { refreshToken } = loginRes.body.data;

      const res = await request(app)
        .post('/api/store/auth/refresh')
        .send({ refreshToken });

      expect(res.status).toBe(200);
      expect(res.body.data.accessToken).toBeDefined();
    });

    it('should return 401 INVALID_TOKEN for invalid refresh token', async () => {
      const res = await request(app)
        .post('/api/store/auth/refresh')
        .send({ refreshToken: 'invalidtoken' });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('INVALID_TOKEN');
    });
  });

  describe('POST /api/store/auth/logout', () => {
    it('should blacklist the access token and reject subsequent authenticated requests', async () => {
      const db = getPool();
      const hashed = await hashPassword('password123');
      await db.query(
        'INSERT INTO users (id, email, password_hash, first_name, last_name, role) VALUES (?, ?, ?, ?, ?, ?)',
        ['user-1', 'logout@example.com', hashed, 'John', 'Doe', 'BUYER'],
      );

      const loginRes = await request(app)
        .post('/api/store/auth/login')
        .send({
          email: 'logout@example.com',
          password: 'password123',
        });

      const accessToken = loginRes.body.data.accessToken as string;

      // Logout
      const logoutRes = await request(app)
        .post('/api/store/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(logoutRes.status).toBe(200);
      expect(logoutRes.body.data.message).toBe('Déconnecté avec succès');

      // Attempt to access again with the same token
      const nextRes = await request(app)
        .post('/api/store/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(nextRes.status).toBe(401);
      expect(nextRes.body.error.code).toBe('UNAUTHORIZED');
    });

    it('should return 401 UNAUTHORIZED if authorization header is missing', async () => {
      const res = await request(app).post('/api/store/auth/logout');
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/store/auth/forgot-password', () => {
    it('should return 200 even if email does not exist', async () => {
      const res = await request(app)
        .post('/api/store/auth/forgot-password')
        .send({ email: 'nonexistent@example.com' });

      expect(res.status).toBe(200);
      expect(res.body.data.message).toContain('e-mail de réinitialisation a été envoyé');
    });

    it('should generate a reset token in Redis if email exists', async () => {
      const db = getPool();
      const hashed = await hashPassword('password123');
      await db.query(
        'INSERT INTO users (id, email, password_hash, first_name, last_name, role) VALUES (?, ?, ?, ?, ?, ?)',
        ['user-1', 'exist@example.com', hashed, 'John', 'Doe', 'BUYER'],
      );

      const res = await request(app)
        .post('/api/store/auth/forgot-password')
        .send({ email: 'exist@example.com' });

      expect(res.status).toBe(200);

      const redis = getRedis();
      const keys = await redis.keys('reset-token:*');
      expect(keys.length).toBe(1);

      const email = await redis.get(keys[0]);
      expect(email).toBe('exist@example.com');
    });
  });

  describe('POST /api/store/auth/reset-password', () => {
    it('should reset the password successfully with a valid reset token', async () => {
      const db = getPool();
      const hashed = await hashPassword('password123');
      await db.query(
        'INSERT INTO users (id, email, password_hash, first_name, last_name, role) VALUES (?, ?, ?, ?, ?, ?)',
        ['user-1', 'reset@example.com', hashed, 'John', 'Doe', 'BUYER'],
      );

      const redis = getRedis();
      const resetToken = 'dummy-reset-token';
      await redis.set(`reset-token:${resetToken}`, 'reset@example.com', 'EX', 60);

      const res = await request(app)
        .post('/api/store/auth/reset-password')
        .send({
          token: resetToken,
          password: 'newpassword123',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.message).toBe('Mot de passe réinitialisé avec succès');

      // Verify that reset token was deleted
      const tokenVal = await redis.get(`reset-token:${resetToken}`);
      expect(tokenVal).toBeNull();

      // Verify can log in with new password
      const loginRes = await request(app)
        .post('/api/store/auth/login')
        .send({
          email: 'reset@example.com',
          password: 'newpassword123',
        });

      expect(loginRes.status).toBe(200);
      expect(loginRes.body.data.accessToken).toBeDefined();
    });

    it('should return 400 INVALID_OR_EXPIRED_TOKEN for invalid reset token', async () => {
      const res = await request(app)
        .post('/api/store/auth/reset-password')
        .send({
          token: 'invalid-token',
          password: 'newpassword123',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_OR_EXPIRED_TOKEN');
    });
  });

  describe('POST /api/vendor/auth/register', () => {
    it('should register a user with VENDOR role and create a vendor entry with PENDING status', async () => {
      const res = await request(app)
        .post('/api/vendor/auth/register')
        .send({
          email: 'vendor@example.com',
          password: 'password123',
          first_name: 'Vendor',
          last_name: 'Owner',
          shop_name: 'My Awesome Shop',
          shop_description: 'A shop description',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.user.email).toBe('vendor@example.com');
      expect(res.body.data.user.role).toBe('VENDOR');
      expect(res.body.data.accessToken).toBeDefined();

      // Verify DB entries
      const db = getPool();
      const [userRows] = await db.query('SELECT * FROM users WHERE email = ?', [
        'vendor@example.com',
      ]);
      const users = userRows as any[];
      expect(users.length).toBe(1);

      const [vendorRows] = await db.query('SELECT * FROM vendors WHERE user_id = ?', [users[0].id]);
      const vendors = vendorRows as any[];
      expect(vendors.length).toBe(1);
      expect(vendors[0].shop_name).toBe('My Awesome Shop');
      expect(vendors[0].shop_description).toBe('A shop description');
      expect(vendors[0].status).toBe('PENDING');
    });

    it('should roll back user registration if vendor creation fails', async () => {
      // Mock db insertion failure by passing invalid field value or unique constraint
      // Let's trigger a failure by inserting a vendor with duplicate user_id if we try to insert it again
      const db = getPool();

      // First create a user manually
      const hashed = await hashPassword('password123');
      await db.query(
        'INSERT INTO users (id, email, password_hash, first_name, last_name, role) VALUES (?, ?, ?, ?, ?, ?)',
        ['user-v1', 'existing-v@example.com', hashed, 'John', 'Doe', 'VENDOR'],
      );
      // Create a vendor manually for this user
      await db.query(
        'INSERT INTO vendors (id, user_id, shop_name, shop_description, status) VALUES (?, ?, ?, ?, ?)',
        ['vendor-v1', 'user-v1', 'Shop 1', 'Desc', 'PENDING'],
      );

      // Now attempt to register vendor with the same email (conflict will happen on AuthService.register)
      const res = await request(app)
        .post('/api/vendor/auth/register')
        .send({
          email: 'existing-v@example.com',
          password: 'password123',
          first_name: 'Vendor',
          last_name: 'Owner',
          shop_name: 'Shop 2',
        });

      expect(res.status).toBe(409);

      // Let's test user deletion on vendor query failure.
      // We can force database insertion failure for vendor by sending a shop_name that is too long or something
      // but mysql VARCHAR(255) might just truncate or throw. Let's send a shop_name of more than 255 characters (e.g. 300 characters)
      const longShopName = 'a'.repeat(300);
      const resErr = await request(app)
        .post('/api/vendor/auth/register')
        .send({
          email: 'error-v@example.com',
          password: 'password123',
          first_name: 'Vendor',
          last_name: 'Owner',
          shop_name: longShopName,
        });

      expect(resErr.status).toBe(500);

      // Verify that 'error-v@example.com' user does not exist (rolled back/deleted)
      const [userRows] = await db.query('SELECT * FROM users WHERE email = ?', [
        'error-v@example.com',
      ]);
      expect((userRows as any[]).length).toBe(0);
    });
  });
});
