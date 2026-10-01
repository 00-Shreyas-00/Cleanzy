import { Request, Response, NextFunction } from 'express';
import { AppError } from '../errors/AppError';

export interface CustomError extends Error {
  statusCode?: number;
  code?: string;
}

export const errorHandler = (
  err: CustomError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Structured logging
  if (process.env.NODE_ENV !== 'test') {
    console.error(`[Error Handler] ${req.method} ${req.path}:`, err.message || err);
  }

  // Handle our domain AppError instances
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      error: err.message,
    });
  }

  // Handle Prisma unique constraint violation (P2002)
  if (err.code === 'P2002') {
    return res.status(409).json({
      success: false,
      error: 'A record with this identifier already exists',
    });
  }

  // Handle Prisma not found error (P2025)
  if (err.code === 'P2025') {
    return res.status(404).json({
      success: false,
      error: 'Requested record was not found',
    });
  }

  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  res.status(statusCode).json({
    success: false,
    error: message,
  });
};
