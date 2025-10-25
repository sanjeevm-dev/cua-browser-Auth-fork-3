import { notFound } from "next/navigation";
import mongoose from "mongoose";
import { connectDB, Agent, AgentSession, AgentContext, AgentTask } from "../../../server/db";
import { AgentWithRelations } from "@/lib/types/mongodb";
import AgentDetailClient from "./AgentDetailClient";

export default async function AgentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const agentId = id;

  if (!mongoose.Types.ObjectId.isValid(agentId)) {
    return notFound();
  }

  await connectDB();

  // Fetch agent details
  const agent = await Agent.findById(agentId).lean();

  if (!agent) {
    return notFound();
  }

  // Fetch sessions
  const sessions = await AgentSession.find({ agentId })
    .sort({ startedAt: -1 })
    .limit(10)
    .lean();

  // Fetch context
  const context = await AgentContext.find({ agentId }).lean();

  // Fetch tasks
  const tasks = await AgentTask.find({ agentId })
    .sort({ createdAt: -1 })
    .lean();

  // Convert MongoDB documents to plain objects and handle _id conversion
  const formattedAgent: AgentWithRelations = {
    id: agent._id.toString(),
    name: agent.name,
    description: agent.description ?? null,
    systemPrompt: agent.systemPrompt,
    executionPrompt: agent.executionPrompt ?? null,
    targetWebsite: agent.targetWebsite ?? null,
    authCredentials: agent.authCredentials,
    knowledgeBase: agent.knowledgeBase ?? null,
    userExpectations: agent.userExpectations ?? null,
    runtimePerDay: agent.runtimePerDay ?? null,
    executionMode: agent.executionMode ?? 'one-shot',
    isDeployed: agent.isDeployed ?? null,
    createdAt: agent.createdAt.toISOString(),
    updatedAt: agent.updatedAt.toISOString(),
  };

  const formattedSessions = sessions.map(session => ({
    id: session._id.toString(),
    agentId: session.agentId.toString(),
    browserSessionId: session.browserSessionId ?? null,
    status: session.status,
    startedAt: session.startedAt.toISOString(),
    completedAt: session.completedAt?.toISOString() ?? null,
    summary: session.summary ?? null,
    totalSteps: session.totalSteps ?? null,
    errorMessage: session.errorMessage ?? null,
  }));

  const formattedContext = context.map(ctx => ({
    id: ctx._id.toString(),
    agentId: ctx.agentId.toString(),
    contextKey: ctx.contextKey,
    contextValue: ctx.contextValue,
    createdAt: ctx.createdAt.toISOString(),
  }));

  const formattedTasks = tasks.map(task => ({
    id: task._id.toString(),
    agentId: task.agentId.toString(),
    taskDescription: task.taskDescription,
    taskType: task.taskType,
    priority: task.priority,
    status: task.status,
    frequency: task.frequency,
    result: task.result ?? null,
    scheduledFor: task.scheduledFor?.toISOString() ?? null,
    completedAt: task.completedAt?.toISOString() ?? null,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
  }));

  return (
    <AgentDetailClient
      agent={formattedAgent}
      initialSessions={formattedSessions}
      initialContext={formattedContext}
      initialTasks={formattedTasks}
    />
  );
}
