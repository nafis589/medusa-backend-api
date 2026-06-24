import { z } from 'zod';

export const CreateConversationSchema = z.object({
  vendor_id: z.string().min(1, 'vendor_id is required'),
  product_id: z.string().min(1).optional().nullable(),
});

export const SendMessageSchema = z.object({
  content: z.string().trim().min(1, 'Message cannot be empty').max(2000),
  type: z.enum(['TEXT', 'OFFER']).optional().default('TEXT'),
});

export const ConversationIdSchema = z.object({
  id: z.string().min(1),
});

export type CreateConversationInput = z.infer<typeof CreateConversationSchema>;
export type SendMessageInput = z.infer<typeof SendMessageSchema>;
export type ConversationIdInput = z.infer<typeof ConversationIdSchema>;
