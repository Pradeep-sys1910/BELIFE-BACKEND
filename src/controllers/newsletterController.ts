import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { BrevoService } from '../services/brevoService';

const emailSchema = z.string().email().max(254).transform(v => v.toLowerCase().trim());

export const subscribe = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = emailSchema.safeParse(req.body.email);
    if (!result.success) return res.status(400).json({ message: 'Valid email required' });
    const email = result.data;

    const existing = await prisma.newsletter.findUnique({ where: { email } });
    if (existing) return res.status(400).json({ message: 'Already subscribed' });

    await prisma.newsletter.create({ data: { email } });
    await BrevoService.sendNewsletterWelcome(email);

    res.json({ message: '🌱 Subscribed! Check your inbox.' });
  } catch (err) { next(err); }
};