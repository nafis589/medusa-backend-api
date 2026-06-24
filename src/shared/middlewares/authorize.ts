import type { Request, Response, NextFunction } from 'express';
import { AppError } from '@shared/errors/app-error';

/**
 * Usage: router.get('/admin', authenticate, authorize('ADMIN'), handler)
 *        router.get('/staff', authenticate, authorize('VENDOR', 'ADMIN'), handler)
 */
export function authorize(...roles: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw new AppError(401, 'UNAUTHORIZED', 'Unauthorized');
    }
    if (!roles.includes(req.user.role)) {
      throw new AppError(
        403,
        'FORBIDDEN',
        `Role '${req.user.role}' is not allowed to access this resource`,
      );
    }
    next();
  };
}
