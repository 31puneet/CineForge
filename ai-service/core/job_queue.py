"""
Parallel shot job execution & Redis job queue integration (TDD Sections 23-24).
"""
import asyncio
import json
import logging
from typing import Callable, Awaitable, List, TypeVar, Any

from core.config import settings

logger = logging.getLogger("cineforge.jobs")
T = TypeVar("T")


async def publish_job_status(project_id: str, shot_id: str, status: str, detail: str = "") -> None:
    """Publishes shot job progress to Redis when REDIS_URL is configured."""
    if not settings.REDIS_URL:
        return
    try:
        import redis.asyncio as aioredis

        client = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
        try:
            payload = json.dumps({
                "projectId": project_id,
                "shotId": shot_id,
                "status": status,
                "detail": detail,
            })
            await client.publish(f"cineforge:project:{project_id}:jobs", payload)
            await client.hset(f"cineforge:project:{project_id}:shot_status", shot_id, status)
        finally:
            await client.aclose()
    except Exception as exc:
        logger.debug("Redis job status publish skipped: %s", exc)


async def run_parallel_shot_tasks(
    tasks: List[Callable[[], Awaitable[T]]],
    concurrency_limit: int | None = None,
) -> List[Any]:
    """
    Runs independent shot tasks concurrently up to `concurrency_limit`,
    returning results/exceptions in original shot sequence order (return_exceptions=True).
    """
    limit = max(1, concurrency_limit or settings.VIDEO_CONCURRENCY_LIMIT)
    semaphore = asyncio.Semaphore(limit)

    async def _bounded(fn: Callable[[], Awaitable[T]]) -> T:
        async with semaphore:
            return await fn()

    return await asyncio.gather(*(_bounded(fn) for fn in tasks), return_exceptions=True)
