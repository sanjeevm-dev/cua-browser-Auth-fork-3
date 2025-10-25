import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { connectDB, Agent, AgentTask, AgentSession, AgentContext } from '../../../../../server/db';
import Browserbase from '@browserbasehq/sdk';
import { applyRateLimit, agentExecutionRateLimiter } from '@/app/lib/rate-limiter';
import { getUserId } from '@/app/lib/auth-helpers';
import NotificationService from '@/lib/services/NotificationService';

// Instantiate Browserbase inside the handler to avoid build-time env requirements

// POST /api/agents/[id]/execute - Execute the next pending task for an agent
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const rateLimit = await applyRateLimit(request, agentExecutionRateLimiter);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { 
        status: 429,
        headers: rateLimit.headers
      }
    );
  }

  try {
    if (!process.env.BROWSERBASE_API_KEY) {
      return NextResponse.json(
        { error: 'Missing BROWSERBASE_API_KEY' },
        { status: 500, headers: rateLimit.headers }
      );
    }
    const browserbase = new Browserbase({ apiKey: process.env.BROWSERBASE_API_KEY });
    const { userId, error } = await getUserId();
    if (error) return error;

    const { id } = await params;
    const agentId = id;

    if (!mongoose.Types.ObjectId.isValid(agentId)) {
      return NextResponse.json(
        { error: 'Invalid agent ID' },
        { status: 400, headers: rateLimit.headers }
      );
    }

    await connectDB();

    // Get agent details with userId verification
    const agent = await Agent.findOne({ _id: agentId, userId });

    if (!agent) {
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404, headers: rateLimit.headers }
      );
    }

    // Get the highest priority pending task with userId filtering
    const nextTask = await AgentTask.findOne({
      agentId,
      userId,
      status: 'pending'
    }).sort({ priority: 1 });

    if (!nextTask) {
      return NextResponse.json(
        { message: 'No pending tasks for this agent' },
        { status: 200, headers: rateLimit.headers }
      );
    }

    // Update task status to in_progress
    await AgentTask.findByIdAndUpdate(nextTask._id, {
      status: 'in_progress',
      updatedAt: new Date()
    });

    // Get agent's memory/context with userId filtering
    const contextItems = await AgentContext.find({ agentId, userId });

    const contextMemory = contextItems.reduce((acc, item) => {
      acc[item.contextKey] = item.contextValue;
      return acc;
    }, {} as Record<string, unknown>);

    // Create a new session with userId
    const session = await AgentSession.create({
      userId,
      agentId: agentId,
      status: 'running',
      startedAt: new Date(),
    });

    // Create browserbase session
    const bbSession = await browserbase.sessions.create({
      projectId: process.env.BROWSERBASE_PROJECT_ID!,
    });

    // Build enhanced system prompt with context and task
    const enhancedPrompt = `${agent.systemPrompt}

CURRENT TASK: ${nextTask.taskDescription}
Task Type: ${nextTask.taskType}
Priority: ${nextTask.priority}

USER EXPECTATIONS: ${agent.userExpectations || 'Not specified'}

AGENT MEMORY (Previous Sessions):
${Object.keys(contextMemory).length > 0 ? JSON.stringify(contextMemory, null, 2) : 'No previous memory'}

KNOWLEDGE BASE:
${agent.knowledgeBase || 'None'}

Your goal is to complete this task autonomously. Use the browser automation to navigate websites, interact with elements, and gather information. After completing the task, you should update your memory with key learnings.`;

    // Execute task using CUA (simplified - you'll integrate your full CUA agent here)
    const result = await executeTaskWithCUA(
      bbSession.id,
      enhancedPrompt,
      nextTask
    );

    // Update task status based on result
    const taskUpdate = result.success 
      ? { 
          status: 'completed' as const,
          result: result.data,
          completedAt: new Date(),
          updatedAt: new Date()
        }
      : { 
          status: 'failed' as const,
          result: { error: result.error },
          updatedAt: new Date()
        };

    await AgentTask.findByIdAndUpdate(nextTask._id, taskUpdate);

    // Update session status
    await AgentSession.findByIdAndUpdate(session._id, {
      status: result.success ? 'completed' : 'failed',
      completedAt: new Date(),
    });

    // Create notification for task completion or failure
    if (userId) {
      try {
        if (result.success) {
          await NotificationService.createNotification({
            userId,
            typeKey: 'task_completed',
            metadata: {
              agentId: agentId,
              agentName: agent.name,
              sessionId: session._id.toString(),
            }
          });
        } else {
          await NotificationService.createNotification({
            userId,
            typeKey: 'task_failed',
            metadata: {
              agentId: agentId,
              agentName: agent.name,
              sessionId: session._id.toString(),
              errorMessage: result.error || 'Unknown error',
            }
          });
        }
      } catch (notifError) {
        console.error('Error creating notification:', notifError);
      }
    }

    // Store learnings in agent context if successful
    if (result.success && result.learnings) {
      const learningKey = `task_${nextTask._id}_learning_${Date.now()}`;
      await AgentContext.create({
        userId,
        agentId: agentId,
        contextKey: learningKey,
        contextValue: result.learnings,
      });
    }

    return NextResponse.json({
      success: true,
      session: session,
      task: nextTask,
      result: result,
    }, { status: 200, headers: rateLimit.headers });

  } catch (error) {
    console.error('Error executing agent task:', error);
    return NextResponse.json(
      { error: 'Failed to execute agent task' },
      { status: 500, headers: rateLimit.headers }
    );
  }
}

// Helper function to execute task with CUA
async function executeTaskWithCUA(
  browserbaseSessionId: string,
  systemPrompt: string,
  task: { taskDescription: string; taskType: string }
): Promise<{ success: boolean; data?: unknown; error?: string; learnings?: unknown }> {
  try {
    // This is a placeholder - integrate your full CUA agent logic here
    // For now, we'll just log the execution
    
    console.log('Executing task with CUA:', {
      sessionId: browserbaseSessionId,
      task: task.taskDescription,
      type: task.taskType
    });

    // Simulate task execution (replace with actual CUA integration)
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Return mock success (replace with actual CUA results)
    return {
      success: true,
      data: {
        taskCompleted: task.taskDescription,
        timestamp: new Date().toISOString(),
      },
      learnings: {
        taskType: task.taskType,
        completed: true,
        notes: 'Task executed successfully'
      }
    };

  } catch (error: unknown) {
    console.error('CUA execution error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error during task execution'
    };
  }
}
