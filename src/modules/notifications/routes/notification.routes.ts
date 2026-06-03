import { Router } from 'express';
import { prisma } from '../../../config/database/prisma.client';
import { asyncHandler } from '../../../common/utils/async-handler';
import { sendSuccess } from '../../../common/utils/response.util';
import { authenticate } from '../../../common/middlewares/auth.middleware';

const router = Router();

router.use(authenticate);

router.get('/', asyncHandler(async (req, res) => {
  const notifications = await prisma.notification.findMany({
    where: { userId: req.user!.sub },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  sendSuccess(res, notifications);
}));

router.patch('/:id/read', asyncHandler(async (req, res) => {
  const n = await prisma.notification.update({
    where: { id: req.params.id },
    data: { isRead: true },
  });
  sendSuccess(res, n);
}));

router.patch('/read-all', asyncHandler(async (req, res) => {
  await prisma.notification.updateMany({
    where: { userId: req.user!.sub, isRead: false },
    data: { isRead: true },
  });
  sendSuccess(res, null, 'All notifications marked as read');
}));

export default router;
