import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

const ACTOR_SELECT = { select: { id: true, name: true, username: true, avatar: true } };
const BLOG_SELECT  = { select: { id: true, title: true, slug: true } };

// GET /notifications — paginated list for current user
router.get('/', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const limit  = 20;
    const cursor = req.query.cursor as string | undefined;

    const notifications = await prisma.notification.findMany({
      where:   { recipientId: req.userId! },
      orderBy: { createdAt: 'desc' },
      take:    limit + 1,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      include: { actor: ACTOR_SELECT, blog: BLOG_SELECT },
    });

    const hasMore    = notifications.length > limit;
    const items      = hasMore ? notifications.slice(0, limit) : notifications;
    const nextCursor = hasMore ? items[items.length - 1].id : null;

    const unreadCount = await prisma.notification.count({
      where: { recipientId: req.userId!, read: false },
    });

    res.json({ notifications: items, nextCursor, unreadCount });
  } catch (err) { next(err); }
});

// GET /notifications/unread-count
router.get('/unread-count', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const count = await prisma.notification.count({
      where: { recipientId: req.userId!, read: false },
    });
    res.json({ count });
  } catch (err) { next(err); }
});

// POST /notifications/read-all
router.post('/read-all', authenticate, async (req: AuthRequest, res, next) => {
  try {
    await prisma.notification.updateMany({
      where: { recipientId: req.userId!, read: false },
      data:  { read: true },
    });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// PATCH /notifications/:id/read
router.patch('/:id/read', authenticate, async (req: AuthRequest, res, next) => {
  try {
    await prisma.notification.updateMany({
      where: { id: req.params.id, recipientId: req.userId! },
      data:  { read: true },
    });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

export default router;
