import { randomUUID } from 'crypto';
import { AppError } from '@shared/errors/app-error';
import { getPagination, getPaginationMeta } from '@shared/utils/pagination';
import type { INotificationRepository } from './notification.repository.interface';
import type { Notification, CreateNotificationData } from './notification.entity';
import { emitToUser } from './socket.gateway';

export class NotificationService {
  constructor(private readonly notificationRepo: INotificationRepository) {}

  async create(userId: string, data: CreateNotificationData): Promise<Notification> {
    const notification = await this.notificationRepo.create(userId, {
      id: randomUUID(),
      ...data,
    });

    emitToUser(userId, 'notification:new', {
      notification: serializeNotification(notification),
    });

    return notification;
  }

  async list(
    userId: string,
    params: { page?: number; limit?: number } = {},
  ): Promise<{ notifications: Notification[]; total: number; page: number; limit: number }> {
    const page = params.page ?? 1;
    const { offset, limit } = getPagination(page, params.limit ?? 20);
    const result = await this.notificationRepo.list(userId, offset, limit);
    return { ...result, page, limit };
  }

  getListMeta(total: number, page: number, limit: number) {
    return getPaginationMeta(total, page, limit);
  }

  async markAsRead(userId: string, notificationId: string): Promise<void> {
    const updated = await this.notificationRepo.markAsRead(userId, notificationId);
    if (!updated) {
      throw new AppError(404, 'NOT_FOUND', 'Notification not found');
    }
  }

  async markAllAsRead(userId: string): Promise<void> {
    await this.notificationRepo.markAllAsRead(userId);
  }
}

export function serializeNotification(notification: Notification) {
  return {
    id: notification.id,
    user_id: notification.user_id,
    type: notification.type,
    title: notification.title,
    body: notification.body,
    is_read: notification.is_read,
    metadata: notification.metadata,
    created_at:
      notification.created_at instanceof Date
        ? notification.created_at.toISOString()
        : String(notification.created_at),
  };
}
