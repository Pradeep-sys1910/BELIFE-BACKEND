import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

router.put('/profile', authenticate, async (req: AuthRequest, res) => {
  const { name, bio, avatar } = req.body;
  const user = await prisma.user.update({
    where: { id: req.userId },
    data: { name, bio, avatar },
    select: { id: true, name: true, email: true, bio: true, avatar: true },
  });
  res.json(user);
});

export default router;