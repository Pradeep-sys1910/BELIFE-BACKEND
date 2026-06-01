import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';
import { notify } from '../lib/notify';

const router = Router();

const AUTHOR_SELECT = { select: { id: true, name: true, username: true, avatar: true } };

// GET /challenges
router.get('/', async (req, res, next) => {
  try {
    const { status = 'ACTIVE', page = '1', category } = req.query as Record<string, string>;
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limit   = 12;
    const skip    = (pageNum - 1) * limit;

    const where: any = { status };
    if (category && category !== 'ALL') where.category = category;

    const [challenges, total] = await Promise.all([
      prisma.challenge.findMany({
        where, skip, take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          creator: AUTHOR_SELECT,
          _count:  { select: { submissions: true } },
        },
      }),
      prisma.challenge.count({ where }),
    ]);

    res.json({ challenges, total, page: pageNum, pages: Math.ceil(total / limit) });
  } catch (err) { next(err); }
});

// GET /challenges/:id
router.get('/:id', async (req, res, next) => {
  try {
    const challenge = await prisma.challenge.findUnique({
      where:   { id: req.params.id },
      include: {
        creator: AUTHOR_SELECT,
        _count:  { select: { submissions: true } },
        submissions: {
          orderBy: { createdAt: 'desc' },
          take: 50,
          include: {
            author: AUTHOR_SELECT,
            _count: { select: { votes: true } },
          },
        },
      },
    });
    if (!challenge) return res.status(404).json({ message: 'Challenge not found' });
    res.json(challenge);
  } catch (err) { next(err); }
});

// POST /challenges
router.post('/', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { title, prompt, description, category = 'GENERAL', endsAt } = req.body;
    if (!title?.trim())  return res.status(400).json({ message: 'Title is required' });
    if (!prompt?.trim()) return res.status(400).json({ message: 'Prompt is required' });
    if (title.length > 120) return res.status(400).json({ message: 'Title max 120 chars' });

    let parsedEndsAt: Date | null = null;
    if (endsAt) {
      parsedEndsAt = new Date(endsAt);
      if (isNaN(parsedEndsAt.getTime())) return res.status(400).json({ message: 'Invalid deadline date' });
      if (parsedEndsAt <= new Date()) return res.status(400).json({ message: 'Deadline must be in the future' });
    }

    const challenge = await prisma.challenge.create({
      data: {
        title:       title.trim(),
        prompt:      prompt.trim(),
        description: description?.trim(),
        category,
        creatorId:   req.userId!,
        endsAt:      parsedEndsAt,
      },
      include: { creator: AUTHOR_SELECT, _count: { select: { submissions: true } } },
    });

    res.status(201).json(challenge);
  } catch (err) { next(err); }
});

// POST /challenges/:id/submit
router.post('/:id/submit', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { content } = req.body;
    if (!content?.trim()) return res.status(400).json({ message: 'Content is required' });
    if (content.length > 5000) return res.status(400).json({ message: 'Max 5000 chars' });

    const challenge = await prisma.challenge.findUnique({ where: { id: req.params.id } });
    if (!challenge) return res.status(404).json({ message: 'Challenge not found' });
    if (challenge.status !== 'ACTIVE') return res.status(400).json({ message: 'Challenge is closed' });

    const existing = await prisma.challengeSubmission.findUnique({
      where: { authorId_challengeId: { authorId: req.userId!, challengeId: req.params.id } },
    });
    if (existing) return res.status(400).json({ message: 'You already submitted to this challenge' });

    const submission = await prisma.challengeSubmission.create({
      data:    { content: content.trim(), authorId: req.userId!, challengeId: req.params.id },
      include: { author: AUTHOR_SELECT, _count: { select: { votes: true } } },
    });

    notify({
      type:        'CHALLENGE_SUBMISSION',
      recipientId: challenge.creatorId,
      actorId:     req.userId!,
    }).catch(() => {});

    res.status(201).json(submission);
  } catch (err) { next(err); }
});

// POST /challenges/:id/submissions/:subId/vote — toggle
router.post('/:id/submissions/:subId/vote', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const userId       = req.userId!;
    const submissionId = req.params.subId;

    const sub = await prisma.challengeSubmission.findUnique({ where: { id: submissionId }, select: { authorId: true } });
    if (!sub) return res.status(404).json({ message: 'Submission not found' });
    if (sub.authorId === userId) return res.status(400).json({ message: 'You cannot vote for your own submission' });

    const existing = await prisma.challengeVote.findUnique({
      where: { userId_submissionId: { userId, submissionId } },
    });

    if (existing) {
      await prisma.challengeVote.delete({ where: { userId_submissionId: { userId, submissionId } } });
    } else {
      await prisma.challengeVote.create({ data: { userId, submissionId } });
    }

    const count = await prisma.challengeVote.count({ where: { submissionId } });
    res.json({ voted: !existing, count });
  } catch (err) { next(err); }
});

// DELETE /challenges/:id/submissions/:subId
router.delete('/:id/submissions/:subId', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const sub = await prisma.challengeSubmission.findUnique({ where: { id: req.params.subId } });
    if (!sub) return res.status(404).json({ message: 'Not found' });
    if (sub.authorId !== req.userId) return res.status(403).json({ message: 'Forbidden' });
    await prisma.challengeSubmission.delete({ where: { id: req.params.subId } });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

export default router;
