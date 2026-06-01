import { Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { notify } from '../lib/notify';
import { AuthRequest } from '../middleware/auth';

const slugify = (text: string) =>
  text.toLowerCase().trim().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-');

export const createBlog = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { title, excerpt, content, image, categoryId, tags, readTime } = req.body;
    if (!title?.trim())        return res.status(400).json({ message: 'Title is required' });
    if (title.length > 200)    return res.status(400).json({ message: 'Title max 200 chars' });
    if (content?.length > 100_000) return res.status(400).json({ message: 'Content max 100,000 chars' });
    const slug = `${slugify(title)}-${Date.now()}`;

    const blog = await prisma.blog.create({
      data: {
        title, slug, excerpt, content, image, categoryId,
        tags: tags || [], readTime: readTime || 5,
        authorId: req.userId!, published: true,
      },
      include: { author: { select: { name: true, username: true, avatar: true } }, category: true },
    });
    res.status(201).json(blog);
  } catch (err) { next(err); }
};

export const getAllBlogs = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { page = 1, limit = 10, category, search, author } = req.query;
    const pageNum = Math.max(1, Number(page) || 1);
    const skip    = (pageNum - 1) * Math.min(Number(limit) || 10, 50);

    const where: any = { published: true };
    if (category) where.category = { slug: category };
    if (author)   where.authorId = author as string;
    if (search)   where.OR = [
      { title:   { contains: search as string, mode: 'insensitive' } },
      { excerpt: { contains: search as string, mode: 'insensitive' } },
    ];

    const [blogs, total] = await Promise.all([
      prisma.blog.findMany({
        where, skip, take: Math.min(Number(limit) || 10, 50),
        include: {
          author:   { select: { name: true, username: true, avatar: true } },
          category: true,
          _count:   { select: { likes: true, comments: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.blog.count({ where }),
    ]);

    res.json({ blogs, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
  } catch (err) { next(err); }
};

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
    res.json(blog);
  } catch { res.status(404).json({ message: 'Blog not found' }); }
};

export const updateBlog = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const blog = await prisma.blog.findUnique({ where: { id: req.params.id } });
    if (!blog || blog.authorId !== req.userId) return res.status(403).json({ message: 'Forbidden' });

    const { title, excerpt, content, image, categoryId, tags, readTime } = req.body;
    if (title?.length > 200)       return res.status(400).json({ message: 'Title max 200 chars' });
    if (content?.length > 100_000) return res.status(400).json({ message: 'Content max 100,000 chars' });
    const updated = await prisma.blog.update({
      where: { id: req.params.id },
      data:  { title, excerpt, content, image, categoryId, tags, readTime },
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
