import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IAgentSession extends Document {
  _id: mongoose.Types.ObjectId;
  userId: string;
  agentId: mongoose.Types.ObjectId;
  browserSessionId?: string | null;
  startedAt: Date;
  completedAt?: Date | null;
  status: 'running' | 'completed' | 'failed' | 'stopped';
  summary?: string | null;
  errorMessage?: string | null;
  totalSteps: number;
  createdAt: Date;
  updatedAt: Date;
}

const AgentSessionSchema = new Schema<IAgentSession>(
  {
    userId: { type: String, required: true },
    agentId: { type: Schema.Types.ObjectId, ref: 'Agent', required: true },
    browserSessionId: { type: String, default: null },
    startedAt: { type: Date, default: () => new Date(), required: true },
    completedAt: { type: Date, default: null },
    status: { 
      type: String, 
      enum: ['running', 'completed', 'failed', 'stopped'],
      default: 'running',
      required: true 
    },
    summary: { type: String, default: null },
    errorMessage: { type: String, default: null },
    totalSteps: { type: Number, default: 0 },
  },
  {
    timestamps: true,
    collection: 'agent_sessions',
  }
);

// Indexes for performance
AgentSessionSchema.index({ userId: 1, agentId: 1, startedAt: -1 });
AgentSessionSchema.index({ userId: 1, status: 1 });
AgentSessionSchema.index({ browserSessionId: 1 });

const AgentSession: Model<IAgentSession> = 
  mongoose.models.AgentSession || mongoose.model<IAgentSession>('AgentSession', AgentSessionSchema);

export default AgentSession;
