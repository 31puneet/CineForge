import { Request, Response } from 'express';
import { verifyGoogleTokenAndGetUser } from '../services/auth.service';
import { signToken, setTokenCookie, clearTokenCookie } from '../utils/jwt';

export const googleLogin = async (req: Request, res: Response) => {
  const { credential } = req.body;
  if (!credential) {
    res.status(400).json({ error: { code: 400, message: 'Google credential is required' } });
    return;
  }

  const user = await verifyGoogleTokenAndGetUser(credential);
  
  const token = signToken({ id: user.id, role: user.role });
  setTokenCookie(res, token);

  res.json({
    message: 'Authentication successful',
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      role: user.role,
    }
  });
};

export const getMe = async (req: Request, res: Response) => {
  // requireAuth middleware ensures req.user is populated
  res.json({ user: req.user });
};

export const logout = async (req: Request, res: Response) => {
  clearTokenCookie(res);
  res.json({ message: 'Logged out successfully' });
};
