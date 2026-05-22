import { Router, NextFunction } from 'express';
import { prisma } from '../lib/prisma';

const router = Router();

router.get('/', async (_, res, next: NextFunction) => {
  try {
    const categories = await prisma.category.findMany({ include: { _count: { select: { blogs: true } } } });
    res.json(categories);
  } catch (err) { next(err); }
});

router.get('/:slug', async (req, res, next: NextFunction) => {
  try {
    const category = await prisma.category.findUnique({
      where: { slug: req.params.slug },
      include: { blogs: { include: { author: true } } },
    });
    if (!category) return res.status(404).json({ message: 'Not found' });
    res.json(category);
  } catch (err) { next(err); }
});

export default router;