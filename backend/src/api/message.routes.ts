import { Router } from 'express';
import { getMessages, sendMessage, getWorkflowState, respondToApproval, regenerateShot, updateWorkflowState } from './message.controller';
import { requireAuth } from '../middleware/requireAuth';

const router = Router({ mergeParams: true });

// All routes are mounted under /api/projects/:projectId/messages
router.use(requireAuth);

router.get('/', getMessages);
router.post('/', sendMessage);
router.post('/respond', respondToApproval);
router.post('/regenerate-shot', regenerateShot);
router.get('/state', getWorkflowState);

export default router;
