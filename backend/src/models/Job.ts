import mongoose, { Document, Schema, Types } from 'mongoose';

export type JobType = 'SCRIPT' | 'CHARACTER' | 'VOICE' | 'VIDEO' | 'EDIT';
export type JobStatus = 'QUEUED' | 'RUNNING' | 'SUCCEEDED' | 'RETRYING' | 'FAILED' | 'CANCELLED';

export interface IJob extends Document {
  jobId: string;
  projectId: Types.ObjectId;
  userId: Types.ObjectId;
  jobType: JobType;
  shotId?: string;
  idempotencyKey: string;
  status: JobStatus;
  attempts: number;
  maxAttempts: number;
  notBefore?: Date;
  payloadRef?: Record<string, unknown>;
  errorCode?: string;
  errorMessage?: string;
  startedAt?: Date;
  finishedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const JobSchema = new Schema<IJob>(
  {
    jobId: { type: String, required: true, unique: true, index: true },
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    jobType: {
      type: String,
      enum: ['SCRIPT', 'CHARACTER', 'VOICE', 'VIDEO', 'EDIT'],
      required: true,
    },
    shotId: { type: String },
    idempotencyKey: { type: String, required: true, unique: true },
    status: {
      type: String,
      enum: ['QUEUED', 'RUNNING', 'SUCCEEDED', 'RETRYING', 'FAILED', 'CANCELLED'],
      default: 'QUEUED',
      index: true,
    },
    attempts: { type: Number, default: 0 },
    maxAttempts: { type: Number, default: 3 },
    notBefore: { type: Date },
    payloadRef: { type: Schema.Types.Mixed, default: {} },
    errorCode: { type: String },
    errorMessage: { type: String },
    startedAt: { type: Date },
    finishedAt: { type: Date },
  },
  { timestamps: true }
);

export const Job = mongoose.model<IJob>('Job', JobSchema);
