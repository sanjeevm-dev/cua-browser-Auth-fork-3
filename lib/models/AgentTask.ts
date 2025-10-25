import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IAgentTask extends Document {
  _id: mongoose.Types.ObjectId;
  userId: string;
  agentId: mongoose.Types.ObjectId;
  taskDescription: string;
  taskType: string;
  priority: number;
  frequency: string;
  status: string;
  result?: Record<string, unknown> | null;
  scheduledFor?: Date | null;
  completedAt?: Date | null;
  nextTaskId?: mongoose.Types.ObjectId | null;
  executionHistory?: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

const AgentTaskSchema = new Schema<IAgentTask>(
  {
    userId: { type: String, required: true },
    agentId: { type: Schema.Types.ObjectId, ref: 'Agent', required: true },
    taskDescription: { type: String, required: true },
    taskType: { type: String, required: true },
    priority: { type: Number, required: true, default: 1 },
    frequency: { type: String, required: true, default: 'once' },
    status: { type: String, required: true, default: 'pending' },
    result: { type: Schema.Types.Mixed, default: null },
    scheduledFor: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    nextTaskId: { type: Schema.Types.ObjectId, ref: 'AgentTask', default: null },
    executionHistory: { type: Schema.Types.Mixed, default: null },
  },
  {
    timestamps: true,
    collection: 'agent_tasks',
  }
);

// Indexes for performance
AgentTaskSchema.index({ userId: 1, agentId: 1, status: 1 });
AgentTaskSchema.index({ userId: 1, scheduledFor: 1 });
AgentTaskSchema.index({ userId: 1, priority: -1 });

const AgentTask: Model<IAgentTask> = 
  mongoose.models.AgentTask || mongoose.model<IAgentTask>('AgentTask', AgentTaskSchema);

export default AgentTask;
