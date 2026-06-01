import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

// GET /bookmarks — user's saved posts
router.get('/', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = 20;
    const skip  = (page - 1) * limit;

    const [bookmarks, total] = await Promise.all([
      prisma.bookmark.findMany({
        where: { userId: req.userId! },
        orderBy: { createdAt: 'desc' },
        skip, take: limit,
        include: {
          blog: {
            include: {
              author:   { select: { name: true, username: true, avatar: true } },
              category: true,
              _count:   { select: { likes: true, comments: true } },
            },
          },
        },
      }),
      prisma.bookmark.count({ where: { userId: req.userId! } }),
    ]);

    res.json({ bookmarks: bookmarks.map(b => b.blog), total, page, pages: Math.ceil(total / limit) });
  } catch (err) { next(err); }
});

export default router;
