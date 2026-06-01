import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

const AUTHOR_SELECT = { select: { id: true, name: true, username: true, avatar: true } };

// GET /thoughts — global feed (most recent)
router.get('/', async (req, res, next) => {
  try {
    const { page = '1' } = req.query as Record<string, string>;
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limit   = 20;
    const skip    = (pageNum - 1) * limit;

    const [thoughts, total] = await Promise.all([
      prisma.thought.findMany({
        skip, take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          author: AUTHOR_SELECT,
          _count: { select: { likes: true } },
        },
      }),
      prisma.thought.count(),
    ]);

    res.json({ thoughts, total, page: pageNum, pages: Math.ceil(total / limit) });
  } catch (err) { next(err); }
});

// GET /thoughts/following — thoughts from people you follow
router.get('/following', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { page = '1' } = req.query as Record<string, string>;
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limit   = 20;
    const skip    = (pageNum - 1) * limit;

    const follows = await prisma.follow.findMany({
      where:  { followerId: req.userId! },
      select: { followingId: true },
    });
    const ids = follows.map(f => f.followingId);

    if (ids.length === 0) return res.json({ thoughts: [], total: 0, page: 1, pages: 0 });

    const [thoughts, total] = await Promise.all([
      prisma.thought.findMany({
        where:   { authorId: { in: ids } },
        skip, take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          author: AUTHOR_SELECT,
          _count: { select: { likes: true } },
        },
      }),
      prisma.thought.count({ where: { authorId: { in: ids } } }),
    ]);

    res.json({ thoughts, total, page: pageNum, pages: Math.ceil(total / limit) });
  } catch (err) { next(err); }
});

// POST /thoughts
router.post('/', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { content } = req.body;
    if (!content?.trim()) return res.status(400).json({ message: 'Content is required' });
    if (content.length > 280) return res.status(400).json({ message: 'Max 280 characters' });

    const thought = await prisma.thought.create({
      data:    { content: content.trim(), authorId: req.userId! },
      include: { author: AUTHOR_SELECT, _count: { select: { likes: true } } },
    });
    res.status(201).json(thought);
  } catch (err) { next(err); }
});

// DELETE /thoughts/:id
router.delete('/:id', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const thought = await prisma.thought.findUnique({ where: { id: req.params.id } });
    if (!thought) return res.status(404).json({ message: 'Not found' });
    if (thought.authorId !== req.userId) return res.status(403).json({ message: 'Forbidden' });
    await prisma.thought.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// POST /thoughts/:id/like — toggle
router.post('/:id/like', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const userId    = req.userId!;
    const thoughtId = req.params.id;

    const existing = await prisma.thoughtLike.findUnique({
      where: { userId_thoughtId: { userId, thoughtId } },
    });

    if (existing) {
      await prisma.thoughtLike.delete({ where: { userId_thoughtId: { userId, thoughtId } } });
    } else {
      await prisma.thoughtLike.create({ data: { userId, thoughtId } });
    }

    const count = await prisma.thoughtLike.count({ where: { thoughtId } });
    res.json({ liked: !existing, count });
  } catch (err) { next(err); }
});

export default router;
