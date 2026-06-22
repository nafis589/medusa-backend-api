import { ConversationRepository } from './conversation.repository';
import { ConversationService } from './conversation.service';

export function createConversationService(): ConversationService {
  return new ConversationService(new ConversationRepository());
}
