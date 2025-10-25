import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { connectDB, UserPreferences } from '@/server/db';

export async function GET() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    await connectDB();

    let preferences = await UserPreferences.findOne({ userId });

    if (!preferences) {
      preferences = await UserPreferences.create({
        userId,
        notificationsEnabled: true,
      });
    }

    return NextResponse.json({
      notificationsEnabled: preferences.notificationsEnabled,
    });
  } catch (error) {
    console.error('Error fetching user preferences:', error);
    return NextResponse.json(
      { error: 'Failed to fetch preferences' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    await connectDB();

    const body = await request.json();
    const { notificationsEnabled } = body;

    if (typeof notificationsEnabled !== 'boolean') {
      return NextResponse.json(
        { error: 'Invalid preferences data' },
        { status: 400 }
      );
    }

    const preferences = await UserPreferences.findOneAndUpdate(
      { userId },
      { notificationsEnabled },
      { new: true, upsert: true }
    );

    return NextResponse.json({
      notificationsEnabled: preferences.notificationsEnabled,
    });
  } catch (error) {
    console.error('Error updating user preferences:', error);
    return NextResponse.json(
      { error: 'Failed to update preferences' },
      { status: 500 }
    );
  }
}
