/** In-app notification */
export interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string;
  is_read: boolean;
  metadata: Record<string, unknown> | null;
  created_at: Date;
}

export interface CreateNotificationData {
  type: string;
  title: string;
  body: string;
  metadata?: Record<string, unknown> | null;
}
