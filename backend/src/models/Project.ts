import mongoose, { Document, Schema, Types } from 'mongoose';

export type ProjectStatus = 'draft' | 'active' | 'completed' | 'archived';

export interface IProjectSettings {
  aspectRatio: string;
  targetDurationSeconds: number;
}

export interface IProject extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  title: string;
  status: ProjectStatus;
  settings: IProjectSettings;
  createdAt: Date;
  updatedAt: Date;
}

const ProjectSettingsSchema = new Schema<IProjectSettings>({
  aspectRatio: { type: String, default: '16:9' },
  targetDurationSeconds: { type: Number, default: 60 }
}, { _id: false });

const ProjectSchema = new Schema<IProject>({
  userId: { 
    type: Schema.Types.ObjectId, 
    ref: 'User', 
    required: true,
    index: true 
  },
  title: { 
    type: String, 
    required: true,
    trim: true
  },
  status: { 
    type: String, 
    enum: ['draft', 'active', 'completed', 'archived'], 
    default: 'draft' 
  },
  settings: {
    type: ProjectSettingsSchema,
    default: () => ({ aspectRatio: '16:9', targetDurationSeconds: 60 })
  }
}, {
  timestamps: true,
  toJSON: {
    transform: (_, ret) => {
      ret.id = ret._id;
      delete ret._id;
      delete ret.__v;
      return ret;
    }
  }
});

export const Project = mongoose.model<IProject>('Project', ProjectSchema);
