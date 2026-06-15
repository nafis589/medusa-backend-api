import { NotificationRepository } from './notification.repository';
import { NotificationService } from './notification.service';

export function createNotificationService(): NotificationService {
  return new NotificationService(new NotificationRepository());
}
