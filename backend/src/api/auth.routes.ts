import { Router } from 'express';
import { googleLogin, getMe, logout } from './auth.controller';
import { requireAuth } from '../middleware/requireAuth';

const router = Router();

router.post('/google', googleLogin);
router.post('/logout', logout);
router.get('/me', requireAuth, getMe);

export default router;
