import type { Notification, CreateNotificationData } from './notification.entity';

export interface INotificationRepository {
  create(userId: string, data: CreateNotificationData & { id: string }): Promise<Notification>;
}
