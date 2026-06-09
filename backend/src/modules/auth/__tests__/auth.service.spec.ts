/* eslint-disable @typescript-eslint/unbound-method */
import { AuthService } from '../auth.service';
import type { IUserRepository } from '../user.repository.interface';
import type { User, CreateUserData } from '../user.entity';
import { getRedis } from '@shared/utils/redis';
import { sendMail } from '@shared/utils/mail';
import { hashPassword } from '@shared/utils/hash';

// ── Mock Redis ─────────────────────────────────────────────────────────────
jest.mock('@shared/utils/redis', () => {
  const redisMock = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  };
  return {
    getRedis: () => redisMock,
  };
});

// ── Mock Mail ──────────────────────────────────────────────────────────────
jest.mock('@shared/utils/mail', () => ({
  sendMail: jest.fn().mockResolvedValue(undefined),
}));

// ── Helpers ────────────────────────────────────────────────────────────────
function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-123',
    email: 'john.doe@example.com',
    password_hash: '$2a$12$somehashedpasswordstringforjohndoe',
    first_name: 'John',
    last_name: 'Doe',
    role: 'BUYER',
    avatar_url: null,
    phone: null,
    created_at: new Date('2026-01-01'),
    updated_at: new Date('2026-01-01'),
    ...overrides,
  };
}

function buildRepo(overrides: Partial<IUserRepository> = {}): IUserRepository {
  return {
    findById: jest.fn().mockResolvedValue(null),
    findByEmail: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockImplementation((data: CreateUserData & { id: string }) =>
      Promise.resolve({
        id: data.id,
        email: data.email,
        password_hash: data.password_hash,
        first_name: data.first_name,
        last_name: data.last_name,
        role: data.role ?? 'BUYER',
        avatar_url: data.avatar_url ?? null,
        phone: data.phone ?? null,
        created_at: new Date(),
        updated_at: new Date(),
      }),
    ),
    update: jest.fn().mockImplementation((id: string, data: Partial<Omit<User, 'id' | 'created_at' | 'updated_at'>>) =>
      Promise.resolve({
        ...makeUser({ id }),
        ...data,
      }),
    ),
    ...overrides,
  };
}

interface MockRedisClient {
  get: jest.Mock;
  set: jest.Mock;
  del: jest.Mock;
}

// ── Test suites ─────────────────────────────────────────────────────────────
describe('AuthService', () => {
  let mockRedis: MockRedisClient;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRedis = getRedis() as unknown as MockRedisClient;
  });

  // ── register ─────────────────────────────────────────────────────────────
  describe('register', () => {
    it('creates a new user and returns tokens when details are valid', async () => {
      const repo = buildRepo();
      const svc = new AuthService(repo);

      const result = await svc.register({
        email: 'register@example.com',
        password: 'password123',
        first_name: 'Jane',
        last_name: 'Doe',
      });

      expect(repo.findByEmail).toHaveBeenCalledWith('register@example.com');
      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'register@example.com',
          first_name: 'Jane',
          last_name: 'Doe',
          role: 'BUYER',
        }),
      );
      expect(result.user).not.toHaveProperty('password_hash');
      expect(result.user.email).toBe('register@example.com');
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
    });

    it('throws 409 EMAIL_ALREADY_EXISTS when email is already registered', async () => {
      const existing = makeUser({ email: 'duplicate@example.com' });
      const repo = buildRepo({ findByEmail: jest.fn().mockResolvedValue(existing) });
      const svc = new AuthService(repo);

      await expect(
        svc.register({
          email: 'duplicate@example.com',
          password: 'password123',
          first_name: 'Jane',
          last_name: 'Doe',
        }),
      ).rejects.toMatchObject({
        statusCode: 409,
        code: 'EMAIL_ALREADY_EXISTS',
      });

      expect(repo.create).not.toHaveBeenCalled();
    });
  });

  // ── login ────────────────────────────────────────────────────────────────
  describe('login', () => {
    it('returns tokens and user when credentials are correct', async () => {
      const hashedPassword = await hashPassword('correct_pass');
      const user = makeUser({ email: 'login@example.com', password_hash: hashedPassword });
      const repo = buildRepo({ findByEmail: jest.fn().mockResolvedValue(user) });
      const svc = new AuthService(repo);

      const result = await svc.login('login@example.com', 'correct_pass');

      expect(repo.findByEmail).toHaveBeenCalledWith('login@example.com');
      expect(result.user.email).toBe('login@example.com');
      expect(result.user).not.toHaveProperty('password_hash');
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
    });

    it('throws 401 INVALID_CREDENTIALS when user email is not found', async () => {
      const repo = buildRepo({ findByEmail: jest.fn().mockResolvedValue(null) });
      const svc = new AuthService(repo);

      await expect(svc.login('unknown@example.com', 'somepass')).rejects.toMatchObject({
        statusCode: 401,
        code: 'INVALID_CREDENTIALS',
      });
    });

    it('throws 401 INVALID_CREDENTIALS when password does not match', async () => {
      const hashedPassword = await hashPassword('correct_pass');
      const user = makeUser({ email: 'login@example.com', password_hash: hashedPassword });
      const repo = buildRepo({ findByEmail: jest.fn().mockResolvedValue(user) });
      const svc = new AuthService(repo);

      await expect(svc.login('login@example.com', 'wrong_pass')).rejects.toMatchObject({
        statusCode: 401,
        code: 'INVALID_CREDENTIALS',
      });
    });
  });

  // ── refreshToken ─────────────────────────────────────────────────────────
  describe('refreshToken', () => {
    it('returns a new access token when refresh token is valid and not blacklisted', async () => {
      const user = makeUser({ id: 'user-id-456', email: 'test@example.com', role: 'VENDOR' });
      const repo = buildRepo({ findById: jest.fn().mockResolvedValue(user) });
      const svc = new AuthService(repo);

      const { refreshToken } = await svc.register({
        email: 'test@example.com',
        password: 'password123',
        first_name: 'John',
        last_name: 'Doe',
        role: 'VENDOR',
      });

      mockRedis.get.mockResolvedValue(null); // Not blacklisted

      const result = await svc.refreshToken(refreshToken);

      expect(mockRedis.get).toHaveBeenCalledWith(`blacklist:${refreshToken}`);
      expect(result.accessToken).toBeDefined();
    });

    it('throws 401 TOKEN_BLACKLISTED when refresh token is in blacklist', async () => {
      const repo = buildRepo();
      const svc = new AuthService(repo);

      const { refreshToken } = await svc.register({
        email: 'test@example.com',
        password: 'password123',
        first_name: 'John',
        last_name: 'Doe',
      });

      mockRedis.get.mockResolvedValue('1'); // Blacklisted

      await expect(svc.refreshToken(refreshToken)).rejects.toMatchObject({
        statusCode: 401,
        code: 'TOKEN_BLACKLISTED',
      });
    });

    it('throws 401 INVALID_TOKEN when refresh token is invalid or expired', async () => {
      const repo = buildRepo();
      const svc = new AuthService(repo);

      await expect(svc.refreshToken('invalid-jwt-token')).rejects.toMatchObject({
        statusCode: 401,
        code: 'INVALID_TOKEN',
      });
    });
  });

  // ── logout ───────────────────────────────────────────────────────────────
  describe('logout', () => {
    it('blacklists the access token in Redis with remaining TTL', async () => {
      const repo = buildRepo();
      const svc = new AuthService(repo);

      const { accessToken } = await svc.register({
        email: 'test@example.com',
        password: 'password123',
        first_name: 'John',
        last_name: 'Doe',
      });

      await svc.logout(accessToken);

      expect(mockRedis.set).toHaveBeenCalledWith(
        `blacklist:${accessToken}`,
        '1',
        'EX',
        expect.any(Number),
      );
    });
  });

  // ── forgotPassword / resetPassword ──────────────────────────────────────
  describe('forgotPassword & resetPassword flow', () => {
    it('generates token, sends email, and updates password successfully', async () => {
      const user = makeUser({ email: 'forgot@example.com', first_name: 'Alice' });
      const repo = buildRepo({
        findByEmail: jest.fn().mockResolvedValue(user),
        update: jest.fn().mockResolvedValue(user),
      });
      const svc = new AuthService(repo);
      const anyString = expect.any(String) as unknown as string;

      // 1. Request forgot password
      await svc.forgotPassword('forgot@example.com');

      expect(repo.findByEmail).toHaveBeenCalledWith('forgot@example.com');
      expect(mockRedis.set).toHaveBeenCalledWith(
        expect.stringContaining('reset-token:'),
        'forgot@example.com',
        'EX',
        3600,
      );
      expect(sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'forgot@example.com',
          subject: anyString,
          text: anyString,
        }),
      );

      // Extract generated reset token from mock redis call args
      const mockSetCalls = mockRedis.set.mock.calls as unknown as [string, string, string, number][];
      const setTokenKey = mockSetCalls[0][0]; // "reset-token:<token>"
      const resetToken = setTokenKey.split(':')[1];

      // 2. Perform reset password
      mockRedis.get.mockResolvedValue('forgot@example.com'); // Retrieve email for token

      await svc.resetPassword(resetToken, 'newPassword789');

      expect(mockRedis.get).toHaveBeenCalledWith(`reset-token:${resetToken}`);
      expect(repo.update).toHaveBeenCalledWith(
        user.id,
        expect.objectContaining({
          password_hash: anyString,
        }),
      );
      expect(mockRedis.del).toHaveBeenCalledWith(`reset-token:${resetToken}`);
    });

    it('forgotPassword throws 404 when user email does not exist', async () => {
      const repo = buildRepo({ findByEmail: jest.fn().mockResolvedValue(null) });
      const svc = new AuthService(repo);

      await expect(svc.forgotPassword('unknown@example.com')).rejects.toMatchObject({
        statusCode: 404,
        code: 'USER_NOT_FOUND',
      });
    });

    it('resetPassword throws 400 when reset token is invalid or expired', async () => {
      const repo = buildRepo();
      const svc = new AuthService(repo);

      mockRedis.get.mockResolvedValue(null); // Expired or not found

      await expect(svc.resetPassword('expired-token', 'newPass123')).rejects.toMatchObject({
        statusCode: 400,
        code: 'INVALID_OR_EXPIRED_TOKEN',
      });
    });
  });
});
