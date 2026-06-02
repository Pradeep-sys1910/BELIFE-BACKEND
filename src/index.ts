import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';

import authRoutes         from './routes/auth.routes';
import blogRoutes         from './routes/blog.routes';
import categoryRoutes     from './routes/category.routes';
import newsletterRoutes   from './routes/newsletter.routes';
import userRoutes         from './routes/user.routes';
import uploadRoutes       from './routes/upload.routes';
import messageRoutes      from './routes/message.routes';
import forumRoutes        from './routes/forum.routes';
import groupRoutes        from './routes/group.routes';
import notificationRoutes from './routes/notification.routes';
import thoughtRoutes      from './routes/thought.routes';
import campaignRoutes     from './routes/campaign.routes';
import challengeRoutes    from './routes/challenge.routes';
import bookmarkRoutes     from './routes/bookmark.routes';
import contactRoutes      from './routes/contact.routes';
import statsRoutes        from './routes/stats.routes';
import adminRoutes        from './routes/admin.routes';
import { errorHandler }   from './middleware/errorHandler';
import { initSocket }     from './socket';

dotenv.config();

// ── Fail-fast env validation ──────────────────────────────────────────────────
// Catch misconfiguration at boot instead of throwing cryptic 500s on every request.
(() => {
  const REQUIRED = ['DATABASE_URL', 'JWT_SECRET'];
  const missing = REQUIRED.filter(k => !process.env[k]?.trim());
  if (missing.length) {
    console.error(`❌ Missing required env vars: ${missing.join(', ')}. Refusing to start.`);
    process.exit(1);
  }
  if ((process.env.JWT_SECRET as string).length < 32) {
    console.error('❌ JWT_SECRET must be at least 32 characters. Refusing to start.');
    process.exit(1);
  }
  // Warn (don't block) on optional-but-important secrets so degraded features are visible.
  const RECOMMENDED = ['ENCRYPTION_SECRET', 'ADMIN_PASSCODE', 'ADMIN_JWT_SECRET'];
  const absent = RECOMMENDED.filter(k => !process.env[k]?.trim());
  if (absent.length) {
    console.warn(`⚠️  Optional env vars not set (feature may be degraded): ${absent.join(', ')}`);
  }
})();

const app        = express();
const httpServer = createServer(app);
initSocket(httpServer);
const PORT = process.env.PORT || 5000;

app.set('trust proxy', 1);
app.use(helmet());

const allowedOrigins = [
  'https://belife.site',
  'https://www.belife.site',
  'http://localhost:3000',
  process.env.ADMIN_ORIGIN || 'http://localhost:3001',
].filter(Boolean);
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) callback(null, true);
    else callback(null, false);
  },
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());
app.use(morgan('dev'));

// Global rate limiter
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100 });
app.use('/api', limiter);

// Stricter auth limits
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 20,
  message:  { message: 'Too many attempts, please try again later.' },
  standardHeaders: true, legacyHeaders: false,
});
const forgotLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, max: 5,
  message:  { message: 'Too many reset requests, please try again in an hour.' },
  standardHeaders: true, legacyHeaders: false,
});
const resendLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, max: 3,
  message:  { message: 'Too many verification emails, please try again in an hour.' },
  standardHeaders: true, legacyHeaders: false,
});
const presignLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, max: 30,
  message:  { message: 'Upload limit reached, please try again later.' },
  standardHeaders: true, legacyHeaders: false,
});
const followLimiter = rateLimit({
  windowMs: 60 * 1000, max: 20,
  message:  { message: 'Too many follow actions, slow down.' },
  standardHeaders: true, legacyHeaders: false,
});
const adminLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, max: 10,
  message:  { message: 'Too many admin login attempts.' },
  standardHeaders: true, legacyHeaders: false,
});
const contactLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, max: 5,
  message:  { message: 'Too many messages sent. Please try again later.' },
  standardHeaders: true, legacyHeaders: false,
});

app.get('/health', (_, res) => res.json({ status: '🌿 BeLife API is healthy' }));

app.use('/api/auth/login',                   authLimiter);
app.use('/api/auth/register',               authLimiter);
app.use('/api/auth/forgot-password',        forgotLimiter);
app.use('/api/auth/resend-verification',    resendLimiter);
app.use('/api/upload/presign',              presignLimiter);
app.use('/api/users',                       followLimiter);

app.use('/api/auth',          authRoutes);
app.use('/api/blogs',         blogRoutes);
app.use('/api/categories',    categoryRoutes);
app.use('/api/newsletter',    newsletterRoutes);
app.use('/api/users',         userRoutes);
app.use('/api/upload',        uploadRoutes);
app.use('/api/messages',      messageRoutes);
app.use('/api/forum',         forumRoutes);
app.use('/api/groups',        groupRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/thoughts',      thoughtRoutes);
app.use('/api/campaigns',     campaignRoutes);
app.use('/api/challenges',    challengeRoutes);
app.use('/api/bookmarks',     bookmarkRoutes);
app.use('/api/contact',       contactLimiter, contactRoutes);
app.use('/api/stats',         statsRoutes);
app.use('/api/admin/login',   adminLimiter);
app.use('/api/admin',         adminRoutes);

app.use(errorHandler);

httpServer.listen(PORT, () => {
  console.log(`🌿 BeLife API running on port ${PORT}`);
});
