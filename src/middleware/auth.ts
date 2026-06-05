import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma';

export interface AuthRequest extends Request {
  userId?: string;
}

export const authenticate = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { id: string };
    // Check banned status on every authenticated request
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: { id: true, banned: true },
    });
    if (!user) return res.status(401).json({ message: 'User not found' });
    if (user.banned) return res.status(403).json({ message: 'Your account has been suspended. Contact support.' });
    req.userId = decoded.id;
    next();
  } catch {
    return res.status(401).json({ message: 'Invalid token' });
  }
};

/**
 * Like `authenticate`, but never rejects: if a valid token is present it sets
 * `req.userId`, otherwise the request proceeds anonymously. Used on public read
 * endpoints (e.g. the blog feed) so we can attach per-user state like `isLiked`
 * without forcing login.
 */
export const optionalAuth = async (req: AuthRequest, _res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    try {
      const decoded = jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET!) as { id: string };
      req.userId = decoded.id;
    } catch {
      // Invalid/expired token on a public route — treat as anonymous.
    }
  }
  next();
};