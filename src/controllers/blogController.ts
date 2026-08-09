import { Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { notify } from '../lib/notify';
import { AuthRequest } from '../middleware/auth';

const slugify = (text: string) =>
  text.toLowerCase().trim().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-');

// Keep only valid, secure attachment URLs (max 10).
const sanitizeAttachments = (input: unknown): string[] => {
  if (!Array.isArray(input)) return [];
  return input
    .filter((u): u is string => typeof u === 'string' && u.startsWith('https://') && u.length <= 500)
    .slice(0, 10);
};

export const createBlog = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { title, excerpt, content, image, categoryId, tags, readTime, attachments } = req.body;
    if (!title?.trim())        return res.status(400).json({ message: 'Title is required' });
    if (title.length > 200)    return res.status(400).json({ message: 'Title max 200 chars' });
    if (content?.length > 100_000) return res.status(400).json({ message: 'Content max 100,000 chars' });
    const slug = `${slugify(title)}-${Date.now()}`;

    const blog = await prisma.blog.create({
      data: {
        title, slug, excerpt, content, image, categoryId,
        tags: tags || [], readTime: readTime || 5,
        attachments: sanitizeAttachments(attachments),
        authorId: req.userId!, published: true,
      },
      include: { author: { select: { name: true, username: true, avatar: true } }, category: true },
    });
    res.status(201).json(blog);
  } catch (err) { next(err); }
};

export const getAllBlogs = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { page = 1, limit = 10, category, search, author, seed } = req.query;
    const pageNum  = Math.max(1, Number(page) || 1);
    const limitNum = Math.min(Number(limit) || 10, 50);
    const skip     = (pageNum - 1) * limitNum;

    const where: any = { published: true };
    if (category) where.category = { slug: category };
    if (author)   where.authorId = author as string;
    if (search)   where.OR = [
      { title:   { contains: search as string, mode: 'insensitive' } },
      { excerpt: { contains: search as string, mode: 'insensitive' } },
    ];

    // Shuffled feed: when a seed is supplied (home feed), vary the order on each
    // open/refresh while staying paginatable. Pull a recent pool and deterministically
    // shuffle it by the seed. Only for the plain feed (not search / author filters).
    if (seed && !search && !author) {
      const POOL = 80;
      const pool = await prisma.blog.findMany({
        where, take: POOL,
        include: {
          author:   { select: { name: true, username: true, avatar: true } },
          category: true,
          _count:   { select: { likes: true, comments: true } },
        },
        orderBy: { createdAt: 'desc' },
      });
      const shuffled  = seededShuffle(pool, String(seed));
      const pageItems = shuffled.slice(skip, skip + limitNum);
      return res.json({
        blogs: await withUserState(pageItems, req.userId),
        total: pool.length, page: pageNum, pages: Math.ceil(pool.length / limitNum),
      });
    }

    const [blogs, total] = await Promise.all([
      prisma.blog.findMany({
        where, skip, take: limitNum,
        include: {
          author:   { select: { name: true, username: true, avatar: true } },
          category: true,
          _count:   { select: { likes: true, comments: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.blog.count({ where }),
    ]);

    res.json({ blogs: await withUserState(blogs, req.userId), total, page: pageNum, pages: Math.ceil(total / limitNum) });
  } catch (err) { next(err); }
};

/**
 * Attach `isLiked` / `isBookmarked` to each blog for the current user (if any),
 * so the app can render the correct heart/bookmark state on first paint.
 * Anonymous requests get both flags as false.
 */
async function withUserState<T extends { id: string }>(blogs: T[], userId?: string) {
  if (!userId || blogs.length === 0) {
    return blogs.map(b => ({ ...b, isLiked: false, isBookmarked: false }));
  }
  const blogIds = blogs.map(b => b.id);
  const [likes, bookmarks] = await Promise.all([
    prisma.like.findMany({ where: { userId, blogId: { in: blogIds } }, select: { blogId: true } }),
    prisma.bookmark.findMany({ where: { userId, blogId: { in: blogIds } }, select: { blogId: true } }),
  ]);
  const liked = new Set(likes.map(l => l.blogId));
  const saved = new Set(bookmarks.map(b => b.blogId));
  return blogs.map(b => ({ ...b, isLiked: liked.has(b.id), isBookmarked: saved.has(b.id) }));
}

/** Deterministic, seed-driven Fisher-Yates shuffle (mulberry32 PRNG seeded by the string). */
function seededShuffle<T>(arr: T[], seed: string): T[] {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  const rand = () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const getBlogBySlug = async (req: AuthRequest, res: Response, _next: NextFunction) => {
  try {
    const blog = await prisma.blog.update({
      where: { slug: req.params.slug },
      data:  { views: { increment: 1 } },
      include: {
        author:   { select: { id: true, name: true, username: true, avatar: true, bio: true } },
        category: true,
        comments: {
          include: { author: { select: { id: true, name: true, avatar: true } } },
          orderBy: { createdAt: 'desc' },
        },
        _count: { select: { likes: true } },
      },
    });

    let isLiked = false, isBookmarked = false;
    if (req.userId) {
      const [like, bookmark] = await Promise.all([
        prisma.like.findUnique({ where: { userId_blogId: { userId: req.userId, blogId: blog.id } } }),
        prisma.bookmark.findUnique({ where: { userId_blogId: { userId: req.userId, blogId: blog.id } } }),
      ]);
      isLiked = !!like;
      isBookmarked = !!bookmark;
    }

    res.json({ ...blog, isLiked, isBookmarked });
  } catch { res.status(404).json({ message: 'Blog not found' }); }
};

export const updateBlog = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const blog = await prisma.blog.findUnique({ where: { id: req.params.id } });
    if (!blog || blog.authorId !== req.userId) return res.status(403).json({ message: 'Forbidden' });

    const { title, excerpt, content, image, categoryId, tags, readTime, attachments } = req.body;
    if (title?.length > 200)       return res.status(400).json({ message: 'Title max 200 chars' });
    if (content?.length > 100_000) return res.status(400).json({ message: 'Content max 100,000 chars' });
    const updated = await prisma.blog.update({
      where: { id: req.params.id },
      data:  {
        title, excerpt, content, image, categoryId, tags, readTime,
        ...(attachments !== undefined ? { attachments: sanitizeAttachments(attachments) } : {}),
      },
    });
    res.json(updated);
  } catch (err) { next(err); }
};

export const deleteBlog = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const blog = await prisma.blog.findUnique({ where: { id: req.params.id } });
    if (!blog || blog.authorId !== req.userId) return res.status(403).json({ message: 'Forbidden' });

    await prisma.blog.delete({ where: { id: req.params.id } });
    res.json({ message: 'Blog deleted' });
  } catch (err) { next(err); }
};

export const addComment = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { content } = req.body;
    if (!content?.trim()) return res.status(400).json({ message: 'Content is required' });
    if (content.length > 2000) return res.status(400).json({ message: 'Comment must be under 2000 characters' });

    const blog = await prisma.blog.findUnique({ where: { id: req.params.id } });
    if (!blog) return res.status(404).json({ message: 'Blog not found' });

    const comment = await prisma.comment.create({
      data:    { content: content.trim(), authorId: req.userId!, blogId: req.params.id },
      include: { author: { select: { id: true, name: true, avatar: true } } },
    });

    // Notify blog author of new comment (fire-and-forget)
    notify({ type: 'COMMENT', recipientId: blog.authorId, actorId: req.userId!, blogId: blog.id })
      .catch(() => {});

    res.status(201).json(comment);
  } catch (err) { next(err); }
};

export const deleteComment = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const comment = await prisma.comment.findUnique({ where: { id: req.params.commentId } });
    if (!comment) return res.status(404).json({ message: 'Comment not found' });
    if (comment.authorId !== req.userId) return res.status(403).json({ message: 'Not your comment' });
    await prisma.comment.delete({ where: { id: req.params.commentId } });
    res.json({ message: 'Deleted' });
  } catch (err) { next(err); }
};

export const toggleLike = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id }  = req.params;
    const userId  = req.userId!;

    const existing = await prisma.like.findUnique({
      where: { userId_blogId: { userId, blogId: id } },
    });

    if (existing) {
      await prisma.like.delete({ where: { userId_blogId: { userId, blogId: id } } });
    } else {
      await prisma.like.create({ data: { userId, blogId: id } });

      // Notify blog author of new like (fire-and-forget)
      const blog = await prisma.blog.findUnique({ where: { id }, select: { authorId: true } });
      if (blog) {
        notify({ type: 'LIKE', recipientId: blog.authorId, actorId: userId, blogId: id })
          .catch(() => {});
      }
    }

    const count = await prisma.like.count({ where: { blogId: id } });
    res.json({ liked: !existing, count });
  } catch (err) { next(err); }
};
