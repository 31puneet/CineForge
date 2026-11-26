import type { Request, Response, NextFunction } from 'express';
import { Asset } from '../models/Asset';
import { storageService } from '../services/storage.service';
import { UnauthorizedError, ValidationError } from '../utils/errors';
import mongoose from 'mongoose';
import { projectRepository } from '../services/project.repository';

function getValidatedProjectId(req: Request): string {
  const raw = req.params.projectId;
  const projectId = Array.isArray(raw) ? raw[0] : raw;
  if (!projectId || !mongoose.Types.ObjectId.isValid(projectId)) {
    throw new ValidationError('Invalid projectId');
  }
  return projectId;
}

export const getUploadUrl = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const projectId = getValidatedProjectId(req);
    const { filename, mimeType, sizeBytes, type, characterId } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      console.error('[getUploadUrl] No userId found');
      throw new UnauthorizedError();
    }

    // Verify project ownership (will throw NotFoundError if invalid)
    await projectRepository.findByIdAndUserId(projectId, userId);

    const bucketName = 'cineforge-assets';
    const uniqueId = new mongoose.Types.ObjectId().toString();
    const extension = String(filename || 'bin').split('.').pop();
    const objectKey = characterId
      ? `projects/${projectId}/characters/${String(characterId).replace(/[^A-Za-z0-9_-]/g, '')}/references/${uniqueId}.${extension}`
      : `projects/${projectId}/references/${uniqueId}.${extension}`;

    let uploadUrl = await storageService.generateUploadUrl(bucketName, objectKey);
    // Rewrite host for local docker-compose environment so frontend can upload
    uploadUrl = uploadUrl.replace('cineforge-minio', 'localhost');

    res.json({
      uploadUrl,
      assetData: {
        projectId,
        characterId,
        bucket: bucketName,
        objectKey,
        mimeType,
        sizeBytes,
        type,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const createAsset = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const projectId = getValidatedProjectId(req);
    const userId = req.user?.id;
    const { bucket, objectKey, mimeType, sizeBytes, type, characterId } = req.body;

    if (!userId) throw new UnauthorizedError();

    // Verify project ownership
    await projectRepository.findByIdAndUserId(projectId, userId);

    const asset = new Asset({
      projectId,
      userId,
      characterId,
      type,
      bucket,
      objectKey,
      mimeType,
      sizeBytes,
    });

    await asset.save();
    let downloadUrl = await storageService.generateDownloadUrl(bucket, objectKey);
    downloadUrl = downloadUrl.replace('cineforge-minio', 'localhost');
    res.status(201).json({ asset: { ...asset.toObject(), downloadUrl } });
  } catch (error) {
    next(error);
  }
};

export const getPresignedMediaUrl = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const projectId = getValidatedProjectId(req);
    const userId = req.user?.id;
    const bucket = String(req.query.bucket || 'cineforge-renders');
    const key = String(req.query.key || '');

    if (!userId) throw new UnauthorizedError();
    await projectRepository.findByIdAndUserId(projectId, userId);

    if (!key.startsWith(`projects/${projectId}/`) || !['cineforge-assets', 'cineforge-renders'].includes(bucket)) {
      res.status(400).json({ error: 'Invalid media key or bucket' });
      return;
    }

    let url = await storageService.generateDownloadUrl(bucket, key);
    url = url.replace('cineforge-minio', 'localhost');
    res.redirect(302, url);
  } catch (error) {
    next(error);
  }
};

export const getAssetsByProject = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const projectId = getValidatedProjectId(req);
    const userId = req.user?.id;

    if (!userId) throw new UnauthorizedError();

    await projectRepository.findByIdAndUserId(projectId, userId);

    const assets = await Asset.find({ projectId: new mongoose.Types.ObjectId(projectId) }).sort({ createdAt: -1 });

    // Generate download URLs for each asset
    const assetsWithUrls = await Promise.all(
      assets.map(async (asset) => {
        let downloadUrl = await storageService.generateDownloadUrl(asset.bucket, asset.objectKey);
        downloadUrl = downloadUrl.replace('cineforge-minio', 'localhost');
        return { ...asset.toObject(), downloadUrl };
      })
    );

    res.json({ assets: assetsWithUrls });
  } catch (error) {
    next(error);
  }
};
