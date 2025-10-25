import UserNotification, { NotificationTypeKey, NotificationCategory, NotificationPriority } from '../models/UserNotification';
import { createHash } from 'crypto';

export interface NotificationTypeConfig {
  icon: string;
  category: NotificationCategory;
  priority: NotificationPriority;
  titleTemplate: string;
  bodyTemplate: string;
}

export const NOTIFICATION_TYPES: Record<NotificationTypeKey, NotificationTypeConfig> = {
  task_completed: {
    icon: 'CheckCircle',
    category: 'agent',
    priority: 'info',
    titleTemplate: 'Task Completed',
    bodyTemplate: '{agentName} has successfully completed its task'
  },
  task_failed: {
    icon: 'AlertTriangle',
    category: 'agent',
    priority: 'critical',
    titleTemplate: 'Task Failed',
    bodyTemplate: '{agentName} encountered an error: {errorMessage}'
  },
  agent_deployed: {
    icon: 'Rocket',
    category: 'agent',
    priority: 'info',
    titleTemplate: 'Agent Deployed',
    bodyTemplate: '{agentName} has been deployed and is now active'
  },
  agent_paused: {
    icon: 'PauseCircle',
    category: 'agent',
    priority: 'info',
    titleTemplate: 'Agent Paused',
    bodyTemplate: '{agentName} has been paused'
  },
  agent_created: {
    icon: 'PlusCircle',
    category: 'agent',
    priority: 'info',
    titleTemplate: 'Agent Created',
    bodyTemplate: '{agentName} has been created successfully'
  },
  credits_low: {
    icon: 'BatteryLow',
    category: 'credits',
    priority: 'warning',
    titleTemplate: 'Credits Running Low',
    bodyTemplate: 'Your credit balance is at {creditBalance}%. Consider topping up soon.'
  },
  credits_exhausted: {
    icon: 'BatteryCharging',
    category: 'credits',
    priority: 'critical',
    titleTemplate: 'Credits Exhausted',
    bodyTemplate: 'Your credits have been exhausted. All agents have been paused.'
  },
  daily_digest: {
    icon: 'BarChart',
    category: 'results',
    priority: 'info',
    titleTemplate: 'Daily Performance Summary',
    bodyTemplate: 'Your daily agent performance report is ready'
  },
  system_maintenance: {
    icon: 'Settings',
    category: 'system',
    priority: 'info',
    titleTemplate: 'System Maintenance',
    bodyTemplate: 'Scheduled maintenance will occur soon'
  }
};

interface CreateNotificationParams {
  userId: string;
  typeKey: NotificationTypeKey;
  metadata?: Record<string, unknown>;
  customTitle?: string;
  customBody?: string;
  expiresInDays?: number;
}

class NotificationService {
  private generateIdempotencyHash(userId: string, typeKey: NotificationTypeKey, context: string): string {
    return createHash('md5')
      .update(`${userId}-${typeKey}-${context}`)
      .digest('hex');
  }

  private interpolateTemplate(template: string, data: Record<string, unknown>): string {
    return template.replace(/\{(\w+)\}/g, (_, key) => String(data[key] || ''));
  }

  async createNotification({
    userId,
    typeKey,
    metadata = {},
    customTitle,
    customBody,
    expiresInDays
  }: CreateNotificationParams) {
    const config = NOTIFICATION_TYPES[typeKey];
    if (!config) {
      throw new Error(`Invalid notification type: ${typeKey}`);
    }

    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const existing = await UserNotification.findOne({
      userId,
      typeKey,
      createdAt: { $gte: oneDayAgo },
      'metadata.agentId': metadata.agentId,
      'metadata.sessionId': metadata.sessionId
    }).sort({ createdAt: -1 });

    if (existing) {
      if (typeKey === 'credits_low' || typeKey === 'credits_exhausted') {
        return existing;
      }
      
      if ((typeKey === 'task_completed' || typeKey === 'task_failed') && 
          metadata.sessionId === existing.metadata?.sessionId) {
        return existing;
      }
    }

    const title = customTitle || this.interpolateTemplate(config.titleTemplate, metadata);
    const body = customBody || this.interpolateTemplate(config.bodyTemplate, metadata);

    let expiresAt = null;
    if (expiresInDays) {
      expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + expiresInDays);
    }

    const notification = await UserNotification.create({
      userId,
      typeKey,
      category: config.category,
      title,
      body,
      icon: config.icon,
      status: 'unread',
      priority: config.priority,
      metadata,
      expiresAt
    });

    return notification;
  }

  async findNotifications(
    userId: string,
    options: {
      limit?: number;
      skip?: number;
      category?: NotificationCategory;
      status?: 'unread' | 'read';
    } = {}
  ) {
    const { limit = 15, skip = 0, category, status } = options;

    const query: {
      userId: string;
      category?: NotificationCategory;
      status?: 'unread' | 'read';
    } = { userId };
    if (category) query.category = category;
    if (status) query.status = status;

    const notifications = await UserNotification.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await UserNotification.countDocuments(query);

    return {
      notifications,
      total,
      hasMore: skip + notifications.length < total
    };
  }

  async markAsRead(notificationId: string, userId: string) {
    const notification = await UserNotification.findOneAndUpdate(
      { _id: notificationId, userId },
      { status: 'read', readAt: new Date() },
      { new: true }
    );

    return notification;
  }

  async markAllAsRead(userId: string) {
    const result = await UserNotification.updateMany(
      { userId, status: 'unread' },
      { status: 'read', readAt: new Date() }
    );

    return result.modifiedCount;
  }

  async getUnreadCount(userId: string): Promise<number> {
    const count = await UserNotification.countDocuments({
      userId,
      status: 'unread'
    });

    return count;
  }

  async deleteNotification(notificationId: string, userId: string) {
    const result = await UserNotification.deleteOne({
      _id: notificationId,
      userId
    });

    return result.deletedCount > 0;
  }
}

const notificationServiceInstance = new NotificationService();
export default notificationServiceInstance;
