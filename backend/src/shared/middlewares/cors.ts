import type { Request, Response, NextFunction } from 'express';

const ALLOWED_ORIGINS = [
  process.env.CORS_ORIGIN_STORE ?? 'http://localhost:3000',
  process.env.CORS_ORIGIN_VENDOR ?? 'http://localhost:3001',
  process.env.CORS_ORIGIN_ADMIN ?? 'http://localhost:3002',
];

export function corsMiddleware(req: Request, res: Response, next: NextFunction): void {
  const origin = req.headers.origin;

  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  }

  if (req.method === 'OPTIONS') {
    res.sendStatus(204);
    return;
  }

  next();
}
