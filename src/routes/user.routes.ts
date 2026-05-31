import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

router.patch('/profile', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { name, bio, avatar } = req.body;
    const user = await prisma.user.update({
      where: { id: req.userId },
      data: { name, bio, avatar },
      select: { id: true, name: true, email: true, bio: true, avatar: true },
    });
    res.json(user);
  } catch (err) { next(err); }
});

// Keep PUT for backwards compat
router.put('/profile', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { name, bio, avatar } = req.body;
    const user = await prisma.user.update({
      where: { id: req.userId },
      data: { name, bio, avatar },
      select: { id: true, name: true, email: true, bio: true, avatar: true },
    });
    res.json(user);
  } catch (err) { next(err); }
});

router.patch('/password', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json({ message: 'New password must be at least 8 characters' });
    }

    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user) return res.status(404).json({ message: 'User not found' });

    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) return res.status(401).json({ message: 'Current password is incorrect' });

    const hashed = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({ where: { id: req.userId }, data: { password: hashed } });

    res.json({ message: 'Password updated successfully' });
  } catch (err) { next(err); }
});

router.get('/by-id/:id', async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: { id: true, name: true, username: true, avatar: true, bio: true },
    });
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
  } catch (err) { next(err); }
});

router.get('/search', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const q = (req.query.q as string || '').trim();
    if (!q || q.length < 2) return res.json([]);
    const users = await prisma.user.findMany({
      where: {
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { username: { contains: q, mode: 'insensitive' } },
        ],
      },
      select: { id: true, name: true, username: true, avatar: true, bio: true },
      take: 10,
    });
    res.json(users);
  } catch (err) { next(err); }
});

// GET /users/:id/follow-status — check if current user follows this user
router.get('/:id/follow-status', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const follow = await prisma.follow.findUnique({
      where: { followerId_followingId: { followerId: req.userId!, followingId: req.params.id } },
    });
    res.json({ following: !!follow });
  } catch (err) { next(err); }
});

// POST /users/:id/follow — toggle follow/unfollow
router.post('/:id/follow', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const followingId = req.params.id;
    const followerId = req.userId!;

    if (followerId === followingId) {
      return res.status(400).json({ message: 'You cannot follow yourself' });
    }

    const target = await prisma.user.findUnique({ where: { id: followingId } });
    if (!target) return res.status(404).json({ message: 'User not found' });

    const existing = await prisma.follow.findUnique({
      where: { followerId_followingId: { followerId, followingId } },
    });

    if (existing) {
      await prisma.follow.delete({
        where: { followerId_followingId: { followerId, followingId } },
      });
    } else {
      await prisma.follow.create({ data: { followerId, followingId } });
    }

    const followerCount = await prisma.follow.count({ where: { followingId } });
    res.json({ following: !existing, followerCount });
  } catch (err) { next(err); }
});

// GET /users/:username/profile — public profile with follower/following counts
router.get('/:username/profile', async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { username: req.params.username },
      select: {
        id: true, name: true, username: true, bio: true, avatar: true, createdAt: true,
        _count: { select: { followers: true, following: true } },
      },
    });
    if (!user) return res.status(404).json({ message: 'User not found' });

    const blogs = await prisma.blog.findMany({
      where: { authorId: user.id, published: true },
      select: {
        id: true, title: true, slug: true, excerpt: true, image: true,
        readTime: true, createdAt: true,
        _count: { select: { likes: true, comments: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    res.json({ user, blogs });
  } catch (err) { next(err); }
});

// GET /users/:username/followers — list followers
router.get('/:username/followers', async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { username: req.params.username } });
    if (!user) return res.status(404).json({ message: 'User not found' });

    const follows = await prisma.follow.findMany({
      where: { followingId: user.id },
      select: { follower: { select: { id: true, name: true, username: true, avatar: true, bio: true } } },
      take: 50,
      orderBy: { createdAt: 'desc' },
    });

    res.json(follows.map(f => f.follower));
  } catch (err) { next(err); }
});

// GET /users/:username/following — list who this user follows
router.get('/:username/following', async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { username: req.params.username } });
    if (!user) return res.status(404).json({ message: 'User not found' });

    const follows = await prisma.follow.findMany({
      where: { followerId: user.id },
      select: { following: { select: { id: true, name: true, username: true, avatar: true, bio: true } } },
      take: 50,
      orderBy: { createdAt: 'desc' },
    });

    res.json(follows.map(f => f.following));
  } catch (err) { next(err); }
});

export default router;
