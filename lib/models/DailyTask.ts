import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IDailyTask extends Document {
  _id: mongoose.Types.ObjectId;
  userId: string;
  agentId: mongoose.Types.ObjectId;
  dayNumber: number;
  taskPrompt: string;
  status: string;
  outcomes?: Record<string, unknown> | null;
  error?: string | null;
  completedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const DailyTaskSchema = new Schema<IDailyTask>(
  {
    userId: { type: String, required: true },
    agentId: { type: Schema.Types.ObjectId, ref: 'Agent', required: true },
    dayNumber: { type: Number, required: true },
    taskPrompt: { type: String, required: true },
    status: { type: String, required: true, default: 'pending' },
    outcomes: { type: Schema.Types.Mixed, default: null },
    error: { type: String, default: null },
    completedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    collection: 'daily_tasks',
  }
);

// Indexes for performance
DailyTaskSchema.index({ userId: 1, agentId: 1, dayNumber: 1 });
DailyTaskSchema.index({ userId: 1, status: 1 });

const DailyTask: Model<IDailyTask> = 
  mongoose.models.DailyTask || mongoose.model<IDailyTask>('DailyTask', DailyTaskSchema);

export default DailyTask;
