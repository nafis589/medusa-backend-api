import { randomUUID } from 'crypto';
import mysql from 'mysql2/promise';
import { AppError } from '@shared/errors/app-error';
import { getPool } from '@shared/utils/db';
import { emitToUser } from '@modules/notification/socket.gateway';
import { findVendorIdByUserId, getUserIdByVendorId } from '@modules/vendor/vendor.util';
import type { IConversationRepository } from './conversation.repository.interface';
import type { Conversation, ConversationListRow, Message, MessageType } from './conversation.entity';
import {
  mapConversationResponse,
  mapMessageResponse,
  type ConversationResponse,
  type MessageResponse,
} from './conversation.mapper';

interface VendorInfo {
  id: string;
  user_id: string;
  shop_name: string;
  status: string;
}

export class ConversationService {
  constructor(private readonly repo: IConversationRepository) {}

  private async getVendorInfo(vendorId: string): Promise<VendorInfo | null> {
    const [rows] = await getPool().query(
      'SELECT id, user_id, shop_name, status FROM vendors WHERE id = ?',
      [vendorId],
    );
    const results = rows as mysql.RowDataPacket[];
    if (results.length === 0) return null;
    const row = results[0];
    return {
      id: row.id as string,
      user_id: row.user_id as string,
      shop_name: row.shop_name as string,
      status: row.status as string,
    };
  }

  private async assertParticipant(
    conversation: Conversation,
    userId: string,
  ): Promise<{ isBuyer: boolean; vendorUserId: string }> {
    const vendorUserId = (await getUserIdByVendorId(conversation.vendor_id)) ?? '';
    const isBuyer = conversation.buyer_id === userId;
    const isVendor = vendorUserId === userId;
    if (!isBuyer && !isVendor) {
      throw new AppError(403, 'FORBIDDEN', 'You are not part of this conversation');
    }
    return { isBuyer, vendorUserId };
  }

  private async getEnriched(
    conversationId: string,
    userId: string,
    vendorId: string | null,
  ): Promise<ConversationResponse> {
    const rows = await this.repo.listForUser(userId, vendorId);
    const row = rows.find((r) => r.id === conversationId);
    if (!row) {
      throw new AppError(404, 'CONVERSATION_NOT_FOUND', 'Conversation not found');
    }
    return mapConversationResponse(row, userId);
  }

  async listForUser(userId: string): Promise<ConversationResponse[]> {
    const vendorId = await findVendorIdByUserId(userId);
    const rows: ConversationListRow[] = await this.repo.listForUser(userId, vendorId);
    return rows.map((row) => mapConversationResponse(row, userId));
  }

  async createOrGet(
    userId: string,
    vendorId: string,
    productId: string | null,
  ): Promise<ConversationResponse> {
    const requesterVendorId = await findVendorIdByUserId(userId);
    if (requesterVendorId && requesterVendorId === vendorId) {
      throw new AppError(
        403,
        'CANNOT_MESSAGE_OWN_SHOP',
        'Vous ne pouvez pas contacter votre propre boutique.',
      );
    }

    const vendor = await this.getVendorInfo(vendorId);
    if (!vendor || vendor.status !== 'ACTIVE') {
      throw new AppError(404, 'VENDOR_NOT_FOUND', 'Vendor not found');
    }

    const existing = await this.repo.findPair(userId, vendorId, productId);
    if (existing) {
      return this.getEnriched(existing.id, userId, requesterVendorId);
    }

    const conversation = await this.repo.create({
      id: randomUUID(),
      buyer_id: userId,
      vendor_id: vendorId,
      product_id: productId,
    });

    // Seed a greeting from the vendor so the thread isn't empty.
    await this.repo.createMessage({
      id: randomUUID(),
      conversation_id: conversation.id,
      sender_id: vendor.user_id,
      content: `Bonjour, je suis ${vendor.shop_name}`,
      type: 'TEXT',
    });
    await this.repo.touch(conversation.id);

    return this.getEnriched(conversation.id, userId, requesterVendorId);
  }

  async getMessages(
    conversationId: string,
    userId: string,
  ): Promise<{ conversation: ConversationResponse; messages: MessageResponse[] }> {
    const conversation = await this.repo.findById(conversationId);
    if (!conversation) {
      throw new AppError(404, 'CONVERSATION_NOT_FOUND', 'Conversation not found');
    }
    await this.assertParticipant(conversation, userId);

    const vendorId = await findVendorIdByUserId(userId);
    const enriched = await this.getEnriched(conversationId, userId, vendorId);
    const messages = await this.repo.listMessages(conversationId);
    return {
      conversation: enriched,
      messages: messages.map((m) => mapMessageResponse(m, userId)),
    };
  }

  async sendMessage(
    conversationId: string,
    userId: string,
    content: string,
    type: MessageType = 'TEXT',
  ): Promise<MessageResponse> {
    const conversation = await this.repo.findById(conversationId);
    if (!conversation) {
      throw new AppError(404, 'CONVERSATION_NOT_FOUND', 'Conversation not found');
    }
    const { vendorUserId } = await this.assertParticipant(conversation, userId);

    const message: Message = await this.repo.createMessage({
      id: randomUUID(),
      conversation_id: conversationId,
      sender_id: userId,
      content,
      type,
    });
    await this.repo.touch(conversationId);

    const payload = {
      conversationId,
      message: {
        id: message.id,
        content: message.content,
        sender_id: message.sender_id,
        type: message.type,
        created_at: message.created_at,
      },
    };

    const recipients = new Set<string>([conversation.buyer_id, vendorUserId].filter(Boolean));
    for (const recipientId of recipients) {
      emitToUser(recipientId, 'message:new', payload);
      emitToUser(recipientId, 'conversation:updated', {
        conversationId,
        last_message_at: message.created_at,
      });
    }

    return mapMessageResponse(message, userId);
  }

  async markRead(conversationId: string, userId: string): Promise<void> {
    const conversation = await this.repo.findById(conversationId);
    if (!conversation) {
      throw new AppError(404, 'CONVERSATION_NOT_FOUND', 'Conversation not found');
    }
    await this.assertParticipant(conversation, userId);
    await this.repo.markRead(conversationId, userId);
  }
}
