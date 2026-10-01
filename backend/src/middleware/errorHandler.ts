import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/errors';
import { env } from '../config/env';

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  let statusCode = 500;
  let message = 'Internal Server Error';
  let details = null;

  if (err instanceof AppError) {
    statusCode = err.statusCode;
    message = err.message;
    details = err.details;
  } else if (err.name === 'ValidationError') {
    statusCode = 400;
    message = err.message;
  } else if (err.name === 'CastError') {
    statusCode = 400;
    message = 'Invalid ID format';
  }

  if (env.NODE_ENV === 'development' && statusCode === 500) {
    console.error(err);
  }

  res.status(statusCode).json({
    error: {
      code: statusCode,
      message,
      ...(details && { details }),
      ...(env.NODE_ENV === 'development' && { stack: err.stack }),
      requestId: req.headers['x-request-id']
    }
  });
};
