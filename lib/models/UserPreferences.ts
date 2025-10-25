import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IUserPreferences extends Document {
  _id: mongoose.Types.ObjectId;
  userId: string;
  notificationsEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const UserPreferencesSchema = new Schema<IUserPreferences>(
  {
    userId: { type: String, required: true, unique: true },
    notificationsEnabled: { type: Boolean, default: true },
  },
  {
    timestamps: true,
    collection: 'user_preferences',
  }
);

const UserPreferences: Model<IUserPreferences> = 
  mongoose.models.UserPreferences || 
  mongoose.model<IUserPreferences>('UserPreferences', UserPreferencesSchema);

export default UserPreferences;
