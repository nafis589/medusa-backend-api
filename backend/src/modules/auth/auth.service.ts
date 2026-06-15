import { randomUUID } from 'crypto';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import type { IUserRepository } from './user.repository.interface';
import type { User, CreateUserData } from './user.entity';
import { hashPassword, comparePassword } from '@shared/utils/hash';
import {
  signToken,
  signRefreshToken,
  verifyRefreshToken
} from '@shared/utils/jwt.util';
import { getRedis } from '@shared/utils/redis';
import { sendMail } from '@shared/utils/mail';
import { AppError } from '@shared/errors/app-error';
import type { CartService } from '@modules/cart/cart.service';

function omitPassword(user: User): Omit<User, 'password_hash'> {
  const { password_hash: _, ...rest } = user;
  return rest;
}

export class AuthService {
  constructor(
    private userRepository: IUserRepository,
    private readonly cartService?: CartService,
  ) {}

  async register(data: Omit<CreateUserData, 'password_hash'> & { password: string }): Promise<{
    user: Omit<User, 'password_hash'>;
    accessToken: string;
    refreshToken: string;
  }> {
    // 1. Verify unique email
    const existing = await this.userRepository.findByEmail(data.email);
    if (existing) {
      throw new AppError(409, 'EMAIL_ALREADY_EXISTS', 'Email is already registered');
    }

    // 2. Hash password
    const passwordHash = await hashPassword(data.password);

    // 3. Create user
    const user = await this.userRepository.create({
      id: randomUUID(),
      email: data.email,
      password_hash: passwordHash,
      first_name: data.first_name,
      last_name: data.last_name,
      role: data.role ?? 'BUYER',
      avatar_url: data.avatar_url ?? null,
      phone: data.phone ?? null,
    });

    // 4. Generate tokens
    const accessToken = signToken({ id: user.id, email: user.email, role: user.role });
    const refreshToken = signRefreshToken({ id: user.id });

    return {
      user: omitPassword(user),
      accessToken,
      refreshToken,
    };
  }

  async login(
    email: string,
    password: string,
    sessionId?: string,
  ): Promise<{
    user: Omit<User, 'password_hash'>;
    accessToken: string;
    refreshToken: string;
  }> {
    // 1. Find user by email
    const user = await this.userRepository.findByEmail(email);
    if (!user) {
      throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
    }

    // 2. Compare password
    const matches = await comparePassword(password, user.password_hash);
    if (!matches) {
      throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
    }

    // 3. Generate tokens
    const accessToken = signToken({ id: user.id, email: user.email, role: user.role });
    const refreshToken = signRefreshToken({ id: user.id });

    if (sessionId && this.cartService) {
      await this.cartService.mergeGuestCart(sessionId, user.id);
    }

    return {
      user: omitPassword(user),
      accessToken,
      refreshToken,
    };
  }

  async refreshToken(token: string): Promise<{ accessToken: string }> {
    // 1. Verify refresh token structure / expiry
    let payload;
    try {
      payload = verifyRefreshToken(token);
    } catch {
      throw new AppError(401, 'INVALID_TOKEN', 'Invalid or expired refresh token');
    }

    // 2. Verify not blacklisted in Redis
    const redis = getRedis();
    const isBlacklisted = await redis.get(`blacklist:${token}`);
    if (isBlacklisted) {
      throw new AppError(401, 'TOKEN_BLACKLISTED', 'Token has been blacklisted');
    }

    // 3. Fetch user and generate new access token
    const user = await this.userRepository.findById(payload.id);
    if (!user) {
      throw new AppError(401, 'USER_NOT_FOUND', 'User not found');
    }

    const accessToken = signToken({ id: user.id, email: user.email, role: user.role });
    return { accessToken };
  }

  async logout(accessToken: string): Promise<void> {
    try {
      // Parse token expiration time
      const decoded = jwt.decode(accessToken) as jwt.JwtPayload | null;
      if (decoded?.exp) {
        const now = Math.floor(Date.now() / 1000);
        const ttl = decoded.exp - now;

        if (ttl > 0) {
          const redis = getRedis();
          await redis.set(`blacklist:${accessToken}`, '1', 'EX', ttl);
        }
      }
    } catch {
      // Silence decode errors, as an invalid token doesn't require blacklisting
    }
  }

  async forgotPassword(email: string): Promise<void> {
    // 1. Find user by email
    const user = await this.userRepository.findByEmail(email);
    if (!user) {
      throw new AppError(404, 'USER_NOT_FOUND', 'User not found');
    }

    // 2. Generate reset token (32 bytes random string)
    const resetToken = crypto.randomBytes(32).toString('hex');

    // 3. Save to Redis with 1 hour TTL
    const redis = getRedis();
    await redis.set(`reset-token:${resetToken}`, user.email, 'EX', 3600);

    // 4. Send email with link
    const resetLink = `http://localhost:3000/reset-password?token=${resetToken}`;
    await sendMail({
      to: user.email,
      subject: 'Réinitialisation de votre mot de passe',
      text: `Bonjour ${user.first_name},\n\nVous avez demandé la réinitialisation de votre mot de passe. Veuillez cliquer sur le lien suivant pour le réinitialiser :\n\n${resetLink}\n\nCe lien est valide pour une durée de 1 heure.\n\nSi vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer cet e-mail.\n\nCordialement,\nL'équipe Marketplace`,
    });
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    // 1. Verify token in Redis
    const redis = getRedis();
    const email = await redis.get(`reset-token:${token}`);
    if (!email) {
      throw new AppError(400, 'INVALID_OR_EXPIRED_TOKEN', 'Reset token is invalid or has expired');
    }

    // 2. Fetch user
    const user = await this.userRepository.findByEmail(email);
    if (!user) {
      throw new AppError(404, 'USER_NOT_FOUND', 'User not found');
    }

    // 3. Hash + update password
    const hashed = await hashPassword(newPassword);
    await this.userRepository.update(user.id, { password_hash: hashed });

    // 4. Delete token from Redis
    await redis.del(`reset-token:${token}`);
  }
}
