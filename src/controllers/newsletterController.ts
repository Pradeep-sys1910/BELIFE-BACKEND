import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { BrevoService } from '../services/brevoService';

export const subscribe = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Email required' });

    const existing = await prisma.newsletter.findUnique({ where: { email } });
    if (existing) return res.status(400).json({ message: 'Already subscribed' });

    await prisma.newsletter.create({ data: { email } });
    await BrevoService.sendNewsletterWelcome(email);

    res.json({ message: '🌱 Subscribed! Check your inbox.' });
  } catch (err) { next(err); }
};