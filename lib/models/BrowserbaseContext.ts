import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IBrowserbaseContext extends Document {
  _id: mongoose.Types.ObjectId;
  userId: string;
  agentId: mongoose.Types.ObjectId;
  platform: string;
  contextId: string;
  encryptedCookies?: string | null;
  fingerprintId?: string | null;
  proxyConfig?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
  isActive: boolean;
  lastUsedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const BrowserbaseContextSchema = new Schema<IBrowserbaseContext>(
  {
    userId: { type: String, required: true },
    agentId: { type: Schema.Types.ObjectId, ref: 'Agent', required: true },
    platform: { type: String, required: true },
    contextId: { type: String, required: true, unique: true },
    encryptedCookies: { type: String, default: null },
    fingerprintId: { type: String, default: null },
    proxyConfig: { type: Schema.Types.Mixed, default: null },
    metadata: { type: Schema.Types.Mixed, default: null },
    isActive: { type: Boolean, default: true },
    lastUsedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    collection: 'browserbase_contexts',
  }
);

// Indexes for performance
BrowserbaseContextSchema.index({ userId: 1, agentId: 1, platform: 1 });
BrowserbaseContextSchema.index({ userId: 1, contextId: 1 });
BrowserbaseContextSchema.index({ userId: 1, isActive: 1 });

const BrowserbaseContext: Model<IBrowserbaseContext> = 
  mongoose.models.BrowserbaseContext || mongoose.model<IBrowserbaseContext>('BrowserbaseContext', BrowserbaseContextSchema);

export default BrowserbaseContext;
