import { Router } from 'express';
import {
  getMessages,
  sendMessage,
  getWorkflowState,
  respondToApproval,
  regenerateVoiceover,
  regenerateShot,
  approveShot,
  getProjectJobs,
} from './message.controller';
import { requireAuth } from '../middleware/requireAuth';

const router = Router({ mergeParams: true });

// All routes are mounted under /api/projects/:projectId/messages
router.use(requireAuth);

router.get('/', getMessages);
router.post('/', sendMessage);
router.post('/respond', respondToApproval);
router.post('/regenerate-voiceover', regenerateVoiceover);
router.post('/regenerate-shot', regenerateShot);
router.post('/approve-shot', approveShot);
router.get('/jobs', getProjectJobs);
router.get('/state', getWorkflowState);

export default router;
