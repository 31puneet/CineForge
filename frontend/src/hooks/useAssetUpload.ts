import { useState, useCallback } from 'react';
import type { Asset } from '../api/asset.service';
import { getUploadUrl, uploadFileToStorage, createAssetRecord } from '../api/asset.service';

interface UseAssetUploadResult {
  isUploading: boolean;
  error: string | null;
  uploadAsset: (projectId: string, file: File) => Promise<Asset | null>;
}

/**
 * Hook that encapsulates the full asset upload workflow:
 * 1. Request a pre-signed URL from the backend
 * 2. Upload the file directly to MinIO
 * 3. Create the asset record in the database
 */
export function useAssetUpload(): UseAssetUploadResult {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const uploadAsset = useCallback(async (projectId: string, file: File): Promise<Asset | null> => {
    setIsUploading(true);
    setError(null);

    try {
      // Step 1: Get pre-signed upload URL
      const { uploadUrl, assetData } = await getUploadUrl(projectId, file);

      // Step 2: Upload file directly to MinIO
      await uploadFileToStorage(uploadUrl, file);

      // Step 3: Create asset record in database
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
