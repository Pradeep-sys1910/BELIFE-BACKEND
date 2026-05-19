import { Router } from 'express';
import * as blog from '../controllers/blogController';
import { authenticate } from '../middleware/auth';

const router = Router();
router.get('/', blog.getAllBlogs);
router.get('/:slug', blog.getBlogBySlug);
router.post('/', authenticate, blog.createBlog);
router.post('/:id/like', authenticate, blog.toggleLike);
router.put('/:id', authenticate, blog.updateBlog);
router.delete('/:id', authenticate, blog.deleteBlog);

export default router;