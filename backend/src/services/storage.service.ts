import * as Minio from 'minio';
import { env } from '../config/env';
import { AppError } from '../utils/errors';

class StorageService {
  private minioClient: Minio.Client;
  private presignClient: Minio.Client;

  constructor() {
    this.minioClient = new Minio.Client({
      endPoint: env.MINIO_ENDPOINT || 'localhost',
      port: parseInt(env.MINIO_PORT || '9000', 10),
      useSSL: env.MINIO_USE_SSL === 'true',
      accessKey: env.MINIO_ACCESS_KEY,
      secretKey: env.MINIO_SECRET_KEY,
    });

    // Client specifically for generating presigned URLs that the browser will use.
    // It must use 'localhost' so the generated AWS Signature V4 matches the browser's Host header.
    this.presignClient = new Minio.Client({
      endPoint: 'localhost',
      port: parseInt(env.MINIO_PORT || '9000', 10),
      useSSL: env.MINIO_USE_SSL === 'true',
      accessKey: env.MINIO_ACCESS_KEY,
      secretKey: env.MINIO_SECRET_KEY,
      region: 'us-east-1', // Explicit region makes presigning completely offline
    });
  }

  /**
   * Ensure necessary buckets exist and have correct CORS policies.
   */
  async initializeBuckets() {
    const buckets = ['cineforge-assets', 'cineforge-renders'];
    
    for (const bucketName of buckets) {
      try {
        const exists = await this.minioClient.bucketExists(bucketName);
        if (!exists) {
          await this.minioClient.makeBucket(bucketName, 'us-east-1');
          console.log(`[StorageService] Bucket '${bucketName}' created.`);
        } else {
          console.log(`[StorageService] Bucket '${bucketName}' already exists.`);
        }

        // Set bucket policy to allow public read (for pre-signed URL downloads)
        // and direct PUT uploads from pre-signed URLs
        const policy = JSON.stringify({
          Version: '2012-10-17',
          Statement: [
            {
              Effect: 'Allow',
              Principal: { AWS: ['*'] },
              Action: ['s3:GetObject', 's3:PutObject'],
              Resource: [`arn:aws:s3:::${bucketName}/*`],
            },
          ],
        });
        await this.minioClient.setBucketPolicy(bucketName, policy);
        console.log(`[StorageService] Bucket policy set for '${bucketName}'.`);
      } catch (error) {
        console.error(`[StorageService] Failed to initialize bucket '${bucketName}':`, error);
      }
    }
  }

  /**
   * Generate a pre-signed URL for PUT (uploading)
   */
  async generateUploadUrl(bucketName: string, objectKey: string, expiryInSeconds = 3600): Promise<string> {
    try {
      return await this.presignClient.presignedPutObject(bucketName, objectKey, expiryInSeconds);
    } catch (error) {
      console.error('[StorageService] Error generating upload URL:', error);
      throw new AppError('Failed to generate upload URL', 500, error);
    }
  }

  /**
   * Generate a pre-signed URL for GET (downloading/viewing)
   */
  async generateDownloadUrl(bucketName: string, objectKey: string, expiryInSeconds = 3600): Promise<string> {
    try {
      return await this.presignClient.presignedGetObject(bucketName, objectKey, expiryInSeconds);
    } catch (error) {
      console.error('[StorageService] Error generating download URL:', error);
      throw new AppError('Failed to generate download URL', 500, error);
    }
  }

  /**
   * Remove an object from a bucket
   */
  async removeObject(bucketName: string, objectKey: string): Promise<void> {
    try {
      await this.minioClient.removeObject(bucketName, objectKey);
    } catch (error) {
      console.error('[StorageService] Error removing object:', error);
      throw new AppError('Failed to remove object from storage', 500, error);
    }
  }
}

export const storageService = new StorageService();
