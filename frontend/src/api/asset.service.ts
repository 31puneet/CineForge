import apiClient from './client';

export interface UploadUrlResponse {
  uploadUrl: string;
  assetData: {
    projectId: string;
    characterId?: string;
    bucket: string;
    objectKey: string;
    mimeType: string;
    sizeBytes: number;
    type: string;
  };
}

export interface Asset {
  id: string;
  projectId: string;
  characterId?: string;
  type: string;
  bucket: string;
  objectKey: string;
  mimeType: string;
  sizeBytes: number;
  downloadUrl?: string;
  createdAt: string;
}

function resolveFileType(mimeType: string): string {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  return 'other';
}

export async function getUploadUrl(
  projectId: string,
  file: File,
  characterId?: string
): Promise<UploadUrlResponse> {
  const response = await apiClient.post<UploadUrlResponse>(
    `/projects/${projectId}/assets/upload-url`,
    {
      filename: file.name,
      mimeType: file.type,
      sizeBytes: file.size,
      type: resolveFileType(file.type),
      characterId,
    }
  );
  return response.data;
}

export async function uploadFileToStorage(
  uploadUrl: string,
  file: File
): Promise<void> {
  const response = await fetch(uploadUrl, {
    method: 'PUT',
    body: file,
    headers: { 'Content-Type': file.type },
  });

  if (!response.ok) {
    throw new Error(`Storage upload failed with status ${response.status}`);
  }
}

export async function createAssetRecord(
  projectId: string,
  assetData: UploadUrlResponse['assetData']
): Promise<Asset> {
  const response = await apiClient.post<{ asset: Asset }>(
    `/projects/${projectId}/assets`,
    assetData
  );
  return response.data.asset;
}

export async function getAssetsByProject(projectId: string): Promise<Asset[]> {
  const response = await apiClient.get<{ assets: Asset[] }>(
    `/projects/${projectId}/assets`
  );
  return response.data.assets;
}
