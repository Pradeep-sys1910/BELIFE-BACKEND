import express from 'express';
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
import { errorHandler } from './middleware/errorHandler';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());
app.use(morgan('dev'));

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100 });
app.use('/api', limiter);

app.get('/health', (_, res) => res.json({ status: '🌿 BeLife API is healthy' }));

app.use('/api/auth', authRoutes);
app.use('/api/blogs', blogRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/newsletter', newsletterRoutes);
app.use('/api/users', userRoutes);

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`🌿 BeLife API running on port ${PORT}`);
});