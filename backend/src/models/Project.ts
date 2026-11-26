import mongoose, { Document, Schema, Types } from 'mongoose';

export type ProjectStatus = 'draft' | 'active' | 'completed' | 'archived';

export interface IProjectSettings {
  aspectRatio: string;
  targetDurationSeconds: number;
}

export interface IProjectMessage {
  _id?: Types.ObjectId;
  role: 'user' | 'assistant' | 'system';
  content: string;
  attachments?: Record<string, unknown>[];
  metadata?: Record<string, unknown>;
  timestamp?: Date;
}

export interface IProject extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  title: string;
  status: ProjectStatus;
  settings: IProjectSettings;
  workflowState?: Record<string, unknown>;
  messages?: IProjectMessage[];
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
  },
  workflowState: {
    type: Schema.Types.Mixed,
    default: {}
  },
  messages: [{
    role: { type: String, enum: ['user', 'assistant', 'system'], required: true },
    content: { type: String, required: true },
    attachments: { type: Array, default: [] },
    metadata: { type: Schema.Types.Mixed, default: {} },
    timestamp: { type: Date, default: Date.now }
  }]
}, {
  timestamps: true,
  toJSON: {
    transform: (_, ret) => {
      const json = ret as unknown as Record<string, unknown>;
      json.id = json._id;
      delete json._id;
      delete json.__v;
      return json;
    }
  }
});

export const Project = mongoose.model<IProject>('Project', ProjectSchema);
