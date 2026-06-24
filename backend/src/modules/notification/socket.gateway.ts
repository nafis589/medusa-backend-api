import type { Server } from 'socket.io';
import { verifyToken } from '@shared/utils/jwt.util';
import { logger } from '@shared/utils/logger';

let io: Server | null = null;

export function initSocketGateway(server: Server): void {
  io = server;

  server.on('connection', (socket) => {
    const token = socket.handshake.auth?.token as string | undefined;

    if (!token) {
      socket.disconnect();
      return;
    }

    try {
      const user = verifyToken(token);
      void socket.join(`user_${user.id}`);
      logger.debug(`Socket ${socket.id} joined room user_${user.id}`);
    } catch {
      socket.disconnect();
    }
  });
}

export function emitToUser(userId: string, event: string, data: unknown): void {
  if (!io) return;
  io.to(`user_${userId}`).emit(event, data);
}
