import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

const AUTHOR_SELECT = { select: { id: true, name: true, username: true, avatar: true } };

const slugify = (text: string) =>
  text.toLowerCase().trim().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-');

// GET /groups — list all groups
router.get('/', async (req, res, next) => {
  try {
    const { category, search, page = '1' } = req.query as Record<string, string>;
    const limit = 18;
    const pageNum = Math.max(1, parseInt(page) || 1);
    const skip = (pageNum - 1) * limit;

    const where: any = { privacy: 'PUBLIC' };
    if (category && category !== 'ALL') where.category = category;
    if (search) where.name = { contains: search, mode: 'insensitive' };

    const [groups, total] = await Promise.all([
      prisma.group.findMany({
        where, skip, take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, name: true, slug: true, description: true, image: true,
          category: true, privacy: true, createdAt: true,
          creator: AUTHOR_SELECT,
          _count: { select: { members: true, posts: true } },
        },
      }),
      prisma.group.count({ where }),
    ]);

    res.json({ groups, total, page: pageNum, pages: Math.ceil(total / limit) });
  } catch (err) { next(err); }
});

// GET /groups/:slug — group detail + recent posts
router.get('/:slug', async (req, res, next) => {
  try {
    const group = await prisma.group.findUnique({
      where: { slug: req.params.slug },
      include: {
        creator: AUTHOR_SELECT,
        _count: { select: { members: true, posts: true } },
        posts: {
          orderBy: { createdAt: 'desc' },
          take: 20,
          include: {
            author: AUTHOR_SELECT,
            _count: { select: { likes: true } },
          },
        },
      },
    });
    if (!group) return res.status(404).json({ message: 'Group not found' });
    res.json(group);
  } catch (err) { next(err); }
});

// POST /groups — create group (auth)
router.post('/', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { name, description, image, category = 'GENERAL', privacy = 'PUBLIC' } = req.body;
    if (!name?.trim()) return res.status(400).json({ message: 'Name is required' });
    if (name.length > 100) return res.status(400).json({ message: 'Group name must be under 100 characters' });
    if (description && description.length > 1000) return res.status(400).json({ message: 'Description must be under 1000 characters' });

    const slug = `${slugify(name)}-${Date.now()}`;

    const group = await prisma.group.create({
      data: {
        name: name.trim(), slug, description: description?.trim(), image,
        category, privacy, creatorId: req.userId!,
        members: { create: { userId: req.userId!, role: 'ADMIN' } },
      },
      include: { creator: AUTHOR_SELECT, _count: { select: { members: true } } },
    });

    res.status(201).json(group);
  } catch (err) { next(err); }
});

// POST /groups/:id/join — join or leave (toggle)
router.post('/:id/join', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const existing = await prisma.groupMember.findUnique({
      where: { userId_groupId: { userId: req.userId!, groupId: req.params.id } },
    });

    const group = await prisma.group.findUnique({ where: { id: req.params.id } });
    if (!group) return res.status(404).json({ message: 'Group not found' });
    if (group.creatorId === req.userId) return res.status(400).json({ message: 'You are the creator' });

    if (existing) {
      await prisma.groupMember.delete({
        where: { userId_groupId: { userId: req.userId!, groupId: req.params.id } },
      });
    } else {
      await prisma.groupMember.create({
        data: { userId: req.userId!, groupId: req.params.id, role: 'MEMBER' },
      });
    }

    const count = await prisma.groupMember.count({ where: { groupId: req.params.id } });
    res.json({ joined: !existing, count });
  } catch (err) { next(err); }
});

// GET /groups/:id/membership — check if current user is a member
router.get('/:id/membership', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const member = await prisma.groupMember.findUnique({
      where: { userId_groupId: { userId: req.userId!, groupId: req.params.id } },
    });
    res.json({ isMember: !!member, role: member?.role ?? null });
  } catch (err) { next(err); }
});

// POST /groups/:id/posts — create post (auth, members only)
router.post('/:id/posts', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { content } = req.body;
    if (!content?.trim()) return res.status(400).json({ message: 'Content is required' });
    if (content.length > 5000) return res.status(400).json({ message: 'Post must be under 5000 characters' });

    const member = await prisma.groupMember.findUnique({
      where: { userId_groupId: { userId: req.userId!, groupId: req.params.id } },
    });
    if (!member) return res.status(403).json({ message: 'Join the group first' });

    const post = await prisma.groupPost.create({
      data: { content: content.trim(), authorId: req.userId!, groupId: req.params.id },
      include: { author: AUTHOR_SELECT, _count: { select: { likes: true } } },
    });

    res.status(201).json(post);
  } catch (err) { next(err); }
});

// DELETE /groups/:id/posts/:postId — delete own post
router.delete('/:id/posts/:postId', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const post = await prisma.groupPost.findUnique({ where: { id: req.params.postId } });
    if (!post) return res.status(404).json({ message: 'Post not found' });
    if (post.authorId !== req.userId) return res.status(403).json({ message: 'Not your post' });
    await prisma.groupPost.delete({ where: { id: req.params.postId } });
    res.json({ message: 'Deleted' });
  } catch (err) { next(err); }
});

// POST /groups/:id/posts/:postId/like — toggle like
router.post('/:id/posts/:postId/like', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const existing = await prisma.groupPostLike.findUnique({
      where: { userId_postId: { userId: req.userId!, postId: req.params.postId } },
    });

    if (existing) {
      await prisma.groupPostLike.delete({ where: { userId_postId: { userId: req.userId!, postId: req.params.postId } } });
    } else {
      await prisma.groupPostLike.create({ data: { userId: req.userId!, postId: req.params.postId } });
    }

    const count = await prisma.groupPostLike.count({ where: { postId: req.params.postId } });
    res.json({ liked: !existing, count });
  } catch (err) { next(err); }
});

export default router;
