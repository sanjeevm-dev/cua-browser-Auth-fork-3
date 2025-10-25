import mongoose, { Schema, Document, Model } from 'mongoose';

export type NotificationTypeKey = 
  | 'task_completed'
  | 'task_failed'
  | 'agent_deployed'
  | 'agent_paused'
  | 'agent_created'
  | 'credits_low'
  | 'credits_exhausted'
  | 'daily_digest'
  | 'system_maintenance';

export type NotificationCategory = 'agent' | 'credits' | 'results' | 'system';
export type NotificationStatus = 'unread' | 'read';
export type NotificationPriority = 'critical' | 'warning' | 'info';

export interface IUserNotification extends Document {
  _id: mongoose.Types.ObjectId;
  userId: string;
  typeKey: NotificationTypeKey;
  category: NotificationCategory;
  title: string;
  body: string;
  icon: string;
  status: NotificationStatus;
  priority: NotificationPriority;
  metadata?: {
    agentId?: string;
    agentName?: string;
    sessionId?: string;
    creditBalance?: number;
    errorMessage?: string;
    [key: string]: unknown;
  };
  createdAt: Date;
  readAt?: Date | null;
  expiresAt?: Date | null;
}

const UserNotificationSchema = new Schema<IUserNotification>(
  {
    userId: { type: String, required: true },
    typeKey: { 
      type: String, 
      required: true,
      enum: [
        'task_completed',
        'task_failed',
        'agent_deployed',
        'agent_paused',
        'agent_created',
        'credits_low',
        'credits_exhausted',
        'daily_digest',
        'system_maintenance'
      ]
    },
    category: { 
      type: String, 
      required: true,
      enum: ['agent', 'credits', 'results', 'system']
    },
    title: { type: String, required: true },
    body: { type: String, required: true },
    icon: { type: String, required: true },
    status: { 
      type: String, 
      required: true, 
      enum: ['unread', 'read'],
      default: 'unread'
    },
    priority: { 
      type: String, 
      required: true,
      enum: ['critical', 'warning', 'info'],
      default: 'info'
    },
    metadata: { type: Schema.Types.Mixed, default: {} },
    readAt: { type: Date, default: null },
    expiresAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    collection: 'user_notifications',
  }
);

UserNotificationSchema.index({ userId: 1, status: 1, createdAt: -1 });
UserNotificationSchema.index({ userId: 1, createdAt: -1 });
UserNotificationSchema.index({ userId: 1, category: 1, createdAt: -1 });
UserNotificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const UserNotification: Model<IUserNotification> = 
  mongoose.models.UserNotification || 
  mongoose.model<IUserNotification>('UserNotification', UserNotificationSchema);

export default UserNotification;
