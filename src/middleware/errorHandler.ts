import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

export const errorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
  const status = err.status || err.statusCode || 500;

  // Log full error server-side only
  console.error('❌ Error:', err);

  if (err instanceof ZodError) {
    return res.status(400).json({ message: 'Validation error', errors: err.errors });
  }

  // Never leak internal error details (Prisma messages expose DB schema) to clients
  const isClientError = status >= 400 && status < 500;
  const message = isClientError
    ? (err.message || 'Bad request')
    : 'Internal server error';

  res.status(status).json({ message });
};