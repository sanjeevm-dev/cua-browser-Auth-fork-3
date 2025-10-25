import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { connectDB, AgentTask } from '../../../../../../server/db';

// GET /api/agents/[id]/tasks/[taskId] - Get a specific task
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; taskId: string }> }
) {
  try {
    const { id, taskId } = await params;

    if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(taskId)) {
      return NextResponse.json(
        { error: 'Invalid agent ID or task ID' },
        { status: 400 }
      );
    }

    await connectDB();

    const task = await AgentTask.findOne({ _id: taskId, agentId: id }).lean().exec();

    if (!task) {
      return NextResponse.json(
        { error: 'Task not found' },
        { status: 404 }
      );
    }

    const taskResponse = {
      ...task,
      id: task._id.toString(),
      agentId: task.agentId.toString(),
      nextTaskId: task.nextTaskId ? task.nextTaskId.toString() : null,
      _id: undefined,
    };

    return NextResponse.json({ task: taskResponse });
  } catch (error) {
    console.error('Error fetching task:', error);
    return NextResponse.json(
      { error: 'Failed to fetch task' },
      { status: 500 }
    );
  }
}

// PUT /api/agents/[id]/tasks/[taskId] - Update a task
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string; taskId: string }> }
) {
  try {
    const { id, taskId } = await params;
    const body = await request.json();

    if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(taskId)) {
      return NextResponse.json(
        { error: 'Invalid agent ID or task ID' },
        { status: 400 }
      );
    }

    await connectDB();

    // Check if task exists and belongs to this agent
    const existingTask = await AgentTask.findOne({ _id: taskId, agentId: id }).exec();

    if (!existingTask) {
      return NextResponse.json(
        { error: 'Task not found' },
        { status: 404 }
      );
    }

    // Build update object
    const updateData: Record<string, unknown> = {};
    if (body.taskDescription !== undefined) updateData.taskDescription = body.taskDescription;
    if (body.taskType !== undefined) updateData.taskType = body.taskType;
    if (body.priority !== undefined) updateData.priority = body.priority;
    if (body.frequency !== undefined) updateData.frequency = body.frequency;
    if (body.status !== undefined) updateData.status = body.status;
    if (body.scheduledFor !== undefined) updateData.scheduledFor = body.scheduledFor;
    if (body.completedAt !== undefined) updateData.completedAt = body.completedAt;
    if (body.result !== undefined) updateData.result = body.result;
    if (body.nextTaskId !== undefined) updateData.nextTaskId = body.nextTaskId;
    if (body.executionHistory !== undefined) updateData.executionHistory = body.executionHistory;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields provided for update' },
        { status: 400 }
      );
    }

    const updatedTask = await AgentTask.findOneAndUpdate(
      { _id: taskId, agentId: id },
      { $set: updateData },
      { new: true, runValidators: true }
    ).lean().exec();

    const taskResponse = {
      ...updatedTask,
      id: updatedTask!._id.toString(),
      agentId: updatedTask!.agentId.toString(),
      nextTaskId: updatedTask!.nextTaskId ? updatedTask!.nextTaskId.toString() : null,
      _id: undefined,
    };

    return NextResponse.json({ task: taskResponse });
  } catch (error) {
    console.error('Error updating task:', error);
    return NextResponse.json(
      { error: 'Failed to update task' },
      { status: 500 }
    );
  }
}

// DELETE /api/agents/[id]/tasks/[taskId] - Delete a task
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; taskId: string }> }
) {
  try {
    const { id, taskId } = await params;

    if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(taskId)) {
      return NextResponse.json(
        { error: 'Invalid agent ID or task ID' },
        { status: 400 }
      );
    }

    await connectDB();

    // Check if task exists and belongs to this agent
    const existingTask = await AgentTask.findOne({ _id: taskId, agentId: id }).exec();

    if (!existingTask) {
      return NextResponse.json(
        { error: 'Task not found' },
        { status: 404 }
      );
    }

    await AgentTask.findOneAndDelete({ _id: taskId, agentId: id }).exec();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting task:', error);
    return NextResponse.json(
      { error: 'Failed to delete task' },
      { status: 500 }
    );
  }
}
