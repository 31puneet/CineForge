"""
S3/MinIO object storage adapter for CineForge AI Service (TDD Section 15).
Uploads generated artifacts under projects/{project_id}/... keys when MinIO is enabled,
registers Asset records with the backend, and returns backend-authorized URLs.
"""
import logging
from pathlib import Path
from typing import Optional

import httpx
from core.config import settings

logger = logging.getLogger("cineforge.storage")


class MediaStorageAdapter:
    def __init__(self) -> None:
        self._client = None

    def is_minio_enabled(self) -> bool:
        return bool(
            settings.MINIO_ENDPOINT
            and settings.MINIO_ACCESS_KEY
            and settings.MINIO_SECRET_KEY
            and settings.STORAGE_MODE.lower() == "minio"
        )

    def _get_client(self):
        if self._client is not None:
            return self._client
        from minio import Minio

        endpoint = f"{settings.MINIO_ENDPOINT}:{settings.MINIO_PORT}"
        self._client = Minio(
            endpoint,
            access_key=settings.MINIO_ACCESS_KEY,
            secret_key=settings.MINIO_SECRET_KEY,
            secure=settings.MINIO_USE_SSL,
        )
        return self._client

    def upload_file(
        self,
        local_path: Path | str,
        *,
        project_id: str,
        object_key: str,
        bucket: str = "cineforge-renders",
        content_type: str = "application/octet-stream",
        asset_type: str = "other",
        character_id: Optional[str] = None,
        version: int = 1,
    ) -> str:
        """
        Uploads local_path to MinIO when STORAGE_MODE=minio is active and returns
        a backend-authorized media URL (/api/projects/{project_id}/assets/media?...).
        In local dev/test mode, returns the local /renders/{project_id}/... URL.
        """
        p = Path(local_path)
        if not p.exists():
            raise FileNotFoundError(f"Cannot store missing file: {p}")

        if not self.is_minio_enabled():
            return f"/renders/{project_id}/{p.name}"

        client = self._get_client()
        if not client.bucket_exists(bucket):
            client.make_bucket(bucket)

        size_bytes = p.stat().st_size
        client.fput_object(bucket, object_key, str(p), content_type=content_type)
        logger.info("Uploaded %s -> minio://%s/%s (%d bytes)", p.name, bucket, object_key, size_bytes)

        self._register_backend_asset(
            project_id=project_id,
            bucket=bucket,
            object_key=object_key,
            mime_type=content_type,
            size_bytes=size_bytes,
            asset_type=asset_type,
            character_id=character_id,
            version=version,
        )
        return f"/api/projects/{project_id}/assets/media?bucket={bucket}&key={object_key}"

    def _register_backend_asset(
        self,
        *,
        project_id: str,
        bucket: str,
        object_key: str,
        mime_type: str,
        size_bytes: int,
        asset_type: str,
        character_id: Optional[str],
        version: int,
    ) -> None:
        if not settings.INTERNAL_API_KEY or not settings.BACKEND_URL:
            return
        try:
            with httpx.Client(timeout=5.0) as client:
                client.post(
                    f"{settings.BACKEND_URL}/api/internal/projects/{project_id}/assets",
                    headers={"x-internal-api-key": settings.INTERNAL_API_KEY},
                    json={
                        "bucket": bucket,
                        "objectKey": object_key,
                        "mimeType": mime_type,
                        "sizeBytes": size_bytes,
                        "type": asset_type,
                        "characterId": character_id,
                        "version": version,
                    },
                )
        except Exception as exc:
            logger.warning("Asset metadata sync failed for %s: %s", object_key, exc)


media_storage = MediaStorageAdapter()
