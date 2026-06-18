import type { Notification, CreateNotificationData } from './notification.entity';

export interface INotificationRepository {
  create(userId: string, data: CreateNotificationData & { id: string }): Promise<Notification>;
  list(
    userId: string,
    offset: number,
    limit: number,
  ): Promise<{ notifications: Notification[]; total: number }>;
  markAsRead(userId: string, notificationId: string): Promise<boolean>;
  markAllAsRead(userId: string): Promise<void>;
}
