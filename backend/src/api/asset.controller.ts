import { Request, Response, NextFunction } from 'express';
import { Asset } from '../models/Asset';
import { storageService } from '../services/storage.service';
import { UnauthorizedError } from '../utils/errors';
import mongoose from 'mongoose';
import { projectRepository } from '../services/project.repository';

export const getUploadUrl = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { projectId } = req.params;
    const { filename, mimeType, sizeBytes, type } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      console.error('[getUploadUrl] No userId found');
      throw new UnauthorizedError();
    }

    // Verify project ownership (will throw NotFoundError if invalid)
    const project = await projectRepository.findByIdAndUserId(projectId, userId);

    const bucketName = 'cineforge-assets';
    const uniqueId = new mongoose.Types.ObjectId().toString();
    const extension = filename.split('.').pop();
    const objectKey = `${projectId}/${uniqueId}.${extension}`;

    let uploadUrl = await storageService.generateUploadUrl(bucketName, objectKey);
    // Rewrite host for local docker-compose environment so frontend can upload
    uploadUrl = uploadUrl.replace('cineforge-minio', 'localhost');

    res.json({
      uploadUrl,
      assetData: {
        projectId,
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
    const { projectId } = req.params;
    const userId = req.user?.id;
    const { bucket, objectKey, mimeType, sizeBytes, type } = req.body;

    if (!userId) throw new UnauthorizedError();

    // Verify project ownership
    const project = await projectRepository.findByIdAndUserId(projectId, userId);

    const asset = new Asset({
      projectId,
      userId,
      type,
      bucket,
      objectKey,
      mimeType,
      sizeBytes,
    });

    await asset.save();
    res.status(201).json({ asset });
  } catch (error) {
    next(error);
  }
};

export const getAssetsByProject = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { projectId } = req.params;
    const userId = req.user?.id;

    if (!userId) throw new UnauthorizedError();

    const project = await projectRepository.findByIdAndUserId(projectId, userId);

    const assets = await Asset.find({ projectId }).sort({ createdAt: -1 });

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
