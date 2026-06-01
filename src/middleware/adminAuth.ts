import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma';

export interface AdminRequest extends Request {
  adminId?: string;
}

function getAdminSecret() {
  return process.env.ADMIN_JWT_SECRET || (process.env.JWT_SECRET! + '-admin-panel');
}

export const adminAuthenticate = async (req: AdminRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, getAdminSecret()) as { id: string; role: string };
    if (decoded.role !== 'ADMIN') return res.status(403).json({ message: 'Forbidden' });

    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: { id: true, role: true, banned: true },
    });
    if (!user || user.role !== 'ADMIN') return res.status(403).json({ message: 'Forbidden' });

    req.adminId = decoded.id;
    next();
  } catch {
    return res.status(401).json({ message: 'Invalid or expired admin session' });
  }
};

export function signAdminToken(id: string) {
  return jwt.sign({ id, role: 'ADMIN' }, getAdminSecret(), { expiresIn: '2h' });
}
