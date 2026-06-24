import dotenv from 'dotenv';
const isTestEnv = process.env.NODE_ENV === 'test';
dotenv.config({ override: true });
if (isTestEnv) {
  process.env.NODE_ENV = 'test';
}

import express from 'express';
import path from 'path';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import compression from 'compression';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';

import { logger } from '@shared/utils/logger';
import { errorHandler } from '@shared/middlewares/error-handler';
import { corsMiddleware } from '@shared/middlewares/cors';
import { initializeDatabase } from '@shared/utils/db';

const app = express();
const httpServer = createServer(app);

// ── Socket.io ─────────────────────────────────────────────────────────────────
export const io = new SocketIOServer(httpServer, {
  cors: {
    origin: [
      process.env.CORS_ORIGIN_STORE ?? 'http://localhost:3000',
      process.env.CORS_ORIGIN_VENDOR ?? 'http://localhost:3001',
      process.env.CORS_ORIGIN_ADMIN ?? 'http://localhost:3002',
    ],
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

import { initSocketGateway } from '@modules/notification/socket.gateway';
import { registerSubscribers } from '@subscribers/index';

initSocketGateway(io);
registerSubscribers();

// ── Global middlewares ────────────────────────────────────────────────────────
app.use(helmet());
app.use(compression());
app.use(corsMiddleware);
app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── API routes (mounted per phase) ───────────────────────────────────────────
import storeRouter from '@api/store';
import vendorRouter from '@api/vendor';
import adminRouter from '@api/admin';
app.use('/api/store', storeRouter);
app.use('/api/vendor', vendorRouter);
app.use('/api/admin', adminRouter);

// ── Error handler (must be last) ─────────────────────────────────────────────
app.use(errorHandler);

// ── Start server ─────────────────────────────────────────────────────────────
const PORT = Number(process.env.PORT ?? 5000);

async function start(): Promise<void> {
  try {
    await initializeDatabase();
    if (process.env.NODE_ENV !== 'test') {
      httpServer.on('error', (err: NodeJS.ErrnoException) => {
        if (err.code === 'EADDRINUSE') {
          logger.error(
            `Port ${String(PORT)} déjà utilisé. Lancez "npm run stop" dans backend/ puis "npm run dev".`,
          );
          process.exit(1);
        }
        throw err;
      });

      httpServer.listen(PORT, () => {
        logger.info(`🚀 Server running on http://localhost:${String(PORT)}`);
        logger.info(`📡 Socket.IO ready`);
      });

      const shutdown = (signal: string) => {
        logger.info(`Arrêt (${signal})…`);
        httpServer.close(() => process.exit(0));
        setTimeout(() => process.exit(1), 5000).unref();
      };

      process.on('SIGINT', () => shutdown('SIGINT'));
      process.on('SIGTERM', () => shutdown('SIGTERM'));
    }
  } catch (err) {
    logger.error(err, 'Failed to initialize database and start server');
    process.exit(1);
  }
}

void start();

export default app;
