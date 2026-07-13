import { Router } from 'express';
import { authenticate } from '@shared/middlewares/authenticate';
import { authorize } from '@shared/middlewares/authorize';
import { validate } from '@shared/middlewares/validate';
import { createReviewService } from '@modules/review/review.factory';
import { serializeReview } from '@modules/review/review.service';
import { CreateReviewSchema, type CreateReviewInput } from '@modules/review/review.schema';

const router = Router();
const service = createReviewService();

router.use(authenticate);
router.use(authorize('BUYER'));

/**
 * POST /api/store/reviews
 */
router.post('/', validate(CreateReviewSchema), async (req, res, next) => {
  try {
    const body = req.body as CreateReviewInput;
    const review = await service.create(req.user!.id, body);
    res.status(201).json({ data: serializeReview(review) });
  } catch (err) {
    next(err);
  }
});

export default router;
