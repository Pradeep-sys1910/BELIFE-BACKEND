import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { prisma } from '../lib/prisma';
import { BrevoService } from '../services/brevoService';
import { z } from 'zod';

const registerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

export const register = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, email, password } = registerSchema.parse(req.body);

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(400).json({ message: 'Email already registered' });

    const hashedPassword = await bcrypt.hash(password, 12);
    const verifyToken = crypto.randomBytes(32).toString('hex');

    const user = await prisma.user.create({
      data: { name, email, password: hashedPassword, verifyToken },
      select: { id: true, name: true, email: true, verified: true },
    });

    // Send verification email via Brevo
    await BrevoService.sendVerificationEmail(email, name, verifyToken);

    res.status(201).json({
      message: 'Account created! Check your email to verify.',
      user,
    });
  } catch (err) {
    next(err);
  }
};

export const verifyEmail = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token } = req.params;
    const user = await prisma.user.findUnique({ where: { verifyToken: token } });
    if (!user) return res.status(400).json({ message: 'Invalid or expired token' });

    await prisma.user.update({
      where: { id: user.id },
      data: { verified: true, verifyToken: null },
    });

    // Send welcome email
    await BrevoService.sendWelcomeEmail(user.email, user.name);

    res.json({ message: 'Email verified successfully! 🌿' });
  } catch (err) {
    next(err);
  }
};

export const login = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = loginSchema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(401).json({ message: 'Invalid credentials' });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ message: 'Invalid credentials' });

    if (!user.verified) {
      return res.status(403).json({ message: 'Please verify your email first' });
    }

    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET!, { expiresIn: '7d' });

    res.json({
      token,
      user: { id: user.id, name: user.name, email: user.email, avatar: user.avatar, verified: user.verified },
    });
  } catch (err) {
    next(err);
  }
};

export const forgotPassword = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });

    // Always return success to prevent email enumeration
    if (!user) return res.json({ message: 'If email exists, a reset link has been sent.' });

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hour

    await prisma.user.update({
      where: { id: user.id },
      data: { resetToken, resetTokenExpiry },
    });

    // Send password reset email via Brevo
    await BrevoService.sendPasswordResetEmail(email, user.name, resetToken);

    res.json({ message: 'Password reset link sent to your email.' });
  } catch (err) {
    next(err);
  }
};

export const resetPassword = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token, password } = req.body;
    if (!password || password.length < 8) {
      return res.status(400).json({ message: 'Password must be at least 8 characters' });
    }

    const user = await prisma.user.findFirst({
      where: { resetToken: token, resetTokenExpiry: { gt: new Date() } },
    });

    if (!user) return res.status(400).json({ message: 'Invalid or expired reset token' });

    const hashed = await bcrypt.hash(password, 12);
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashed, resetToken: null, resetTokenExpiry: null },
    });

    res.json({ message: 'Password reset successfully! 🌿' });
  } catch (err) {
    next(err);
  }
};

export const me = async (req: any, res: Response, next: NextFunction) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { id: true, name: true, email: true, avatar: true, bio: true, verified: true },
    });
    res.json(user);
  } catch (err) {
    next(err);
  }
};