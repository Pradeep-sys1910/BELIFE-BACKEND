import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { getConversations, getMessages, sendMessage } from '../controllers/messageController';

const router = Router();

router.get('/', authenticate, getConversations);
router.get('/:userId', authenticate, getMessages);
router.post('/:userId', authenticate, sendMessage);

export default router;
