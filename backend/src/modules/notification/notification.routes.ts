import { Router } from 'express';
import { AppError } from '@shared/errors/app-error';
import { authenticate } from '@shared/middlewares/authenticate';
import { validateParams, validateQuery } from '@shared/middlewares/validate';
import { createNotificationService } from './notification.factory';
import {
  NotificationIdSchema,
  NotificationListQuerySchema,
  type NotificationListQueryInput,
} from './notification.schema';
import { serializeNotification } from './notification.service';

const router = Router();
const service = createNotificationService();

router.use(authenticate);

function resolveUserId(req: import('express').Request): string {
  const userId = req.user?.id;
  if (!userId) {
    throw new AppError(401, 'UNAUTHORIZED', 'No token provided');
  }
  return userId;
}

/**
 * GET /api/store/notifications?page=&limit=
 */
router.get('/', validateQuery(NotificationListQuerySchema), async (req, res, next) => {
  try {
    const userId = resolveUserId(req);
    const query = req.query as unknown as NotificationListQueryInput;
    const { notifications, total, page, limit } = await service.list(userId, {
      page: query.page,
      limit: query.limit,
    });
    res.json({
      data: notifications.map(serializeNotification),
      meta: service.getListMeta(total, page, limit),
    });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/store/notifications/read-all
 */
router.patch('/read-all', async (req, res, next) => {
  try {
    const userId = resolveUserId(req);
    await service.markAllAsRead(userId);
    res.json({ data: { message: 'All notifications marked as read' } });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/store/notifications/:id/read
 */
router.patch(
  '/:id/read',
  validateParams(NotificationIdSchema),
  async (req, res, next) => {
    try {
      const userId = resolveUserId(req);
      const { id } = req.params as { id: string };
      await service.markAsRead(userId, id);
      res.json({ data: { message: 'Notification marked as read' } });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
