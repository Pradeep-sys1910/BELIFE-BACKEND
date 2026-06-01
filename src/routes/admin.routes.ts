import { Router, Request } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma';
import { adminAuthenticate, signAdminToken, AdminRequest } from '../middleware/adminAuth';

const router = Router();

async function logAction(adminId: string, action: string, targetId: string, targetType: string, note: string | null, ip: string | undefined) {
  await prisma.adminLog.create({ data: { adminId, action, targetId, targetType, note, ip } }).catch(() => {});
}

// POST /admin/login
router.post('/login', async (req: Request, res) => {
  try {
    const { email, password, passcode } = req.body;
    if (!email || !password || !passcode) {
      return res.status(400).json({ message: 'Email, password, and passcode are required' });
    }

    const ADMIN_PASSCODE = process.env.ADMIN_PASSCODE;
    if (!ADMIN_PASSCODE) return res.status(500).json({ message: 'Admin panel not configured' });
    if (passcode !== ADMIN_PASSCODE) return res.status(401).json({ message: 'Invalid credentials' });

    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
    if (!user || user.role !== 'ADMIN') return res.status(401).json({ message: 'Invalid credentials' });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ message: 'Invalid credentials' });

    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.socket.remoteAddress;
    await logAction(user.id, 'ADMIN_LOGIN', user.id, 'USER', null, ip);

    const token = signAdminToken(user.id);
    res.json({ token, admin: { id: user.id, name: user.name, email: user.email } });
  } catch (err) {
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /admin/me
router.get('/me', adminAuthenticate, async (req: AdminRequest, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.adminId },
      select: { id: true, name: true, email: true, role: true },
    });
    res.json(user);
  } catch { res.status(500).json({ message: 'Internal server error' }); }
});

// GET /admin/stats
router.get('/stats', adminAuthenticate, async (_req, res) => {
  try {
    const [users, blogs, thoughts, campaigns, challenges, banned] = await Promise.all([
      prisma.user.count(),
      prisma.blog.count(),
      prisma.thought.count(),
      prisma.campaign.count(),
      prisma.challenge.count(),
      prisma.user.count({ where: { banned: true } }),
    ]);
    res.json({ users, blogs, thoughts, campaigns, challenges, banned });
  } catch { res.status(500).json({ message: 'Internal server error' }); }
});

// GET /admin/users?page=1&search=
router.get('/users', adminAuthenticate, async (req: AdminRequest, res) => {
  try {
    const page   = Math.max(1, parseInt(req.query.page as string) || 1);
    const search = (req.query.search as string || '').trim();
    const limit  = 20;
    const skip   = (page - 1) * limit;

    const where: any = {};
    if (search) where.OR = [
      { name:     { contains: search, mode: 'insensitive' } },
      { email:    { contains: search, mode: 'insensitive' } },
      { username: { contains: search, mode: 'insensitive' } },
    ];

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where, skip, take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, name: true, username: true, email: true, role: true,
          banned: true, bannedReason: true, bannedAt: true, verified: true,
          createdAt: true, storageUsedBytes: true,
          _count: { select: { blogs: true, followers: true } },
        },
      }),
      prisma.user.count({ where }),
    ]);

    res.json({ users, total, page, pages: Math.ceil(total / limit) });
  } catch { res.status(500).json({ message: 'Internal server error' }); }
});

// PATCH /admin/users/:id/ban
router.patch('/users/:id/ban', adminAuthenticate, async (req: AdminRequest, res) => {
  try {
    const { banned, reason } = req.body;
    const target = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!target) return res.status(404).json({ message: 'User not found' });
    if (target.role === 'ADMIN') return res.status(400).json({ message: 'Cannot ban another admin' });

    await prisma.user.update({
      where: { id: req.params.id },
      data: {
        banned: !!banned,
        bannedAt:     banned ? new Date() : null,
        bannedReason: banned ? (reason || 'Violation of community guidelines') : null,
      },
    });

    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.socket.remoteAddress;
    await logAction(req.adminId!, banned ? 'BAN_USER' : 'UNBAN_USER', req.params.id, 'USER', reason || null, ip);

    res.json({ ok: true, banned: !!banned });
  } catch { res.status(500).json({ message: 'Internal server error' }); }
});

// PATCH /admin/users/:id/role
router.patch('/users/:id/role', adminAuthenticate, async (req: AdminRequest, res) => {
  try {
    const { role } = req.body;
    if (!['USER', 'AUTHOR', 'ADMIN'].includes(role)) {
      return res.status(400).json({ message: 'Invalid role' });
    }
    await prisma.user.update({ where: { id: req.params.id }, data: { role } });
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.socket.remoteAddress;
    await logAction(req.adminId!, 'CHANGE_ROLE', req.params.id, 'USER', `role → ${role}`, ip);
    res.json({ ok: true });
  } catch { res.status(500).json({ message: 'Internal server error' }); }
});

// DELETE /admin/users/:id
router.delete('/users/:id', adminAuthenticate, async (req: AdminRequest, res) => {
  try {
    const target = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!target) return res.status(404).json({ message: 'User not found' });
    if (target.role === 'ADMIN') return res.status(400).json({ message: 'Cannot delete another admin' });
    await prisma.user.delete({ where: { id: req.params.id } });
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.socket.remoteAddress;
    await logAction(req.adminId!, 'DELETE_USER', req.params.id, 'USER', target.email, ip);
    res.json({ ok: true });
  } catch { res.status(500).json({ message: 'Internal server error' }); }
});

// GET /admin/content?type=blogs&page=1
router.get('/content', adminAuthenticate, async (req: AdminRequest, res) => {
  try {
    const type  = (req.query.type as string) || 'blogs';
    const page  = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = 20;
    const skip  = (page - 1) * limit;

    if (type === 'blogs') {
      const [items, total] = await Promise.all([
        prisma.blog.findMany({
          skip, take: limit, orderBy: { createdAt: 'desc' },
          include: { author: { select: { id: true, name: true, username: true } } },
        }),
        prisma.blog.count(),
      ]);
      return res.json({ items, total, page, pages: Math.ceil(total / limit) });
    }

    if (type === 'thoughts') {
      const [items, total] = await Promise.all([
        prisma.thought.findMany({
          skip, take: limit, orderBy: { createdAt: 'desc' },
          include: { author: { select: { id: true, name: true, username: true } } },
        }),
        prisma.thought.count(),
      ]);
      return res.json({ items, total, page, pages: Math.ceil(total / limit) });
    }

    if (type === 'campaigns') {
      const [items, total] = await Promise.all([
        prisma.campaign.findMany({
          skip, take: limit, orderBy: { createdAt: 'desc' },
          include: { creator: { select: { id: true, name: true, username: true } } },
        }),
        prisma.campaign.count(),
      ]);
      return res.json({ items, total, page, pages: Math.ceil(total / limit) });
    }

    if (type === 'challenges') {
      const [items, total] = await Promise.all([
        prisma.challenge.findMany({
          skip, take: limit, orderBy: { createdAt: 'desc' },
          include: { creator: { select: { id: true, name: true, username: true } } },
        }),
        prisma.challenge.count(),
      ]);
      return res.json({ items, total, page, pages: Math.ceil(total / limit) });
    }

    res.status(400).json({ message: 'Invalid content type' });
  } catch { res.status(500).json({ message: 'Internal server error' }); }
});

// DELETE /admin/content/:type/:id
router.delete('/content/:type/:id', adminAuthenticate, async (req: AdminRequest, res) => {
  try {
    const { type, id } = req.params;
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.socket.remoteAddress;

    if (type === 'blogs') {
      await prisma.blog.delete({ where: { id } });
      await logAction(req.adminId!, 'DELETE_BLOG', id, 'BLOG', null, ip);
    } else if (type === 'thoughts') {
      await prisma.thought.delete({ where: { id } });
      await logAction(req.adminId!, 'DELETE_THOUGHT', id, 'THOUGHT', null, ip);
    } else if (type === 'campaigns') {
      await prisma.campaign.delete({ where: { id } });
      await logAction(req.adminId!, 'DELETE_CAMPAIGN', id, 'CAMPAIGN', null, ip);
    } else if (type === 'challenges') {
      await prisma.challenge.delete({ where: { id } });
      await logAction(req.adminId!, 'DELETE_CHALLENGE', id, 'CHALLENGE', null, ip);
    } else {
      return res.status(400).json({ message: 'Invalid content type' });
    }

    res.json({ ok: true });
  } catch { res.status(500).json({ message: 'Not found or already deleted' }); }
});

// GET /admin/logs?page=1
router.get('/logs', adminAuthenticate, async (req: AdminRequest, res) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = 50;
    const skip  = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      prisma.adminLog.findMany({ skip, take: limit, orderBy: { createdAt: 'desc' } }),
      prisma.adminLog.count(),
    ]);

    res.json({ logs, total, page, pages: Math.ceil(total / limit) });
  } catch { res.status(500).json({ message: 'Internal server error' }); }
});

export default router;
