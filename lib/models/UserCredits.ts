import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IUserCredits extends Document {
  _id: mongoose.Types.ObjectId;
  userId: string;
  credits: number;
  createdAt: Date;
  updatedAt: Date;
}

const UserCreditsSchema = new Schema<IUserCredits>(
  {
    userId: { type: String, required: true, unique: true },
    credits: { type: Number, required: true, default: 0, min: 0 },
  },
  {
    timestamps: true,
    collection: 'user_credits',
  }
);

// Indexes for performance
UserCreditsSchema.index({ userId: 1 }, { unique: true });

const UserCredits: Model<IUserCredits> = mongoose.models.UserCredits || mongoose.model<IUserCredits>('UserCredits', UserCreditsSchema);

export default UserCredits;
