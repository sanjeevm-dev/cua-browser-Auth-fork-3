import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { connectDB, AgentTask } from '../../../../../server/db';
import { createTaskSchema, validateRequest } from '../../../../lib/validation';
import { getUserId } from '@/app/lib/auth-helpers';

// GET /api/agents/[id]/tasks - Get all tasks for an agent
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId, error } = await getUserId();
    if (error) return error;

    const { id } = await params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { error: 'Invalid agent ID' },
        { status: 400 }
      );
    }

    await connectDB();

    const tasks = await AgentTask.find({ agentId: id, userId })
      .sort({ priority: -1, createdAt: -1 })
      .lean()
      .exec();

    const tasksWithId = tasks.map(task => ({
      ...task,
      id: task._id.toString(),
      agentId: task.agentId.toString(),
      nextTaskId: task.nextTaskId ? task.nextTaskId.toString() : null,
      _id: undefined,
    }));

    return NextResponse.json({ tasks: tasksWithId });
  } catch (error) {
    console.error('Error fetching tasks:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tasks' },
      { status: 500 }
    );
  }
}

// POST /api/agents/[id]/tasks - Create a new task for an agent
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId, error } = await getUserId();
    if (error) return error;

    const { id } = await params;
    const body = await request.json();

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { error: 'Invalid agent ID' },
        { status: 400 }
      );
    }

    const validation = validateRequest(createTaskSchema, body);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }
    const validatedData = validation.data;

    const bodyWithExtra = body as Record<string, unknown>;

    await connectDB();

    const newTask = await AgentTask.create({
      userId,
      agentId: id,
      taskDescription: validatedData.taskDescription,
      taskType: validatedData.taskType,
      priority: validatedData.priority || 3,
      frequency: validatedData.frequency || 'once',
      status: (bodyWithExtra.status as string | undefined) || 'pending',
      scheduledFor: (bodyWithExtra.scheduledFor as Date | null | undefined) || null,
      nextTaskId: (bodyWithExtra.nextTaskId as string | null | undefined) || null,
    });

    const taskResponse = {
      ...newTask.toObject(),
      id: newTask._id.toString(),
      agentId: newTask.agentId.toString(),
      nextTaskId: newTask.nextTaskId ? newTask.nextTaskId.toString() : null,
      _id: undefined,
    };

    return NextResponse.json({ task: taskResponse }, { status: 201 });
  } catch (error) {
    console.error('Error creating task:', error);
    return NextResponse.json(
      { error: 'Failed to create task' },
      { status: 500 }
    );
  }
}
