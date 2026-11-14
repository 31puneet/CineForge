import { Router } from 'express';
import { regenerateCharacter } from './character.controller';
import { requireAuth } from '../middleware/requireAuth';

const router = Router({ mergeParams: true });

router.use(requireAuth);

router.post('/:charId/regenerate', regenerateCharacter);

export default router;
