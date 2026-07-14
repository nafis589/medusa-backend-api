import type { Request, Response, NextFunction } from 'express';
import { verifyToken } from '@shared/utils/jwt.util';

/** Attaches req.user when a valid Bearer token is present; never rejects. */
export function optionalAuthenticate(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    next();
    return;
  }

  try {
    req.user = verifyToken(authHeader.slice(7));
  } catch {
    // Public route — ignore invalid or expired tokens.
  }

  next();
}
