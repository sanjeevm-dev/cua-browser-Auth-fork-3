import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { connectDB, AgentSession, Agent } from '../../../../../server/db';
import { getUserId } from '@/app/lib/auth-helpers';

// GET /api/agents/[id]/sessions - Get all sessions for an agent
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

    // Verify agent ownership
    const agent = await Agent.findOne({ _id: id, userId });
    if (!agent) {
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      );
    }

    const sessions = await AgentSession.find({ agentId: id, userId })
      .sort({ startedAt: -1 })
      .lean()
      .exec();

    const sessionsWithId = sessions.map(session => ({
      ...session,
      id: session._id.toString(),
      agentId: session.agentId.toString(),
      _id: undefined,
    }));

    return NextResponse.json({ sessions: sessionsWithId });
  } catch (error) {
    console.error('Error fetching sessions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch sessions' },
      { status: 500 }
    );
  }
}

// POST /api/agents/[id]/sessions - Create a new session for an agent
export async function POST(
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

    // Verify agent ownership
    const agent = await Agent.findOne({ _id: id, userId });
    if (!agent) {
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      );
    }

    const newSession = await AgentSession.create({
      userId,
      agentId: id,
      browserSessionId: body.browserSessionId || null,
      status: 'running',
    });

    const sessionResponse = {
      ...newSession.toObject(),
      id: newSession._id.toString(),
      agentId: newSession.agentId.toString(),
      _id: undefined,
    };

    return NextResponse.json({ session: sessionResponse }, { status: 201 });
  } catch (error) {
    console.error('Error creating session:', error);
    return NextResponse.json(
      { error: 'Failed to create session' },
      { status: 500 }
    );
  }
}
