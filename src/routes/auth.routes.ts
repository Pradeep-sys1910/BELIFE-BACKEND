import { Router } from 'express';
import * as auth from '../controllers/authController';
import { authenticate } from '../middleware/auth';

const router = Router();

router.post('/register', auth.register);
router.post('/login', auth.login);
router.get('/verify-email/:token', auth.verifyEmail);
router.post('/forgot-password', auth.forgotPassword);
router.post('/reset-password', auth.resetPassword);
router.post('/resend-verification', auth.resendVerification);
router.get('/me', authenticate, auth.me);

export default router;