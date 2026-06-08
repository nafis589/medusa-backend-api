import type { Request, Response, NextFunction } from 'express';
import { AppError } from '@shared/errors/app-error';
import { verifyToken, type JwtPayload } from '@shared/utils/jwt.util';

// Extend Express Request with authenticated user
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    throw new AppError(401, 'UNAUTHORIZED', 'No token provided');
  }

  const token = authHeader.slice(7);

  try {
    // verifyToken throws on expired / invalid tokens
    req.user = verifyToken(token);
    next();
  } catch {
    throw new AppError(401, 'UNAUTHORIZED', 'Invalid or expired token');
  }
}
