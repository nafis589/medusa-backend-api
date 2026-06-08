import jwt from 'jsonwebtoken';

export interface JwtPayload {
  id: string;
  email: string;
  role: string;
}

interface RefreshPayload {
  id: string;
}

const ACCESS_SECRET = process.env.JWT_SECRET ?? 'change_me_access';
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET ?? 'change_me_refresh';

/**
 * Signs a short-lived access token (default 7d).
 */
export function signToken(payload: JwtPayload, expiresIn: string | number = '7d'): string {
  return jwt.sign(payload, ACCESS_SECRET, { expiresIn } as jwt.SignOptions);
}

/**
 * Signs a long-lived refresh token (30d).
 */
export function signRefreshToken(payload: RefreshPayload): string {
  return jwt.sign(payload, REFRESH_SECRET, { expiresIn: '30d' });
}

/**
 * Verifies an access token and returns the decoded payload.
 * Throws a JsonWebTokenError / TokenExpiredError on failure.
 */
export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, ACCESS_SECRET) as JwtPayload;
}

/**
 * Verifies a refresh token.
 */
export function verifyRefreshToken(token: string): RefreshPayload {
  return jwt.verify(token, REFRESH_SECRET) as RefreshPayload;
}
