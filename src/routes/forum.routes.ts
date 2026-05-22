import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

const AUTHOR_SELECT = {
  select: { id: true, name: true, username: true, avatar: true },
};

// GET /forum/threads — list with optional ?category= ?sort= ?search= ?page=
router.get('/threads', async (req, res, next) => {
  try {
    const { category, sort = 'latest', search, page = '1' } = req.query as Record<string, string>;
    const limit = 20;
    const skip = (parseInt(page) - 1) * limit;

    const where: any = {};
    if (category && category !== 'ALL') where.category = category;
    if (search) where.title = { contains: search, mode: 'insensitive' };

    const orderBy = sort === 'popular'
      ? [{ votes: { _count: 'desc' as const } }, { createdAt: 'desc' as const }]
      : [{ pinned: 'desc' as const }, { createdAt: 'desc' as const }];

    const [threads, total] = await Promise.all([
      prisma.forumThread.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        select: {
          id: true, title: true, category: true, pinned: true, views: true, createdAt: true,
          author: AUTHOR_SELECT,
          _count: { select: { replies: true, votes: true } },
        },
      }),
      prisma.forumThread.count({ where }),
    ]);

    res.json({ threads, total, page: parseInt(page), pages: Math.ceil(total / limit) });
  } catch (err) { next(err); }
});

// GET /forum/threads/:id — single thread with replies
router.get('/threads/:id', async (req, res, next) => {
  try {
    const thread = await prisma.forumThread.findUnique({
      where: { id: req.params.id },
      include: {
        author: AUTHOR_SELECT,
        replies: {
          orderBy: { createdAt: 'asc' },
          include: { author: AUTHOR_SELECT },
        },
        _count: { select: { votes: true } },
      },
    });
    if (!thread) return res.status(404).json({ message: 'Thread not found' });

    await prisma.forumThread.update({
      where: { id: req.params.id },
      data: { views: { increment: 1 } },
    });

    res.json(thread);
  } catch (err) { next(err); }
});

// POST /forum/threads — create thread (auth)
router.post('/threads', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { title, content, category = 'GENERAL' } = req.body;
    if (!title?.trim() || !content?.trim()) {
      return res.status(400).json({ message: 'Title and content are required' });
    }
    const thread = await prisma.forumThread.create({
      data: {
        title: title.trim(),
        content: content.trim(),
        category,
        authorId: req.userId!,
      },
      include: { author: AUTHOR_SELECT },
    });
    res.status(201).json(thread);
  } catch (err) { next(err); }
});

// DELETE /forum/threads/:id — delete own thread (auth)
router.delete('/threads/:id', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const thread = await prisma.forumThread.findUnique({ where: { id: req.params.id } });
    if (!thread) return res.status(404).json({ message: 'Thread not found' });
    if (thread.authorId !== req.userId) return res.status(403).json({ message: 'Not your thread' });
    await prisma.forumThread.delete({ where: { id: req.params.id } });
    res.json({ message: 'Deleted' });
  } catch (err) { next(err); }
});

// POST /forum/threads/:id/replies — add reply (auth)
router.post('/threads/:id/replies', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { content } = req.body;
    if (!content?.trim()) return res.status(400).json({ message: 'Content is required' });

    const thread = await prisma.forumThread.findUnique({ where: { id: req.params.id } });
    if (!thread) return res.status(404).json({ message: 'Thread not found' });

    const reply = await prisma.forumReply.create({
      data: { content: content.trim(), threadId: req.params.id, authorId: req.userId! },
      include: { author: AUTHOR_SELECT },
    });
    res.status(201).json(reply);
  } catch (err) { next(err); }
});

// DELETE /forum/replies/:id — delete own reply (auth)
router.delete('/replies/:id', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const reply = await prisma.forumReply.findUnique({ where: { id: req.params.id } });
    if (!reply) return res.status(404).json({ message: 'Reply not found' });
    if (reply.authorId !== req.userId) return res.status(403).json({ message: 'Not your reply' });
    await prisma.forumReply.delete({ where: { id: req.params.id } });
    res.json({ message: 'Deleted' });
  } catch (err) { next(err); }
});

// POST /forum/threads/:id/vote — toggle upvote (auth)
router.post('/threads/:id/vote', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const existing = await prisma.forumVote.findUnique({
      where: { userId_threadId: { userId: req.userId!, threadId: req.params.id } },
    });
    if (existing) {
      await prisma.forumVote.delete({ where: { id: existing.id } });
    } else {
      await prisma.forumVote.create({ data: { userId: req.userId!, threadId: req.params.id } });
    }
    const count = await prisma.forumVote.count({ where: { threadId: req.params.id } });
    res.json({ voted: !existing, count });
  } catch (err) { next(err); }
});

export default router;
