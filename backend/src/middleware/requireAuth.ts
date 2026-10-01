import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt';
import { User } from '../models/User';
import { UnauthorizedError } from '../utils/errors';

// Extend Express Request to include user
declare global {
  namespace Express {
    interface Request {
      user?: any;
    }
  }
}

export const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
  const token = req.cookies?.token;

  if (!token) {
    throw new UnauthorizedError('Authentication required');
  }

  try {
    const payload = verifyToken(token);
    const user = await User.findById(payload.id).select('-__v'); 
    
    if (!user) {
      throw new UnauthorizedError('User no longer exists');
    }

    req.user = user;
    next();
  } catch (error) {
    throw new UnauthorizedError('Invalid or expired token');
  }
};
