import { randomUUID } from 'crypto';
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
      notification: {
        id: notification.id,
        type: notification.type,
        title: notification.title,
        body: notification.body,
        is_read: notification.is_read,
        metadata: notification.metadata,
        created_at: notification.created_at,
      },
    });

    return notification;
  }
}
