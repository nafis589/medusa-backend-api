import { Router } from 'express';
import { authenticate } from '@shared/middlewares/authenticate';
import { authorize } from '@shared/middlewares/authorize';
import { validate, validateParams } from '@shared/middlewares/validate';
import { createConversationService } from '@modules/conversation/conversation.factory';
import {
  CreateConversationSchema,
  SendMessageSchema,
  ConversationIdSchema,
  type CreateConversationInput,
  type SendMessageInput,
} from '@modules/conversation/conversation.schema';

const router = Router();
const service = createConversationService();

router.use(authenticate);
router.use(authorize('BUYER', 'VENDOR'));

/**
 * GET /api/store/conversations
 */
router.get('/', async (req, res, next) => {
  try {
    const conversations = await service.listForUser(req.user!.id);
    res.json({ data: conversations });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/store/conversations
 */
router.post('/', validate(CreateConversationSchema), async (req, res, next) => {
  try {
    const { vendor_id, product_id } = req.body as CreateConversationInput;
    const conversation = await service.createOrGet(req.user!.id, vendor_id, product_id ?? null);
    res.status(201).json({ data: conversation });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/store/conversations/:id/messages
 */
router.get('/:id/messages', validateParams(ConversationIdSchema), async (req, res, next) => {
  try {
    const { id } = req.params as { id: string };
    const result = await service.getMessages(id, req.user!.id);
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/store/conversations/:id/messages
 */
router.post(
  '/:id/messages',
  validateParams(ConversationIdSchema),
  validate(SendMessageSchema),
  async (req, res, next) => {
    try {
      const { id } = req.params as { id: string };
      const { content, type } = req.body as SendMessageInput;
      const message = await service.sendMessage(id, req.user!.id, content, type);
      res.status(201).json({ data: message });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * PATCH /api/store/conversations/:id/read
 */
router.patch('/:id/read', validateParams(ConversationIdSchema), async (req, res, next) => {
  try {
    const { id } = req.params as { id: string };
    await service.markRead(id, req.user!.id);
    res.json({ data: { success: true } });
  } catch (err) {
    next(err);
  }
});

export default router;
