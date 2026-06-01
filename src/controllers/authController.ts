import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { prisma } from '../lib/prisma';
import { BrevoService } from '../services/brevoService';
import { z } from 'zod';

const registerSchema = z.object({
  name: z.string().min(2),
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(20, 'Username must be at most 20 characters')
    .regex(/^[a-z0-9_]+$/, 'Username can only contain lowercase letters, numbers, and underscores')
    .transform((val) => val.toLowerCase().trim()),
  email: z.string().email().transform((val) => val.toLowerCase().trim()),
  password: z.string().min(8),
});

const loginSchema = z.object({
  email: z.string().email().transform((val) => val.toLowerCase().trim()),
  password: z.string(),
});

export const register = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, username, email, password } = registerSchema.parse(req.body);

    const existingEmail = await prisma.user.findUnique({ where: { email } });
    if (existingEmail) return res.status(400).json({ message: 'Email already registered' });

    const existingUsername = await prisma.user.findUnique({ where: { username } });
    if (existingUsername) return res.status(400).json({ message: 'Username already taken. Choose a different one.' });

    const hashedPassword = await bcrypt.hash(password, 12);
    const verifyToken = crypto.randomBytes(32).toString('hex');

    const user = await prisma.user.create({
      data: { name, username, email, password: hashedPassword, verifyToken },
      select: { id: true, name: true, username: true, email: true, verified: true },
    });

    BrevoService.sendVerificationEmail(email, name, verifyToken).catch((err) =>
      console.error('❌ Verification email failed:', err.message)
    );

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

    BrevoService.sendWelcomeEmail(user.email, user.name).catch((err) =>
      console.error('❌ Welcome email failed:', err.message)
    );

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
      user: { id: user.id, name: user.name, username: user.username, email: user.email, avatar: user.avatar, verified: user.verified, onboarded: user.onboarded },
    });
  } catch (err) {
    next(err);
  }
};

export const forgotPassword = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const email = (req.body.email as string)?.toLowerCase().trim();
    const user = await prisma.user.findUnique({ where: { email } });

    const VAGUE = 'If that email is registered, a reset link has been sent.';

    if (!user) return res.json({ message: VAGUE });

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = new Date(Date.now() + 3600000);

    await prisma.user.update({
      where: { id: user.id },
      data: { resetToken, resetTokenExpiry },
    });

    BrevoService.sendPasswordResetEmail(email, user.name, resetToken).catch((err) =>
      console.error('❌ Password reset email failed:', err.message)
    );

    res.json({ message: VAGUE });
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

export const resendVerification = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const email = (req.body.email as string)?.toLowerCase().trim();
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user || user.verified) {
      return res.json({ message: 'If the account exists and is unverified, a new link has been sent.' });
    }

    const verifyToken = crypto.randomBytes(32).toString('hex');
    await prisma.user.update({ where: { id: user.id }, data: { verifyToken } });

    BrevoService.sendVerificationEmail(email, user.name, verifyToken).catch((err) =>
      console.error('❌ Resend verification email failed:', err.message)
    );

    res.json({ message: 'Verification email resent.' });
  } catch (err) {
    next(err);
  }
};

export const requestDeleteAccount = async (req: any, res: Response, next: NextFunction) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user) return res.status(404).json({ message: 'User not found' });

    const deleteToken = crypto.randomBytes(32).toString('hex');
    const deleteTokenExpiry = new Date(Date.now() + 3600000); // 1 hour

    await prisma.user.update({
      where: { id: user.id },
      data: { deleteToken, deleteTokenExpiry },
    });

    BrevoService.sendAccountDeletionEmail(user.email, user.name, deleteToken).catch((err) =>
      console.error('❌ Account deletion email failed:', err.message)
    );

    res.json({ message: 'Confirmation email sent. Check your inbox to complete deletion.' });
  } catch (err) {
    next(err);
  }
};

export const confirmDeleteAccount = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token } = req.params;

    const user = await prisma.user.findFirst({
      where: { deleteToken: token, deleteTokenExpiry: { gt: new Date() } },
    });

    if (!user) return res.status(400).json({ message: 'Invalid or expired deletion link.' });

    // Cascade deletes handle all related records (blogs, comments, likes, messages, conversations)
    await prisma.user.delete({ where: { id: user.id } });

    res.json({ message: 'Your account and all associated data have been permanently deleted.' });
  } catch (err) {
    next(err);
  }
};

export const me = async (req: any, res: Response, next: NextFunction) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { id: true, name: true, username: true, email: true, avatar: true, bio: true, verified: true, onboarded: true },
    });
    res.json(user);
  } catch (err) {
    next(err);
  }
};
