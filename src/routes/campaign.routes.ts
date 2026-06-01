import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';
import { notify } from '../lib/notify';

const router = Router();

const AUTHOR_SELECT = { select: { id: true, name: true, username: true, avatar: true } };

const slugify = (t: string) =>
  t.toLowerCase().trim().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-');

// GET /campaigns
router.get('/', async (req, res, next) => {
  try {
    const { category, status = 'ACTIVE', page = '1', search } = req.query as Record<string, string>;
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limit   = 12;
    const skip    = (pageNum - 1) * limit;

    const where: any = { status };
    if (category && category !== 'ALL') where.category = category;
    if (search) where.title = { contains: search, mode: 'insensitive' };

    const [campaigns, total] = await Promise.all([
      prisma.campaign.findMany({
        where, skip, take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          creator: AUTHOR_SELECT,
          _count: { select: { supporters: true } },
        },
      }),
      prisma.campaign.count({ where }),
    ]);

    res.json({ campaigns, total, page: pageNum, pages: Math.ceil(total / limit) });
  } catch (err) { next(err); }
});

// GET /campaigns/:slug
router.get('/:slug', async (req, res, next) => {
  try {
    const campaign = await prisma.campaign.findUnique({
      where:   { slug: req.params.slug },
      include: {
        creator: AUTHOR_SELECT,
        updates: { orderBy: { createdAt: 'desc' } },
        _count:  { select: { supporters: true } },
      },
    });
    if (!campaign) return res.status(404).json({ message: 'Campaign not found' });
    res.json(campaign);
  } catch (err) { next(err); }
});

// POST /campaigns
router.post('/', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { title, description, goal, image, category = 'GENERAL', targetCount = 100 } = req.body;
    if (!title?.trim())       return res.status(400).json({ message: 'Title is required' });
    if (!description?.trim()) return res.status(400).json({ message: 'Description is required' });
    if (!goal?.trim())        return res.status(400).json({ message: 'Goal is required' });
    if (title.length > 120)   return res.status(400).json({ message: 'Title max 120 chars' });

    const slug = `${slugify(title)}-${Date.now()}`;

    const campaign = await prisma.campaign.create({
      data: {
        title: title.trim(), slug, description: description.trim(),
        goal: goal.trim(), image, category,
        targetCount: Math.min(Math.max(1, Number(targetCount) || 100), 1_000_000),
        creatorId: req.userId!,
        supporters: { create: { userId: req.userId! } },
      },
      include: { creator: AUTHOR_SELECT, _count: { select: { supporters: true } } },
    });

    res.status(201).json(campaign);
  } catch (err) { next(err); }
});

// POST /campaigns/:id/support — toggle
router.post('/:id/support', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const campaign = await prisma.campaign.findUnique({ where: { id: req.params.id } });
    if (!campaign) return res.status(404).json({ message: 'Campaign not found' });

    const existing = await prisma.campaignSupport.findUnique({
      where: { userId_campaignId: { userId: req.userId!, campaignId: req.params.id } },
    });

    if (existing) {
      if (campaign.creatorId === req.userId) {
        return res.status(400).json({ message: 'Creators cannot unsupport their own campaign' });
      }
      await prisma.campaignSupport.delete({
        where: { userId_campaignId: { userId: req.userId!, campaignId: req.params.id } },
      });
    } else {
      await prisma.campaignSupport.create({
        data: { userId: req.userId!, campaignId: req.params.id },
      });
      notify({
        type:        'CAMPAIGN_SUPPORT',
        recipientId: campaign.creatorId,
        actorId:     req.userId!,
      }).catch(() => {});
    }

    const count = await prisma.campaignSupport.count({ where: { campaignId: req.params.id } });
    res.json({ supporting: !existing, count });
  } catch (err) { next(err); }
});

// GET /campaigns/:id/support-status
router.get('/:id/support-status', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const record = await prisma.campaignSupport.findUnique({
      where: { userId_campaignId: { userId: req.userId!, campaignId: req.params.id } },
    });
    res.json({ supporting: !!record });
  } catch (err) { next(err); }
});

// POST /campaigns/:id/updates — creator only
router.post('/:id/updates', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { content } = req.body;
    if (!content?.trim()) return res.status(400).json({ message: 'Content is required' });
    if (content.length > 2000) return res.status(400).json({ message: 'Max 2000 chars' });

    const campaign = await prisma.campaign.findUnique({ where: { id: req.params.id } });
    if (!campaign) return res.status(404).json({ message: 'Campaign not found' });
    if (campaign.creatorId !== req.userId) return res.status(403).json({ message: 'Forbidden' });

    const update = await prisma.campaignUpdate.create({
      data: { content: content.trim(), campaignId: req.params.id },
    });
    res.status(201).json(update);
  } catch (err) { next(err); }
});

export default router;
