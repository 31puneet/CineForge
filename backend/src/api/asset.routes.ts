import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth';
import { getUploadUrl, createAsset, getAssetsByProject, getPresignedMediaUrl } from './asset.controller';

const router = Router({ mergeParams: true });

// Note: This router will be mounted at /api/projects/:projectId/assets
router.use(requireAuth);

router.post('/upload-url', getUploadUrl);
router.post('/', createAsset);
router.get('/', getAssetsByProject);
router.get('/media', getPresignedMediaUrl);

export default router;
