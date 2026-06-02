import { Router } from 'express';
import { prisma } from '../lib/prisma';

const router = Router();

// GET /stats — public platform totals for the landing page.
router.get('/', async (_req, res, next) => {
  try {
    const [stories, members, topics] = await Promise.all([
      prisma.blog.count({ where: { published: true } }),
      prisma.user.count(),
      prisma.category.count(),
    ]);
    res.json({ stories, members, topics });
  } catch (err) { next(err); }
});

export default router;
