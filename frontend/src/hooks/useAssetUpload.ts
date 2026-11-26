import { useState, useCallback } from 'react';
import type { Asset } from '../api/asset.service';
import { getUploadUrl, uploadFileToStorage, createAssetRecord } from '../api/asset.service';

interface UseAssetUploadResult {
  isUploading: boolean;
  error: string | null;
  uploadAsset: (projectId: string, file: File, characterId?: string) => Promise<Asset | null>;
}

export function useAssetUpload(): UseAssetUploadResult {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const uploadAsset = useCallback(async (projectId: string, file: File, characterId?: string): Promise<Asset | null> => {
    setIsUploading(true);
    setError(null);

    try {
      const { uploadUrl, assetData } = await getUploadUrl(projectId, file, characterId);
      await uploadFileToStorage(uploadUrl, file);
      const asset = await createAssetRecord(projectId, assetData);
      return asset;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Upload failed';
      setError(message);
      console.error('[useAssetUpload]', err);
      return null;
    } finally {
      setIsUploading(false);
    }
  }, []);

  return { isUploading, error, uploadAsset };
}
