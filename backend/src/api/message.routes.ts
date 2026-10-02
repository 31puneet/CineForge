import { Router } from 'express';
import { getMessages, sendMessage } from './message.controller';
import { requireAuth } from '../middleware/requireAuth';

const router = Router({ mergeParams: true });

// All routes are mounted under /api/projects/:projectId/messages
router.use(requireAuth);

router.get('/', getMessages);
router.post('/', sendMessage);

export default router;
