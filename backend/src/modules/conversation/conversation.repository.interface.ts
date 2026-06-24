import type {
  Conversation,
  ConversationListRow,
  CreateConversationData,
  CreateMessageData,
  Message,
} from './conversation.entity';

export interface IConversationRepository {
  findById(id: string): Promise<Conversation | null>;
  findPair(
    buyerId: string,
    vendorId: string,
    productId: string | null,
  ): Promise<Conversation | null>;
  create(data: CreateConversationData): Promise<Conversation>;
  /** Conversations where the user participates (as buyer or as the vendor's owner). */
  listForUser(userId: string, vendorId: string | null): Promise<ConversationListRow[]>;
  touch(id: string): Promise<void>;

  listMessages(conversationId: string): Promise<Message[]>;
  createMessage(data: CreateMessageData): Promise<Message>;
  /** Marks messages addressed to the reader (not sent by them) as read. */
  markRead(conversationId: string, readerId: string): Promise<void>;
}
