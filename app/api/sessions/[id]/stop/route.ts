import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { connectDB, AgentSession } from '../../../../../server/db';
import Browserbase from '@browserbasehq/sdk';
import { getUserId } from '@/app/lib/auth-helpers';
import { deductCredits, calculateSessionMinutes } from '@/app/lib/credits';

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
        { error: 'Invalid session ID' },
        { status: 400 }
      );
    }

    await connectDB();

    // Get the session from database with userId verification
    const session = await AgentSession.findOne({ _id: id, userId }).exec();

    if (!session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    // Stop the Browserbase session if it exists
    if (session.browserSessionId) {
      try {
        // Stop the Browserbase session using the SDK
        await browserbase.sessions.update(
          session.browserSessionId,
          {
            projectId: process.env.BROWSERBASE_PROJECT_ID!,
            status: 'REQUEST_RELEASE' as const,
          }
        );
        
        console.log(`Browserbase session ${session.browserSessionId} stopped successfully`);
        
        // Update our database to mark session as stopped ONLY if it was running
        // This prevents double-deductions from concurrent stop calls
        const stoppedSession = await AgentSession.findOneAndUpdate(
          { _id: id, status: 'running' },
          {
            status: 'stopped',
            completedAt: new Date(),
          },
          { new: true }
        ).exec();

        // Deduct credits ONLY if we successfully transitioned from running to stopped
        let creditNotification = undefined;
        if (stoppedSession && stoppedSession.startedAt && userId) {
          const sessionMinutes = calculateSessionMinutes(stoppedSession.startedAt, new Date());
          const creditResult = await deductCredits(
            userId,
            sessionMinutes,
            'agent_run',
            {
              agentId: stoppedSession.agentId?.toString(),
              sessionId: id,
              status: 'stopped',
              duration: sessionMinutes,
            }
          );
          
          if (creditResult.success) {
            console.log(`✅ Deducted ${Math.ceil(sessionMinutes)} credits for stopped session (${sessionMinutes.toFixed(2)} minutes). New balance: ${creditResult.newBalance}`);
            creditNotification = creditResult.creditNotification;
          } else {
            console.error(`⚠️ Failed to deduct credits: ${creditResult.error}`);
          }
        } else if (!stoppedSession) {
          console.log(`ℹ️ Session ${id} was not running - skipping credit deduction to prevent double-charge`);
        }

        return NextResponse.json({
          success: true,
          message: 'Session stopped successfully',
          browserSessionId: session.browserSessionId,
          creditNotification,
        });
      } catch (error) {
        console.error('Error stopping Browserbase session:', error);
        
        // DO NOT mark as stopped if Browserbase call fails
        // This prevents orphaned sessions where UI thinks it's stopped but browser is still running
        await AgentSession.findByIdAndUpdate(id, {
          errorMessage: `Failed to stop Browserbase session: ${error instanceof Error ? error.message : 'Unknown error'}`,
        }).exec();
        
        // Return error response so UI knows the stop failed
        return NextResponse.json({
          success: false,
          error: error instanceof Error ? error.message : 'Failed to stop Browserbase session',
          browserSessionId: session.browserSessionId,
        }, { status: 500 });
      }
    }

    // No browser session, just update database ONLY if session was running
    // This prevents double-deductions from concurrent stop calls
    const stoppedSession = await AgentSession.findOneAndUpdate(
      { _id: id, status: 'running' },
      {
        status: 'stopped',
        completedAt: new Date(),
      },
      { new: true }
    ).exec();

    // Deduct credits ONLY if we successfully transitioned from running to stopped
    let creditNotification = undefined;
    if (stoppedSession && stoppedSession.startedAt && userId) {
      const sessionMinutes = calculateSessionMinutes(stoppedSession.startedAt, new Date());
      const creditResult = await deductCredits(
        userId,
        sessionMinutes,
        'agent_run',
        {
          agentId: stoppedSession.agentId?.toString(),
          sessionId: id,
          status: 'stopped',
          duration: sessionMinutes,
        }
      );
      
      if (creditResult.success) {
        console.log(`✅ Deducted ${Math.ceil(sessionMinutes)} credits for stopped session (${sessionMinutes.toFixed(2)} minutes). New balance: ${creditResult.newBalance}`);
        creditNotification = creditResult.creditNotification;
      } else {
        console.error(`⚠️ Failed to deduct credits: ${creditResult.error}`);
      }
    } else if (!stoppedSession) {
      console.log(`ℹ️ Session ${id} was not running - skipping credit deduction to prevent double-charge`);
    }

    return NextResponse.json({
      success: true,
      message: 'Session stopped',
      creditNotification,
    });
  } catch (error) {
    console.error('Error stopping session:', error);
    return NextResponse.json(
      { error: 'Failed to stop session' },
      { status: 500 }
    );
  }
}
