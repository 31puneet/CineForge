import mongoose, { Document, Schema } from 'mongoose';

export interface IAsset extends Document {
  projectId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  type: 'image' | 'audio' | 'video' | 'document' | 'other';
  bucket: string;
  objectKey: string;
  mimeType: string;
  sizeBytes: number;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

const assetSchema = new Schema<IAsset>(
  {
    projectId: {
      type: Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ['image', 'audio', 'video', 'document', 'other'],
      required: true,
    },
    bucket: {
      type: String,
      required: true,
    },
    objectKey: {
      type: String,
      required: true,
      unique: true, // we want keys to be unique
    },
    mimeType: {
      type: String,
      required: true,
    },
    sizeBytes: {
      type: Number,
      required: true,
    },
    version: {
      type: Number,
      default: 1,
    },
  },
  {
    timestamps: true,
  }
);

export const Asset = mongoose.model<IAsset>('Asset', assetSchema);
