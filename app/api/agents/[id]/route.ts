import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { connectDB, Agent, AgentSession, AgentContext, SessionLog, AgentTask, DailyTask, BrowserbaseContext } from '../../../../server/db';
import { getUserId } from '@/app/lib/auth-helpers';

// GET /api/agents/[id] - Get a specific agent with its sessions and context
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId, error } = await getUserId();
  if (error) return error;

  try {
    const { id } = await params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { error: 'Invalid agent ID' },
        { status: 400 }
      );
    }

    await connectDB();

    // Get agent details - ensure it belongs to the user
    const agent = await Agent.findOne({ _id: id, userId }).lean().exec();

    if (!agent) {
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      );
    }

    // Get recent sessions - ensure they belong to the user
    const sessions = await AgentSession.find({ agentId: id, userId })
      .sort({ startedAt: -1 })
      .limit(10)
      .lean()
      .exec();

    // Get context - ensure it belongs to the user
    const context = await AgentContext.find({ agentId: id, userId })
      .lean()
      .exec();

    // Convert MongoDB _id to id for frontend compatibility
    const agentWithId = {
      ...agent,
      id: agent._id.toString(),
      _id: undefined,
    };

    const sessionsWithId = sessions.map(session => ({
      ...session,
      id: session._id.toString(),
      agentId: session.agentId.toString(),
      _id: undefined,
    }));

    const contextWithId = context.map(ctx => ({
      ...ctx,
      id: ctx._id.toString(),
      agentId: ctx.agentId.toString(),
      _id: undefined,
    }));

    return NextResponse.json({
      agent: agentWithId,
      sessions: sessionsWithId,
      context: contextWithId,
    });
  } catch (error) {
    console.error('Error fetching agent:', error);
    return NextResponse.json(
      { error: 'Failed to fetch agent' },
      { status: 500 }
    );
  }
}

// PUT /api/agents/[id] - Update an agent
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId, error } = await getUserId();
  if (error) return error;

  try {
    const { id } = await params;
    const body = await request.json();

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { error: 'Invalid agent ID' },
        { status: 400 }
      );
    }

    await connectDB();

    // Check if agent exists and belongs to user
    const existingAgent = await Agent.findOne({ _id: id, userId });

    if (!existingAgent) {
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      );
    }

    // Update agent
    const updateData: Record<string, unknown> = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.systemPrompt !== undefined) updateData.systemPrompt = body.systemPrompt;
    if (body.targetWebsite !== undefined) updateData.targetWebsite = body.targetWebsite;
    if (body.authCredentials !== undefined) updateData.authCredentials = body.authCredentials;
    if (body.knowledgeBase !== undefined) updateData.knowledgeBase = body.knowledgeBase;
    if (body.runtimePerDay !== undefined) updateData.runtimePerDay = body.runtimePerDay;
    if (body.isDeployed !== undefined) updateData.isDeployed = body.isDeployed;

    // Validate that at least one field is being updated
    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields provided for update' },
        { status: 400 }
      );
    }

    const updatedAgent = await Agent.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true }
    ).lean().exec();

    const agentResponse = {
      ...updatedAgent,
      id: updatedAgent!._id.toString(),
      _id: undefined,
    };

    return NextResponse.json({ agent: agentResponse });
  } catch (error) {
    console.error('Error updating agent:', error);
    return NextResponse.json(
      { error: 'Failed to update agent' },
      { status: 500 }
    );
  }
}

// DELETE /api/agents/[id] - Delete an agent
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId, error } = await getUserId();
  if (error) return error;

  try {
    const { id } = await params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { error: 'Invalid agent ID' },
        { status: 400 }
      );
    }

    await connectDB();

    // Check if agent exists and belongs to user
    const existingAgent = await Agent.findOne({ _id: id, userId });

    if (!existingAgent) {
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      );
    }

    // Delete agent and all related documents (cascade delete) - only for this user
    await Promise.all([
      Agent.findOneAndDelete({ _id: id, userId }),
      AgentSession.deleteMany({ agentId: id, userId }),
      AgentContext.deleteMany({ agentId: id, userId }),
      AgentTask.deleteMany({ agentId: id }),
      DailyTask.deleteMany({ agentId: id }),
      BrowserbaseContext.deleteMany({ agentId: id }),
    ]);

    // Also delete session logs for all sessions of this agent belonging to the user
    const sessions = await AgentSession.find({ agentId: id, userId }).select('_id').lean();
    const sessionIds = sessions.map(s => s._id);
    if (sessionIds.length > 0) {
      await SessionLog.deleteMany({ sessionId: { $in: sessionIds }, userId });
    }

    return NextResponse.json({ message: 'Agent deleted successfully' });
  } catch (error) {
    console.error('Error deleting agent:', error);
    return NextResponse.json(
      { error: 'Failed to delete agent' },
      { status: 500 }
    );
  }
}
