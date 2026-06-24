import { randomUUID } from 'crypto';
import type { Request, Response, NextFunction } from 'express';
import type { Cart } from '@modules/cart/cart.entity';
import type { CartService } from '@modules/cart/cart.service';
import { UserRepository } from '@modules/auth/user.repository';
import { verifyToken } from '@shared/utils/jwt.util';

const SESSION_COOKIE = 'session_id';
const SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const userRepository = new UserRepository();

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      cart?: Cart;
      cartSessionId?: string;
    }
  }
}

function ensureSessionCookie(req: Request, res: Response): string {
  const existing = req.cookies?.[SESSION_COOKIE] as string | undefined;
  if (existing) return existing;

  const sessionId = randomUUID();
  res.cookie(SESSION_COOKIE, sessionId, {
    httpOnly: true,
    maxAge: SESSION_MAX_AGE_MS,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });
  return sessionId;
}

async function resolveUserIdFromBearer(req: Request): Promise<string | undefined> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return undefined;

  const token = authHeader.slice(7);
  try {
    const decoded = verifyToken(token);
    const user = await userRepository.findById(decoded.id);
    if (!user) {
      // JWT valide mais utilisateur absent (ex. base réinitialisée) → panier invité
      return undefined;
    }
    req.user = decoded;
    return decoded.id;
  } catch {
    return undefined;
  }
}

export function createResolveCartMiddleware(cartService: CartService) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const sessionId = ensureSessionCookie(req, res);
      req.cartSessionId = sessionId;

      const userId = await resolveUserIdFromBearer(req);
      const cart = await cartService.getOrCreate(userId, userId ? undefined : sessionId);
      req.cart = cart;
      next();
    } catch (err) {
      next(err);
    }
  };
}
