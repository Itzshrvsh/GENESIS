import { Request, Response, NextFunction } from 'express';

interface ApiError extends Error {
  status?: number;
  details?: unknown;
}

export const errorHandler = (
  err: ApiError,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  const status = err.status ?? 500;

  const response = {
    error: {
      message: err.message || 'Internal Server Error',
      ...(process.env.NODE_ENV !== 'production' && err.stack
        ? { stack: err.stack }
        : {}),
      ...(err.details ? { details: err.details } : {})
    }
  };

  res.status(status).json(response);
};

export default errorHandler;