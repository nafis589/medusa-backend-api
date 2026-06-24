import { signToken, verifyToken, signRefreshToken, verifyRefreshToken } from '../jwt.util';
import { hashPassword, comparePassword } from '../hash';
import { getPagination, getPaginationMeta } from '../pagination';

describe('Shared Utilities', () => {
  describe('jwt.util', () => {
    it('should sign and verify access token', () => {
      const payload = { id: 'user-123', email: 'test@example.com', role: 'BUYER' };
      const token = signToken(payload);
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');

      const verified = verifyToken(token);
      expect(verified.id).toBe(payload.id);
      expect(verified.email).toBe(payload.email);
      expect(verified.role).toBe(payload.role);
    });

    it('should sign and verify refresh token', () => {
      const payload = { id: 'user-123' };
      const token = signRefreshToken(payload);
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');

      const verified = verifyRefreshToken(token);
      expect(verified.id).toBe(payload.id);
    });
  });

  describe('hash', () => {
    it('should hash password and successfully compare it', async () => {
      const password = 'mySecurePassword123';
      const hash = await hashPassword(password);
      expect(hash).toBeDefined();
      expect(hash).not.toBe(password);

      const isMatch = await comparePassword(password, hash);
      expect(isMatch).toBe(true);

      const isMismatch = await comparePassword('wrongPassword', hash);
      expect(isMismatch).toBe(false);
    });
  });

  describe('pagination', () => {
    it('should calculate offset and limit correctly', () => {
      const p1 = getPagination(1, 10);
      expect(p1.offset).toBe(0);
      expect(p1.limit).toBe(10);

      const p2 = getPagination(3, 25);
      expect(p2.offset).toBe(50);
      expect(p2.limit).toBe(25);

      // Safe defaults
      const p3 = getPagination(-1, -5);
      expect(p3.offset).toBe(0);
      expect(p3.limit).toBe(1);

      // Max limit cap
      const p4 = getPagination(2, 500);
      expect(p4.limit).toBe(100);
      expect(p4.offset).toBe(100);
    });

    it('should build correct pagination meta', () => {
      const meta = getPaginationMeta(105, 2, 10);
      expect(meta.total).toBe(105);
      expect(meta.page).toBe(2);
      expect(meta.limit).toBe(10);
      expect(meta.totalPages).toBe(11);
    });
  });
});
