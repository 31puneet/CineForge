import { redis } from '../config/redis';
import { Job, IJob, JobType, JobStatus } from '../models/Job';
import { v4 as uuidv4 } from 'uuid';

const VIDEO_QUEUE_KEY = 'cineforge:queue:video_shots';

export interface EnqueueShotJobInput {
  projectId: string;
  userId: string;
  shotId: string;
  version?: number;
  payloadRef?: Record<string, unknown>;
}

/**
 * Creates a durable MongoDB Job record and pushes an idempotent job payload to Redis.
 */
export async function enqueueShotJob(input: EnqueueShotJobInput): Promise<IJob> {
  const version = input.version ?? 1;
  const idempotencyKey = `${input.projectId}:VIDEO:${input.shotId}:v${version}`;

  const existing = await Job.findOne({ idempotencyKey });
  if (existing && (existing.status === 'QUEUED' || existing.status === 'RUNNING' || existing.status === 'SUCCEEDED')) {
    return existing;
  }

  const jobId = existing?.jobId || uuidv4();
  const job = await Job.findOneAndUpdate(
    { idempotencyKey },
    {
      $set: {
        jobId,
        projectId: input.projectId,
        userId: input.userId,
        jobType: 'VIDEO' as JobType,
        shotId: input.shotId,
        status: 'QUEUED' as JobStatus,
        payloadRef: input.payloadRef || {},
        errorCode: undefined,
        errorMessage: undefined,
      },
      $setOnInsert: { attempts: 0, maxAttempts: 3 },
    },
    { upsert: true, new: true }
  );

  if (redis) {
    const queueItem = JSON.stringify({
      jobId: job.jobId,
      projectId: input.projectId,
      shotId: input.shotId,
      idempotencyKey,
      payloadRef: input.payloadRef || {},
    });
    await redis.rpush(VIDEO_QUEUE_KEY, queueItem);
  }

  return job;
}

export async function updateJobStatus(
  jobId: string,
  status: JobStatus,
  extras?: { errorCode?: string; errorMessage?: string; attempts?: number }
): Promise<void> {
  const update: Record<string, unknown> = { status };
  if (status === 'RUNNING') update.startedAt = new Date();
  if (status === 'SUCCEEDED' || status === 'FAILED' || status === 'CANCELLED') {
    update.finishedAt = new Date();
  }
  if (extras?.errorCode !== undefined) update.errorCode = extras.errorCode;
  if (extras?.errorMessage !== undefined) update.errorMessage = extras.errorMessage;
  if (extras?.attempts !== undefined) update.attempts = extras.attempts;

  await Job.updateOne({ jobId }, { $set: update });
}
