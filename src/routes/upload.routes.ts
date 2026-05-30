import { Router } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { validateFile, generatePresignedUrl } from '../services/r2Service';

const router = Router();

router.post('/presign', authenticate, async (req: AuthRequest, res) => {
  try {
    const { mimeType, fileSize } = req.body;

    if (!mimeType || !fileSize) {
      return res.status(400).json({ message: 'mimeType and fileSize are required' });
    }

    const error = validateFile(mimeType, Number(fileSize));
    if (error) {
      return res.status(400).json({ message: error });
    }

    const { uploadUrl, publicUrl, key } = await generatePresignedUrl(mimeType, Number(fileSize));

    res.json({ uploadUrl, publicUrl, key });
  } catch (err: any) {
    console.error('❌ Presign error:', err.message);
    res.status(500).json({ message: 'Failed to generate upload URL' });
  }
});

export default router;
