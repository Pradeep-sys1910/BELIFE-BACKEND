import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma';
import { notify } from '../lib/notify';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

function validateProfileFields(name: any, bio: any, avatar: any): string | null {
  if (name !== undefined) {
    if (typeof name !== 'string' || name.trim().length < 2) return 'Name must be at least 2 characters';
    if (name.length > 100) return 'Name max 100 characters';
  }
  if (bio !== undefined && bio !== null) {
    if (typeof bio !== 'string') return 'Bio must be a string';
    if (bio.length > 500) return 'Bio max 500 characters';
  }
  if (avatar !== undefined && avatar !== null) {
    if (typeof avatar !== 'string') return 'Avatar must be a URL string';
    if (avatar.length > 500) return 'Avatar URL too long';
    if (!avatar.startsWith('https://')) return 'Avatar must be a secure HTTPS URL';
  }
  return null;
}

router.patch('/profile', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { name, bio, avatar } = req.body;
    const err = validateProfileFields(name, bio, avatar);
    if (err) return res.status(400).json({ message: err });
    const user = await prisma.user.update({
      where: { id: req.userId },
      data: { name: name?.trim(), bio, avatar },
      select: { id: true, name: true, email: true, bio: true, avatar: true },
    });
    res.json(user);
  } catch (err) { next(err); }
});

// Keep PUT for backwards compat
router.put('/profile', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { name, bio, avatar } = req.body;
    const err = validateProfileFields(name, bio, avatar);
    if (err) return res.status(400).json({ message: err });
    const user = await prisma.user.update({
      where: { id: req.userId },
      data: { name: name?.trim(), bio, avatar },
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

const PREF_KEYS = [
  'notifyLikes', 'notifyComments', 'notifyFollowers',
  'emailWeeklyDigest', 'publicProfile', 'showEmail', 'allowMessages',
] as const;
const PREF_SELECT = Object.fromEntries(PREF_KEYS.map(k => [k, true]));

// GET /users/preferences — current user's settings
router.get('/preferences', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const prefs = await prisma.user.findUnique({ where: { id: req.userId }, select: PREF_SELECT });
    if (!prefs) return res.status(404).json({ message: 'User not found' });
    res.json(prefs);
  } catch (err) { next(err); }
});

// PATCH /users/preferences — update any subset of boolean settings
router.patch('/preferences', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const data: Record<string, boolean> = {};
    for (const key of PREF_KEYS) {
      if (typeof req.body[key] === 'boolean') data[key] = req.body[key];
    }
    if (Object.keys(data).length === 0) {
      return res.status(400).json({ message: 'No valid preferences provided' });
    }
    const updated = await prisma.user.update({ where: { id: req.userId }, data, select: PREF_SELECT });
    res.json(updated);
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
      notify({ type: 'FOLLOW', recipientId: followingId, actorId: followerId }).catch(() => {});
    }

    const followerCount = await prisma.follow.count({ where: { followingId } });
    res.json({ following: !existing, followerCount });
  } catch (err) { next(err); }
});

// GET /users/:username/profile — public profile with follower/following counts
router.get('/:username/profile', async (req, res, next) => {
  try {
    // Optional auth: figure out if the viewer is the profile owner.
    let viewerId: string | null = null;
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      try { viewerId = (jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET!) as { id: string }).id; }
      catch { /* ignore bad token — treat as anonymous */ }
    }

    const user = await prisma.user.findUnique({
      where: { username: req.params.username },
      select: {
        id: true, name: true, username: true, bio: true, avatar: true, email: true, createdAt: true,
        publicProfile: true, showEmail: true,
        _count: { select: { followers: true, following: true } },
      },
    });
    if (!user) return res.status(404).json({ message: 'User not found' });

    const isOwner = viewerId === user.id;

    // Private profile — hide everything but basic identity from non-owners.
    if (!user.publicProfile && !isOwner) {
      return res.json({
        user: {
          id: user.id, name: user.name, username: user.username, avatar: user.avatar,
          bio: null, createdAt: user.createdAt, _count: user._count,
        },
        blogs: [],
        private: true,
      });
    }

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

    // Strip internal flags; only expose email if opted in (or to the owner).
    const { publicProfile, showEmail, email, ...safeUser } = user;
    const responseUser = (showEmail || isOwner) ? { ...safeUser, email } : safeUser;

    res.json({ user: responseUser, blogs });
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

// POST /users/onboard — complete onboarding (follow selected users, mark done)
router.post('/onboard', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { followIds = [] } = req.body;
    const userId = req.userId!;

    // Follow selected users (ignore self + already following)
    if (Array.isArray(followIds) && followIds.length > 0) {
      const toFollow = (followIds as string[]).filter(id => id !== userId).slice(0, 20);
      await Promise.allSettled(
        toFollow.map(followingId =>
          prisma.follow.upsert({
            where: { followerId_followingId: { followerId: userId, followingId } },
            create: { followerId: userId, followingId },
            update: {},
          })
        )
      );
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: { onboarded: true },
      select: { id: true, name: true, username: true, email: true, avatar: true, bio: true, verified: true, onboarded: true },
    });

    res.json({ user });
  } catch (err) { next(err); }
});

// GET /users/suggested — people to follow (excludes self + already following)
router.get('/suggested', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.userId!;

    const alreadyFollowing = await prisma.follow.findMany({
      where: { followerId: userId },
      select: { followingId: true },
    });
    const excludeIds = [userId, ...alreadyFollowing.map(f => f.followingId)];

    const users = await prisma.user.findMany({
      where: { id: { notIn: excludeIds }, verified: true },
      select: {
        id: true, name: true, username: true, avatar: true, bio: true,
        _count: { select: { followers: true, blogs: true } },
      },
      orderBy: { createdAt: 'asc' },
      take: 12,
    });

    res.json(users);
  } catch (err) { next(err); }
});

export default router;
