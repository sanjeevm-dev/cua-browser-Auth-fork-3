import { NextRequest, NextResponse } from "next/server";
import mongoose from 'mongoose';
import { connectDB, AgentSession, SessionLog } from "@/server/db";
import Browserbase from "@browserbasehq/sdk";
import { getUserId } from "@/app/lib/auth-helpers";

// Instantiate Browserbase inside the handler to avoid build-time env requirements

export async function GET(
  request: NextRequest,
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
        { error: "Invalid session ID" },
        { status: 400 }
      );
    }

    await connectDB();

    const session = await AgentSession.findOne({ _id: id, userId }).lean().exec();

    if (!session) {
      return NextResponse.json(
        { error: "Session not found" },
        { status: 404 }
      );
    }

    // Get logs for this session with userId filtering
    const logs = await SessionLog.find({ sessionId: id, userId })
      .sort({ stepNumber: 1 })
      .lean()
      .exec();

    let browserDebugUrl = null;
    if (session.browserSessionId) {
      try {
        const bbSession = await browserbase.sessions.retrieve(session.browserSessionId);
        browserDebugUrl = (bbSession as unknown as { debuggerFullscreenUrl?: string; debuggerUrl?: string }).debuggerFullscreenUrl || (bbSession as unknown as { debuggerFullscreenUrl?: string; debuggerUrl?: string }).debuggerUrl || null;
      } catch (error) {
        console.error("Error fetching browserbase debug URL:", error);
      }
    }

    // Convert to frontend-compatible format
    const sessionWithId = {
      ...session,
      id: session._id.toString(),
      agentId: session.agentId.toString(),
      _id: undefined,
      logs: logs.map(log => ({
        ...log,
        id: log._id.toString(),
        sessionId: log.sessionId.toString(),
        _id: undefined,
      })),
      browserDebugUrl
    };

    return NextResponse.json({ 
      session: sessionWithId
    });
  } catch (error) {
    console.error("Error fetching session:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
