import mysql from 'mysql2/promise';
import { getPool } from '@shared/utils/db';
import type {
  Conversation,
  ConversationListRow,
  CreateConversationData,
  CreateMessageData,
  Message,
  MessageType,
} from './conversation.entity';
import type { IConversationRepository } from './conversation.repository.interface';

function mapConversation(row: mysql.RowDataPacket): Conversation {
  return {
    id: row.id as string,
    buyer_id: row.buyer_id as string,
    vendor_id: row.vendor_id as string,
    product_id: (row.product_id as string | null) ?? null,
    last_message_at: (row.last_message_at as Date | null) ?? null,
    created_at: row.created_at as Date,
  };
}

function mapMessage(row: mysql.RowDataPacket): Message {
  return {
    id: row.id as string,
    conversation_id: row.conversation_id as string,
    sender_id: row.sender_id as string,
    content: row.content as string,
    type: row.type as MessageType,
    is_read: Boolean(row.is_read),
    created_at: row.created_at as Date,
  };
}

export class ConversationRepository implements IConversationRepository {
  private get pool(): mysql.Pool {
    return getPool();
  }

  async findById(id: string): Promise<Conversation | null> {
    const [rows] = await this.pool.query('SELECT * FROM conversations WHERE id = ?', [id]);
    const results = rows as mysql.RowDataPacket[];
    return results.length > 0 ? mapConversation(results[0]) : null;
  }

  async findPair(
    buyerId: string,
    vendorId: string,
    productId: string | null,
  ): Promise<Conversation | null> {
    const clause = productId === null ? 'product_id IS NULL' : 'product_id = ?';
    const params: unknown[] = productId === null ? [buyerId, vendorId] : [buyerId, vendorId, productId];
    const [rows] = await this.pool.query(
      `SELECT * FROM conversations WHERE buyer_id = ? AND vendor_id = ? AND ${clause} LIMIT 1`,
      params,
    );
    const results = rows as mysql.RowDataPacket[];
    return results.length > 0 ? mapConversation(results[0]) : null;
  }

  async create(data: CreateConversationData): Promise<Conversation> {
    await this.pool.query(
      `INSERT INTO conversations (id, buyer_id, vendor_id, product_id, last_message_at)
       VALUES (?, ?, ?, ?, NULL)`,
      [data.id, data.buyer_id, data.vendor_id, data.product_id],
    );
    const created = await this.findById(data.id);
    if (!created) throw new Error('Failed to create conversation');
    return created;
  }

  async listForUser(userId: string, vendorId: string | null): Promise<ConversationListRow[]> {
    const [rows] = await this.pool.query(
      `SELECT
         c.id, c.buyer_id, c.vendor_id, c.product_id, c.last_message_at, c.created_at,
         bu.first_name AS buyer_first_name,
         bu.last_name  AS buyer_last_name,
         bu.avatar_url AS buyer_avatar_url,
         v.user_id     AS vendor_user_id,
         v.shop_name   AS vendor_shop_name,
         v.shop_logo   AS vendor_shop_logo,
         p.title       AS product_title,
         p.brand       AS product_brand,
         p.condition   AS product_condition,
         p.price       AS product_price,
         pi.url        AS product_image,
         lm.content    AS last_message_content,
         lm.sender_id  AS last_message_sender_id,
         lm.type       AS last_message_type,
         lm.created_at AS last_message_created_at,
         (
           SELECT COUNT(*) FROM messages m2
           WHERE m2.conversation_id = c.id
             AND m2.is_read = FALSE
             AND m2.sender_id <> ?
         ) AS unread_count
       FROM conversations c
       INNER JOIN users   bu ON bu.id = c.buyer_id
       INNER JOIN vendors v  ON v.id = c.vendor_id
       LEFT JOIN products p  ON p.id = c.product_id
       LEFT JOIN product_images pi ON pi.product_id = p.id AND pi.is_primary = TRUE
       LEFT JOIN messages lm ON lm.id = (
         SELECT m3.id FROM messages m3
         WHERE m3.conversation_id = c.id
         ORDER BY m3.created_at DESC, m3.id DESC
         LIMIT 1
       )
       WHERE c.buyer_id = ? OR (? IS NOT NULL AND c.vendor_id = ?)
       ORDER BY c.last_message_at IS NULL, c.last_message_at DESC, c.created_at DESC`,
      [userId, userId, vendorId, vendorId],
    );

    return (rows as mysql.RowDataPacket[]).map((row) => ({
      id: row.id as string,
      buyer_id: row.buyer_id as string,
      vendor_id: row.vendor_id as string,
      product_id: (row.product_id as string | null) ?? null,
      last_message_at: (row.last_message_at as Date | null) ?? null,
      created_at: row.created_at as Date,
      buyer_first_name: (row.buyer_first_name as string | null) ?? null,
      buyer_last_name: (row.buyer_last_name as string | null) ?? null,
      buyer_avatar_url: (row.buyer_avatar_url as string | null) ?? null,
      vendor_user_id: row.vendor_user_id as string,
      vendor_shop_name: row.vendor_shop_name as string,
      vendor_shop_logo: (row.vendor_shop_logo as string | null) ?? null,
      product_title: (row.product_title as string | null) ?? null,
      product_brand: (row.product_brand as string | null) ?? null,
      product_condition: (row.product_condition as string | null) ?? null,
      product_price: (row.product_price as number | null) ?? null,
      product_image: (row.product_image as string | null) ?? null,
      last_message_content: (row.last_message_content as string | null) ?? null,
      last_message_sender_id: (row.last_message_sender_id as string | null) ?? null,
      last_message_type: (row.last_message_type as MessageType | null) ?? null,
      last_message_created_at: (row.last_message_created_at as Date | null) ?? null,
      unread_count: Number(row.unread_count ?? 0),
    }));
  }

  async touch(id: string): Promise<void> {
    await this.pool.query(
      'UPDATE conversations SET last_message_at = CURRENT_TIMESTAMP WHERE id = ?',
      [id],
    );
  }

  async listMessages(conversationId: string): Promise<Message[]> {
    const [rows] = await this.pool.query(
      'SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC, id ASC',
      [conversationId],
    );
    return (rows as mysql.RowDataPacket[]).map(mapMessage);
  }

  async createMessage(data: CreateMessageData): Promise<Message> {
    await this.pool.query(
      `INSERT INTO messages (id, conversation_id, sender_id, content, type, is_read)
       VALUES (?, ?, ?, ?, ?, FALSE)`,
      [data.id, data.conversation_id, data.sender_id, data.content, data.type],
    );
    const [rows] = await this.pool.query('SELECT * FROM messages WHERE id = ?', [data.id]);
    const results = rows as mysql.RowDataPacket[];
    return mapMessage(results[0]);
  }

  async markRead(conversationId: string, readerId: string): Promise<void> {
    await this.pool.query(
      `UPDATE messages SET is_read = TRUE
       WHERE conversation_id = ? AND sender_id <> ? AND is_read = FALSE`,
      [conversationId, readerId],
    );
  }
}
