import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ISessionLog extends Document {
  _id: mongoose.Types.ObjectId;
  userId: string;
  sessionId: mongoose.Types.ObjectId;
  stepNumber: number;
  timestamp: Date;
  tool: string;
  instruction: string;
  reasoning?: string | null;
  output?: Record<string, unknown> | null;
  screenshotUrl?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const SessionLogSchema = new Schema<ISessionLog>(
  {
    userId: { type: String, required: true },
    sessionId: { type: Schema.Types.ObjectId, ref: 'AgentSession', required: true },
    stepNumber: { type: Number, required: true },
    timestamp: { type: Date, default: () => new Date(), required: true },
    tool: { type: String, required: true },
    instruction: { type: String, required: true },
    reasoning: { type: String, default: null },
    output: { type: Schema.Types.Mixed, default: null },
    screenshotUrl: { type: String, default: null },
  },
  {
    timestamps: true,
    collection: 'session_logs',
  }
);

// Indexes for performance
SessionLogSchema.index({ userId: 1, sessionId: 1, stepNumber: 1 });
SessionLogSchema.index({ userId: 1, timestamp: -1 });

const SessionLog: Model<ISessionLog> = 
  mongoose.models.SessionLog || mongoose.model<ISessionLog>('SessionLog', SessionLogSchema);

export default SessionLog;
