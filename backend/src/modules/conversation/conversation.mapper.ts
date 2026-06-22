import type { ConversationListRow, Message } from './conversation.entity';

export interface CounterpartResponse {
  name: string;
  username: string;
  avatar: string | null;
}

export interface ConversationProductResponse {
  id: string;
  title: string;
  brand: string | null;
  condition: string | null;
  price: number | null;
  image: string | null;
}

export interface ConversationResponse {
  id: string;
  role: 'buyer' | 'vendor';
  counterpart: CounterpartResponse;
  product: ConversationProductResponse | null;
  last_message: {
    content: string;
    sender_id: string;
    type: string;
    created_at: Date;
  } | null;
  last_message_at: Date | null;
  unread_count: number;
  created_at: Date;
}

export interface MessageResponse {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  type: string;
  is_read: boolean;
  mine: boolean;
  created_at: Date;
}

function buyerName(row: ConversationListRow): string {
  const name = [row.buyer_first_name, row.buyer_last_name].filter(Boolean).join(' ').trim();
  return name.length > 0 ? name : 'Acheteur';
}

export function mapConversationResponse(
  row: ConversationListRow,
  requesterUserId: string,
): ConversationResponse {
  const isBuyer = row.buyer_id === requesterUserId;

  const counterpart: CounterpartResponse = isBuyer
    ? {
        name: row.vendor_shop_name,
        username: row.vendor_shop_name,
        avatar: row.vendor_shop_logo,
      }
    : {
        name: buyerName(row),
        username: buyerName(row),
        avatar: row.buyer_avatar_url,
      };

  const product: ConversationProductResponse | null = row.product_id
    ? {
        id: row.product_id,
        title: row.product_title ?? '',
        brand: row.product_brand,
        condition: row.product_condition,
        price: row.product_price,
        image: row.product_image,
      }
    : null;

  const last_message =
    row.last_message_content !== null && row.last_message_created_at !== null
      ? {
          content: row.last_message_content,
          sender_id: row.last_message_sender_id ?? '',
          type: row.last_message_type ?? 'TEXT',
          created_at: row.last_message_created_at,
        }
      : null;

  return {
    id: row.id,
    role: isBuyer ? 'buyer' : 'vendor',
    counterpart,
    product,
    last_message,
    last_message_at: row.last_message_at,
    unread_count: row.unread_count,
    created_at: row.created_at,
  };
}

export function mapMessageResponse(message: Message, requesterUserId: string): MessageResponse {
  return {
    id: message.id,
    conversation_id: message.conversation_id,
    sender_id: message.sender_id,
    content: message.content,
    type: message.type,
    is_read: message.is_read,
    mine: message.sender_id === requesterUserId,
    created_at: message.created_at,
  };
}
