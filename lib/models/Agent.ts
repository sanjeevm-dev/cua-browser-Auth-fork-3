import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IAgent extends Document {
  _id: mongoose.Types.ObjectId;
  userId: string;
  name: string;
  description?: string | null;
  systemPrompt: string;
  executionPrompt?: string | null;
  targetWebsite?: string | null;
  authCredentials?: Record<string, unknown> | null;
  knowledgeBase?: string | null;
  userExpectations?: string | null;
  planningData?: Record<string, unknown> | null;
  platforms?: string[];
  runtimePerDay: number;
  executionMode: 'one-shot' | 'multi-step';
  isDeployed: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const AgentSchema = new Schema<IAgent>(
  {
    userId: { type: String, required: true },
    name: { type: String, required: true },
    description: { type: String, default: null },
    systemPrompt: { type: String, required: true },
    executionPrompt: { type: String, default: null },
    targetWebsite: { type: String, default: null },
    authCredentials: { type: Schema.Types.Mixed, default: null },
    knowledgeBase: { type: String, default: null },
    userExpectations: { type: String, default: null },
    planningData: { type: Schema.Types.Mixed, default: null },
    platforms: { type: [String], default: [] },
    runtimePerDay: { type: Number, required: true, default: 15 },
    executionMode: { type: String, enum: ['one-shot', 'multi-step'], default: 'multi-step' },
    isDeployed: { type: Boolean, default: false },
  },
  {
    timestamps: true,
    collection: 'agents',
  }
);

// Indexes for performance
AgentSchema.index({ userId: 1, createdAt: -1 });
AgentSchema.index({ userId: 1, isDeployed: 1 });

const Agent: Model<IAgent> = mongoose.models.Agent || mongoose.model<IAgent>('Agent', AgentSchema);

export default Agent;
