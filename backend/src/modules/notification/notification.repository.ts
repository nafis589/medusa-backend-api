import { getPool } from '@shared/utils/db';
import type mysql from 'mysql2/promise';
import type { INotificationRepository } from './notification.repository.interface';
import type { Notification, CreateNotificationData } from './notification.entity';

function parseMetadata(value: unknown): Record<string, unknown> | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') {
    return JSON.parse(value) as Record<string, unknown>;
  }
  return value as Record<string, unknown>;
}

function mapNotification(row: mysql.RowDataPacket): Notification {
  return {
    id: row.id as string,
    user_id: row.user_id as string,
    type: row.type as string,
    title: row.title as string,
    body: row.body as string,
    is_read: Boolean(row.is_read),
    metadata: parseMetadata(row.metadata),
    created_at: row.created_at as Date,
  };
}

export class NotificationRepository implements INotificationRepository {
  private get pool(): mysql.Pool {
    return getPool();
  }

  async create(
    userId: string,
    data: CreateNotificationData & { id: string },
  ): Promise<Notification> {
    await this.pool.query(
      `INSERT INTO notifications (id, user_id, type, title, body, is_read, metadata)
       VALUES (?, ?, ?, ?, ?, FALSE, ?)`,
      [
        data.id,
        userId,
        data.type,
        data.title,
        data.body,
        data.metadata ? JSON.stringify(data.metadata) : null,
      ],
    );

    const [rows] = await this.pool.query('SELECT * FROM notifications WHERE id = ?', [data.id]);
    const results = rows as mysql.RowDataPacket[];
    if (results.length === 0) {
      throw new Error(`Failed to find created notification with id: ${data.id}`);
    }
    return mapNotification(results[0]);
  }

  async list(
    userId: string,
    offset: number,
    limit: number,
  ): Promise<{ notifications: Notification[]; total: number }> {
    const [countRows] = await this.pool.query(
      'SELECT COUNT(*) AS total FROM notifications WHERE user_id = ?',
      [userId],
    );
    const total = Number((countRows as mysql.RowDataPacket[])[0]?.total ?? 0);

    const [rows] = await this.pool.query(
      `SELECT * FROM notifications
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [userId, limit, offset],
    );

    return {
      notifications: (rows as mysql.RowDataPacket[]).map(mapNotification),
      total,
    };
  }

  async markAsRead(userId: string, notificationId: string): Promise<boolean> {
    const [result] = await this.pool.query(
      'UPDATE notifications SET is_read = TRUE WHERE id = ? AND user_id = ?',
      [notificationId, userId],
    );
    return (result as mysql.ResultSetHeader).affectedRows > 0;
  }

  async markAllAsRead(userId: string): Promise<void> {
    await this.pool.query(
      'UPDATE notifications SET is_read = TRUE WHERE user_id = ? AND is_read = FALSE',
      [userId],
    );
  }
}
