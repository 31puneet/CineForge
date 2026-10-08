import { Router } from 'express';
import { getMessages, sendMessage, getWorkflowState, respondToApproval, updateWorkflowState } from './message.controller';
import { requireAuth } from '../middleware/requireAuth';

const router = Router({ mergeParams: true });

// Internal route for AI service to update state (no user auth required)
router.put('/state', updateWorkflowState);

// All routes are mounted under /api/projects/:projectId/messages
router.use(requireAuth);

router.get('/', getMessages);
router.post('/', sendMessage);
router.post('/respond', respondToApproval);
router.get('/state', getWorkflowState);

export default router;
