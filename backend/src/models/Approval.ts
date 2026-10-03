import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IApproval extends Document {
  projectId: Types.ObjectId;
  stage: string;
  version: number;
  approved: boolean;
  reason: string;
  createdAt: Date;
}

const ApprovalSchema = new Schema<IApproval>({
  projectId: { 
    type: Schema.Types.ObjectId, 
    ref: 'Project', 
    required: true,
    index: true 
  },
  stage: { 
    type: String, 
    required: true
  },
  version: {
    type: Number,
    required: true
  },
  approved: {
    type: Boolean,
    required: true
  },
  reason: {
    type: String,
    default: ""
  }
}, {
  timestamps: { createdAt: true, updatedAt: false }
});

export const Approval = mongoose.model<IApproval>('Approval', ApprovalSchema);
