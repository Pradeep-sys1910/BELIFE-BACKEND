import { Router, NextFunction } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { validateFile, generatePresignedUrl } from '../services/r2Service';
import { prisma } from '../lib/prisma';

const router = Router();

const TWO_GB = 2 * 1024 * 1024 * 1024; // 2,147,483,648 bytes

router.post('/presign', authenticate, async (req: AuthRequest, res, next: NextFunction) => {
  try {
    const { mimeType, fileSize } = req.body;

    if (!mimeType || !fileSize) {
      return res.status(400).json({ message: 'mimeType and fileSize are required' });
    }

    const size = Number(fileSize);
    if (isNaN(size) || size <= 0) {
      return res.status(400).json({ message: 'Invalid file size' });
    }

    const error = validateFile(mimeType, size);
    if (error) return res.status(400).json({ message: error });

    // Check user's current storage usage
    const user = await prisma.user.findUnique({
      where: { id: req.userId! },
      select: { storageUsedBytes: true },
    });

    if (!user) return res.status(401).json({ message: 'User not found' });

    if (user.storageUsedBytes + size > TWO_GB) {
      const usedMB = (user.storageUsedBytes / (1024 * 1024)).toFixed(1);
      const limitGB = 2;
      return res.status(400).json({
        message: `Storage limit reached. You've used ${usedMB} MB of your ${limitGB} GB limit.`,
      });
    }

    // Reserve storage optimistically before upload
    await prisma.user.update({
      where: { id: req.userId! },
      data: { storageUsedBytes: { increment: size } },
    });

    const { uploadUrl, publicUrl, key } = await generatePresignedUrl(mimeType, size);

    res.json({ uploadUrl, publicUrl, key, storageUsed: user.storageUsedBytes + size, storageLimit: TWO_GB });
  } catch (err) {
    next(err);
  }
});

// GET /upload/storage — let the user see their own usage
router.get('/storage', authenticate, async (req: AuthRequest, res, next: NextFunction) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId! },
      select: { storageUsedBytes: true },
    });
    if (!user) return res.status(401).json({ message: 'User not found' });

    res.json({
      usedBytes: user.storageUsedBytes,
      limitBytes: TWO_GB,
      usedMB: +(user.storageUsedBytes / (1024 * 1024)).toFixed(2),
      limitGB: 2,
      percentUsed: +((user.storageUsedBytes / TWO_GB) * 100).toFixed(1),
    });
  } catch (err) {
    next(err);
  }
});

export default router;
