import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { connectDB, AgentContext, Agent } from '../../../../../server/db';
import { createContextSchema, validateRequest } from '../../../../lib/validation';
import { getUserId } from '@/app/lib/auth-helpers';

// GET /api/agents/[id]/context - Get all context for an agent
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId, error } = await getUserId();
  if (error) return error;

  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const contextKey = searchParams.get('key');

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

    let context;
    if (contextKey) {
      // Get specific context by key
      const ctx = await AgentContext.findOne({ agentId: id, userId, contextKey }).lean().exec();
      if (ctx) {
        context = {
          ...ctx,
          id: ctx._id.toString(),
          agentId: ctx.agentId.toString(),
          _id: undefined,
        };
      }
    } else {
      // Get all context for the agent
      const contexts = await AgentContext.find({ agentId: id, userId }).lean().exec();
      context = contexts.map(ctx => ({
        ...ctx,
        id: ctx._id.toString(),
        agentId: ctx.agentId.toString(),
        _id: undefined,
      }));
    }

    return NextResponse.json({ context: context || null });
  } catch (error) {
    console.error('Error fetching context:', error);
    return NextResponse.json(
      { error: 'Failed to fetch context' },
      { status: 500 }
    );
  }
}

// POST /api/agents/[id]/context - Set context for an agent
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

    const validation = validateRequest(createContextSchema, body);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }
    const validatedData = validation.data;

    await connectDB();

    // Verify agent ownership
    const agent = await Agent.findOne({ _id: id, userId });
    if (!agent) {
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      );
    }

    // Upsert context (insert or update if exists)
    const contextItem = await AgentContext.findOneAndUpdate(
      { agentId: id, userId, contextKey: validatedData.contextKey },
      {
        $set: {
          contextValue: validatedData.contextValue,
          updatedAt: new Date(),
        },
        $setOnInsert: {
          userId,
          agentId: id,
          contextKey: validatedData.contextKey,
        }
      },
      { upsert: true, new: true, runValidators: true }
    ).lean().exec();

    const contextResponse = {
      ...contextItem,
      id: contextItem!._id.toString(),
      agentId: contextItem!.agentId.toString(),
      _id: undefined,
    };

    return NextResponse.json({ context: contextResponse });
  } catch (error) {
    console.error('Error setting context:', error);
    return NextResponse.json(
      { error: 'Failed to set context' },
      { status: 500 }
    );
  }
}
