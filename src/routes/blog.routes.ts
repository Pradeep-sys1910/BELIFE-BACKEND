import { Router } from 'express';
import * as blog from '../controllers/blogController';
import { authenticate, AuthRequest } from '../middleware/auth';
import { prisma } from '../lib/prisma';

const router = Router();
router.get('/', blog.getAllBlogs);

// GET /blogs/following — personalized feed from followed users
router.get('/following', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { page = '1' } = req.query as Record<string, string>;
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limit = 10;
    const skip = (pageNum - 1) * limit;

    const follows = await prisma.follow.findMany({
      where: { followerId: req.userId! },
      select: { followingId: true },
    });

    const followingIds = follows.map(f => f.followingId);

    if (followingIds.length === 0) {
      return res.json({ blogs: [], total: 0, page: pageNum, pages: 0 });
    }

    const [blogs, total] = await Promise.all([
      prisma.blog.findMany({
        where: { published: true, authorId: { in: followingIds } },
        skip,
        take: limit,
        include: {
          author: { select: { name: true, username: true, avatar: true } },
          category: true,
          _count: { select: { likes: true, comments: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.blog.count({ where: { published: true, authorId: { in: followingIds } } }),
    ]);

    res.json({ blogs, total, page: pageNum, pages: Math.ceil(total / limit) });
  } catch (err) { next(err); }
});

router.get('/:slug', blog.getBlogBySlug);
router.post('/', authenticate, blog.createBlog);
router.post('/:id/like', authenticate, blog.toggleLike);
router.post('/:id/comments', authenticate, blog.addComment);
router.delete('/:id/comments/:commentId', authenticate, blog.deleteComment);
router.put('/:id', authenticate, blog.updateBlog);
router.delete('/:id', authenticate, blog.deleteBlog);

// POST /blogs/:id/bookmark — toggle save/unsave
router.post('/:id/bookmark', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.userId!;
    const blogId = req.params.id;

    const existing = await prisma.bookmark.findUnique({
      where: { userId_blogId: { userId, blogId } },
    });

    if (existing) {
      await prisma.bookmark.delete({ where: { userId_blogId: { userId, blogId } } });
    } else {
      await prisma.bookmark.create({ data: { userId, blogId } });
    }

    const count = await prisma.bookmark.count({ where: { blogId } });
    res.json({ bookmarked: !existing, count });
  } catch (err) { next(err); }
});

export default router;