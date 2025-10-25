import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { connectDB, Agent, AgentSession, DailyTask } from '../../../../../server/db';
import Browserbase from '@browserbasehq/sdk';
import { getUserId } from '@/app/lib/auth-helpers';
import { deductCredits, calculateSessionMinutes } from '@/app/lib/credits';
import NotificationService from '@/lib/services/NotificationService';

// Instantiate Browserbase inside the handler to avoid build-time env requirements

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!process.env.BROWSERBASE_API_KEY) {
      return NextResponse.json(
        { error: 'Missing BROWSERBASE_API_KEY' },
        { status: 500 }
      );
    }
    const browserbase = new Browserbase({ apiKey: process.env.BROWSERBASE_API_KEY });
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

    // Get agent with userId verification
    const agent = await Agent.findOne({ _id: id, userId }).exec();

    if (!agent) {
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      );
    }

    // Find all running sessions for this agent with userId filtering
    const runningSessions = await AgentSession.find({ agentId: id, userId, status: 'running' }).exec();

    // Stop all running sessions
    const stopResults = [];
    let creditNotification = undefined; // Track the latest credit notification
    for (const session of runningSessions) {
      if (session.browserSessionId) {
        try {
          // Stop the Browserbase session
          await browserbase.sessions.update(
            session.browserSessionId,
            {
              projectId: process.env.BROWSERBASE_PROJECT_ID!,
              status: 'REQUEST_RELEASE' as const,
            }
          );
          
          // Update session status in database ONLY if it was running
          // This prevents double-deductions if pause is called after completion
          const stoppedSession = await AgentSession.findOneAndUpdate(
            { _id: session._id, status: 'running' },
            {
              status: 'stopped',
              completedAt: new Date(),
            },
            { new: true }
          ).exec();

          // Deduct credits ONLY if we successfully transitioned from running to stopped
          if (stoppedSession && stoppedSession.startedAt && userId) {
            const sessionMinutes = calculateSessionMinutes(stoppedSession.startedAt, new Date());
            const creditResult = await deductCredits(
              userId,
              sessionMinutes,
              'agent_run',
              {
                agentId: id,
                sessionId: session._id.toString(),
                status: 'stopped',
                duration: sessionMinutes,
              }
            );
            
            if (creditResult.success) {
              console.log(`✅ Deducted ${Math.ceil(sessionMinutes)} credits for paused session (${sessionMinutes.toFixed(2)} minutes). New balance: ${creditResult.newBalance}`);
              // Capture the latest credit notification
              if (creditResult.creditNotification) {
                creditNotification = creditResult.creditNotification;
              }
            } else {
              console.error(`⚠️ Failed to deduct credits: ${creditResult.error}`);
            }
          } else if (!stoppedSession) {
            console.log(`ℹ️ Session ${session._id} was not running - skipping credit deduction to prevent double-charge`);
          }

          stopResults.push({
            sessionId: session._id.toString(),
            browserSessionId: session.browserSessionId,
            success: true,
          });
        } catch (error) {
          console.error(`Error stopping session ${session._id}:`, error);
          stopResults.push({
            sessionId: session._id.toString(),
            browserSessionId: session.browserSessionId,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      } else {
        // No browser session, just mark as stopped ONLY if it was running
        // This prevents double-deductions if pause is called after completion
        const stoppedSession = await AgentSession.findOneAndUpdate(
          { _id: session._id, status: 'running' },
          {
            status: 'stopped',
            completedAt: new Date(),
          },
          { new: true }
        ).exec();

        // Deduct credits ONLY if we successfully transitioned from running to stopped
        if (stoppedSession && stoppedSession.startedAt && userId) {
          const sessionMinutes = calculateSessionMinutes(stoppedSession.startedAt, new Date());
          const creditResult = await deductCredits(
            userId,
            sessionMinutes,
            'agent_run',
            {
              agentId: id,
              sessionId: session._id.toString(),
              status: 'stopped',
              duration: sessionMinutes,
            }
          );
          
          if (creditResult.success) {
            console.log(`✅ Deducted ${Math.ceil(sessionMinutes)} credits for paused session (${sessionMinutes.toFixed(2)} minutes). New balance: ${creditResult.newBalance}`);
            // Capture the latest credit notification
            if (creditResult.creditNotification) {
              creditNotification = creditResult.creditNotification;
            }
          } else {
            console.error(`⚠️ Failed to deduct credits: ${creditResult.error}`);
          }
        } else if (!stoppedSession) {
          console.log(`ℹ️ Session ${session._id} was not running - skipping credit deduction to prevent double-charge`);
        }
        
        stopResults.push({
          sessionId: session._id.toString(),
          success: true,
        });
      }
    }

    // Reset any running daily tasks back to pending (allows retry on next run) with userId filtering
    const runningDailyTasks = await DailyTask.find({ agentId: id, userId, status: 'running' }).exec();

    let resetTasksCount = 0;
    if (runningDailyTasks.length > 0) {
      await DailyTask.updateMany(
        { agentId: id, userId, status: 'running' },
        { $set: { status: 'pending' } }
      ).exec();
      
      resetTasksCount = runningDailyTasks.length;
      console.log(`🔄 Reset ${resetTasksCount} running daily task(s) back to pending for retry`);
    }

    // Update agent to paused status
    const updatedAgent = await Agent.findByIdAndUpdate(
      id,
      { $set: { isDeployed: false, updatedAt: new Date() } },
      { new: true }
    ).lean().exec();

    const agentResponse = {
      ...updatedAgent,
      id: updatedAgent!._id.toString(),
      _id: undefined,
    };

    // Create agent_paused notification
    let agentNotification = undefined;
    if (userId) {
      try {
        const notification = await NotificationService.createNotification({
          userId,
          typeKey: 'agent_paused',
          metadata: {
            agentId: id,
            agentName: agent.name,
          }
        });
        
        agentNotification = {
          type: 'agent',
          title: notification.title,
          message: notification.body,
          priority: notification.priority,
        };
      } catch (notifError) {
        console.error('Error creating agent_paused notification:', notifError);
      }
    }

    return NextResponse.json({
      success: true,
      agent: agentResponse,
      stoppedSessions: stopResults,
      resetTasks: resetTasksCount,
      message: `Agent paused successfully${resetTasksCount > 0 ? `. ${resetTasksCount} daily task(s) reset for retry` : ''}`,
      creditNotification,
      agentNotification,
    }, { status: 200 });

  } catch (error) {
    console.error('Error pausing agent:', error);
    return NextResponse.json(
      { error: 'Failed to pause agent' },
      { status: 500 }
    );
  }
}
