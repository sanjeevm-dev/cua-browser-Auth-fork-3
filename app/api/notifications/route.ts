import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { connectDB } from '@/server/db';
import NotificationService from '@/lib/services/NotificationService';
import { NotificationCategory } from '@/lib/types/mongodb';

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    await connectDB();

    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '15');
    const skip = parseInt(searchParams.get('skip') || '0');
    const category = searchParams.get('category') as NotificationCategory | null;
    const status = searchParams.get('status') as 'unread' | 'read' | null;

    const options: {
      limit: number;
      skip: number;
      category?: NotificationCategory;
      status?: 'unread' | 'read';
    } = { limit, skip };
    if (category) options.category = category;
    if (status) options.status = status;

    const result = await NotificationService.findNotifications(userId, options);

    const serializedNotifications = result.notifications.map((notif) => ({
      id: (notif as { _id: { toString: () => string } })._id.toString(),
      userId: notif.userId,
      typeKey: notif.typeKey,
      category: notif.category,
      title: notif.title,
      body: notif.body,
      icon: notif.icon,
      status: notif.status,
      priority: notif.priority,
      metadata: notif.metadata || {},
      createdAt: (notif.createdAt as Date).toISOString(),
      readAt: notif.readAt ? (notif.readAt as Date).toISOString() : null,
      expiresAt: notif.expiresAt ? (notif.expiresAt as Date).toISOString() : null,
    }));

    return NextResponse.json({
      notifications: serializedNotifications,
      total: result.total,
      hasMore: result.hasMore
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    return NextResponse.json(
      { error: 'Failed to fetch notifications' },
      { status: 500 }
    );
  }
}
