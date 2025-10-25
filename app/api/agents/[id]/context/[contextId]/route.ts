import { NextRequest, NextResponse } from "next/server";
import mongoose from 'mongoose';
import { connectDB, AgentContext } from "@/server/db";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; contextId: string }> }
) {
  try {
    const { id, contextId } = await params;

    if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(contextId)) {
      return NextResponse.json(
        { error: "Invalid agent ID or context ID" },
        { status: 400 }
      );
    }

    await connectDB();

    await AgentContext.findOneAndDelete({ _id: contextId, agentId: id }).exec();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting context:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
