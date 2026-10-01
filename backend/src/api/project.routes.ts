import { Router } from 'express';
import { getProjects, getProject, createProject, updateProject, deleteProject } from './project.controller';
import { requireAuth } from '../middleware/requireAuth';

const router = Router();

// All project routes require authentication
router.use(requireAuth);

router.get('/', getProjects);
router.post('/', createProject);
router.get('/:id', getProject);
router.patch('/:id', updateProject);
router.delete('/:id', deleteProject);

export default router;
