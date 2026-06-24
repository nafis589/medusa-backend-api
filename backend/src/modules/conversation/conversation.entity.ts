export type MessageType = 'TEXT' | 'OFFER' | 'SYSTEM';

/** Conversation entity — one thread between a buyer (user) and a vendor (shop) */
export interface Conversation {
  id: string;
  buyer_id: string;
  vendor_id: string;
  product_id: string | null;
  last_message_at: Date | null;
  created_at: Date;
}

export interface CreateConversationData {
  id: string;
  buyer_id: string;
  vendor_id: string;
  product_id: string | null;
}

/** Message entity */
export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  type: MessageType;
  is_read: boolean;
  created_at: Date;
}

export interface CreateMessageData {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  type: MessageType;
}

/** Enriched conversation row (joined with buyer, vendor, product, last message, unread count) */
export interface ConversationListRow {
  id: string;
  buyer_id: string;
  vendor_id: string;
  product_id: string | null;
  last_message_at: Date | null;
  created_at: Date;
  // Buyer (user)
  buyer_first_name: string | null;
  buyer_last_name: string | null;
  buyer_avatar_url: string | null;
  // Vendor (shop)
  vendor_user_id: string;
  vendor_shop_name: string;
  vendor_shop_logo: string | null;
  // Product (nullable)
  product_title: string | null;
  product_brand: string | null;
  product_condition: string | null;
  product_price: number | null;
  product_image: string | null;
  // Last message
  last_message_content: string | null;
  last_message_sender_id: string | null;
  last_message_type: MessageType | null;
  last_message_created_at: Date | null;
  // Unread (messages addressed to the requester)
  unread_count: number;
}
