import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';

import authRoutes from './routes/auth.routes';
import blogRoutes from './routes/blog.routes';
import categoryRoutes from './routes/category.routes';
import newsletterRoutes from './routes/newsletter.routes';
import userRoutes from './routes/user.routes';
import uploadRoutes from './routes/upload.routes';
import messageRoutes from './routes/message.routes';
import forumRoutes from './routes/forum.routes';
import groupRoutes from './routes/group.routes';
import { errorHandler } from './middleware/errorHandler';
import { initSocket } from './socket';

dotenv.config();

const app = express();
const httpServer = createServer(app);
initSocket(httpServer);
const PORT = process.env.PORT || 5000;

app.set('trust proxy', 1); // Required for Render/reverse proxy deployments
app.use(helmet());

const allowedOrigins = [
  'https://belife.site',
  'https://www.belife.site',
  'http://localhost:3000',
];
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());
app.use(morgan('dev'));

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100 });
app.use('/api', limiter);

// Stricter limits on auth endpoints to block brute-force attacks
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 20,
  message: { message: 'Too many attempts, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});
const forgotLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  message: { message: 'Too many reset requests, please try again in an hour.' },
  standardHeaders: true,
  legacyHeaders: false,
});

app.get('/health', (_, res) => res.json({ status: '🌿 BeLife API is healthy' }));

app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth/forgot-password', forgotLimiter);
app.use('/api/auth', authRoutes);
app.use('/api/blogs', blogRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/newsletter', newsletterRoutes);
app.use('/api/users', userRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/forum', forumRoutes);
app.use('/api/groups', groupRoutes);

app.use(errorHandler);

httpServer.listen(PORT, () => {
  console.log(`🌿 BeLife API running on port ${PORT}`);
});