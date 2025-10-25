import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { connectDB, DailyTask } from '../../../../../server/db';
import { getUserId } from '@/app/lib/auth-helpers';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId, error } = await getUserId();
    if (error) return error;

    const { id } = await params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid agent ID' }, { status: 400 });
    }

    await connectDB();

    const tasks = await DailyTask.find({ agentId: id, userId })
      .sort({ dayNumber: 1 })
      .lean()
      .exec();

    const tasksWithId = tasks.map(task => ({
      ...task,
      id: task._id.toString(),
      agentId: task.agentId.toString(),
      _id: undefined,
    }));

    return NextResponse.json({ dailyTasks: tasksWithId });
  } catch (error) {
    console.error('Error fetching daily tasks:', error);
    return NextResponse.json(
      { error: 'Failed to fetch daily tasks' },
      { status: 500 }
    );
  }
}
