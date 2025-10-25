import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ICreditsHistory extends Document {
  _id: mongoose.Types.ObjectId;
  userId: string;
  delta: number;
  reason: string;
  agentId?: mongoose.Types.ObjectId | null;
  sessionId?: mongoose.Types.ObjectId | null;
  balanceAfter: number;
  metadata?: Record<string, unknown> | null;
  createdAt: Date;
}

const CreditsHistorySchema = new Schema<ICreditsHistory>(
  {
    userId: { type: String, required: true },
    delta: { type: Number, required: true },
    reason: { 
      type: String, 
      required: true,
      enum: ['signup_bonus', 'agent_run', 'admin_adjustment', 'refund', 'purchase']
    },
    agentId: { type: Schema.Types.ObjectId, ref: 'Agent', default: null },
    sessionId: { type: Schema.Types.ObjectId, ref: 'AgentSession', default: null },
    balanceAfter: { type: Number, required: true, min: 0 },
    metadata: { type: Schema.Types.Mixed, default: null },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    collection: 'credits_history',
  }
);

// Indexes for performance and querying
CreditsHistorySchema.index({ userId: 1, createdAt: -1 });
CreditsHistorySchema.index({ sessionId: 1 });
CreditsHistorySchema.index({ reason: 1 });

const CreditsHistory: Model<ICreditsHistory> = mongoose.models.CreditsHistory || mongoose.model<ICreditsHistory>('CreditsHistory', CreditsHistorySchema);

export default CreditsHistory;
