import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

export const errorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('❌ Error:', err);
  if (err instanceof ZodError) {
    return res.status(400).json({ message: 'Validation error', errors: err.errors });
  }
  res.status(err.status || 500).json({ message: err.message || 'Internal server error' });
};