import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IAgentContext extends Document {
  _id: mongoose.Types.ObjectId;
  userId: string;
  agentId: mongoose.Types.ObjectId;
  contextKey: string;
  contextValue: string;
  createdAt: Date;
  updatedAt: Date;
}

const AgentContextSchema = new Schema<IAgentContext>(
  {
    userId: { type: String, required: true },
    agentId: { type: Schema.Types.ObjectId, ref: 'Agent', required: true },
    contextKey: { type: String, required: true },
    contextValue: { type: String, required: true },
  },
  {
    timestamps: true,
    collection: 'agent_context',
  }
);

// Unique compound index to ensure one key per agent
AgentContextSchema.index({ userId: 1, agentId: 1, contextKey: 1 }, { unique: true });

const AgentContext: Model<IAgentContext> = 
  mongoose.models.AgentContext || mongoose.model<IAgentContext>('AgentContext', AgentContextSchema);

export default AgentContext;
