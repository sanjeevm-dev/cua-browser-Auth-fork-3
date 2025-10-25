import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { connectDB, Agent, AgentTask } from '../../../../../server/db';
import OpenAI from 'openai';
import { getUserId } from '@/app/lib/auth-helpers';

// Lazily instantiate OpenAI inside the handler to avoid build-time env requirements

// POST /api/agents/[id]/plan-tasks - Autonomously generate new tasks for an agent
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId, error } = await getUserId();
    if (error) return error;

    const { id } = await params;
    const agentId = id;
    const body = await request.json();
    const { planningPeriod = 'weekly' } = body; // 'daily', 'weekly', or 'monthly'

    if (!mongoose.Types.ObjectId.isValid(agentId)) {
      return NextResponse.json(
        { error: 'Invalid agent ID' },
        { status: 400 }
      );
    }

    await connectDB();

    // Get agent details with userId verification
    const agent = await Agent.findOne({ _id: agentId, userId });

    if (!agent) {
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      );
    }

    // Get existing tasks (completed and pending) for context with userId filtering
    const existingTasks = await AgentTask.find({ agentId, userId });

    const completedTasks = existingTasks.filter(t => t.status === 'completed');
    const pendingTasks = existingTasks.filter(t => t.status === 'pending');

    // Initialize OpenAI client at runtime
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'Missing OPENAI_API_KEY' },
        { status: 500 }
      );
    }
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    // Use GPT-4o to generate new tasks based on agent's purpose and learning
    const planningPrompt = `You are an expert strategic task planner for autonomous AI agents. Create a ${planningPeriod} task plan where EACH TASK represents ONE FULL DAY (6-8 HOURS) of focused work.

Agent Details:
- Name: ${agent.name}
- Description: ${agent.description}
- System Prompt: ${agent.systemPrompt}
- User Expectations: ${agent.userExpectations || 'Not specified'}
- Target Website: ${agent.targetWebsite || 'Various'}
- Knowledge Base: ${agent.knowledgeBase || 'None'}

Completed Tasks (Learnings):
${completedTasks.length > 0 ? completedTasks.map(t => `- ${t.taskDescription} (${t.taskType}) - Result: ${JSON.stringify(t.result)}`).join('\n') : 'No tasks completed yet'}

Current Pending Tasks:
${pendingTasks.length > 0 ? pendingTasks.map(t => `- ${t.taskDescription} (${t.taskType}, Priority: ${t.priority})`).join('\n') : 'No pending tasks'}

🚨 ABSOLUTE REQUIREMENTS - EACH TASK = ONE FULL DAY (6-8 HOURS) OF WORK:

Each task represents what a human employee would accomplish in ONE COMPLETE WORKDAY (6-8 hours). Think: "What would I assign to an employee for their entire day's work?"

MANDATORY FORMAT:
{
  "title": "Day X: [Compelling Task Heading - 5-10 words]",
  "description": "[EXTREMELY DETAILED 300-500 word description of the FULL DAY workflow]",
  "type": "task_type",
  "priority": 1-5,
  "frequency": "daily|weekly|monthly"
}

TASK REQUIREMENTS:
✅ 300-500 words minimum per task (detailed employee work plan)
✅ Contains 6-8 hours worth of activities
✅ Multiple major activities with specific deliverables
✅ Exact numbers for everything (40-50 prospects, 25-30 posts, 15-20 messages, etc.)
✅ Authentication is EMBEDDED in the first task, NEVER standalone
✅ Each task builds on previous day's work

DETAILED STRUCTURE FOR EACH TASK:
1. **Morning Setup (30-60 min)**: Platform login, review yesterday's results, set daily goals
2. **Research Phase (1-2 hours)**: Deep analysis, data gathering, ICP refinement
3. **Execution Phase 1 (2-3 hours)**: Primary activities with specific numbers
4. **Execution Phase 2 (2-3 hours)**: Secondary activities and follow-ups
5. **Documentation (30-60 min)**: Log results, update pipeline, prepare for tomorrow
6. **Success Metrics**: Concrete numbers achieved (50+ connections, 30+ engagements, etc.)

❌ ABSOLUTELY FORBIDDEN - NEVER CREATE THESE:
- "Authenticate on LinkedIn" (30 seconds, NOT a full day)
- "Research target companies" (too vague, no full day detail)
- "Send connection requests" (missing 95% of the workflow)
- "Follow up on contacts" (where's the 6-8 hours of work?)
- ANY task under 300 words
- ANY task without specific numbers
- ANY authentication as standalone

STRATEGIC PLANNING FOR ${planningPeriod.toUpperCase()}:
1. Build on learnings from completed tasks
2. Create logical progression and momentum
3. Each task = complete 6-8 hour daily workflow
4. Include specific metrics and deliverables
5. Ensure tasks are truly self-sufficient and end-to-end

Generate exactly 4-5 tasks for this ${planningPeriod} period. Each task = ONE FULL WORKDAY (6-8 hours).
Each task MUST have separate title and description fields.
Each description MUST be 300-500 words with complete daily workflow.

Return ONLY valid JSON:
{
  "tasks": [
    {
      "title": "Day X: [Compelling 5-10 word heading]",
      "description": "EXTREMELY DETAILED 300-500 word description covering the ENTIRE workday (6-8 hours) with morning setup, multiple work phases, specific numbers throughout, and end-of-day documentation",
      "type": "task_type",
      "priority": 1-5,
      "frequency": "daily|weekly|monthly"
    }
  ],
  "reasoning": "Strategic explanation of how this ${planningPeriod} task plan achieves objectives with full-day workflows"
}`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are an expert strategic AI task planner. Each task represents ONE FULL WORKDAY (6-8 hours) of complete employee work - NEVER simple atomic tasks. You create comprehensive daily workflows (300-500 words) with separate title and detailed description fields. Each task has specific hourly breakdowns, exact metrics (50+ prospects, 30+ posts, etc.), and measurable outcomes. You think like a VP delegating complete daily projects to senior employees. Return only valid JSON with title and description fields."
        },
        {
          role: "user",
          content: planningPrompt
        }
      ],
      temperature: 0.7,
      max_tokens: 4000,
      response_format: { type: "json_object" }
    });

    const planResult = JSON.parse(completion.choices[0].message.content || '{"tasks": [], "reasoning": ""}');

    // Create the new tasks in the database with userId
    if (planResult.tasks && planResult.tasks.length > 0) {
      const tasksToCreate = planResult.tasks.map((task: { title?: string; description?: string; taskDescription?: string; type?: string; priority?: number; frequency?: string }) => ({
        userId,
        agentId: agentId,
        taskDescription: `${task.title || 'Task'}\n\n${task.description || task.taskDescription || ''}`,
        taskType: task.type || 'general',
        priority: task.priority || 3,
        frequency: task.frequency || 'one-time',
        status: 'pending',
        scheduledFor: null,
      }));

      const createdTasks = await AgentTask.insertMany(tasksToCreate);

      return NextResponse.json({
        success: true,
        tasks: createdTasks,
        reasoning: planResult.reasoning,
        planningPeriod
      }, { status: 201 });
    }

    return NextResponse.json({
      success: false,
      message: 'No tasks were generated'
    }, { status: 200 });

  } catch (error) {
    console.error('Error generating task plan:', error);
    return NextResponse.json(
      { error: 'Failed to generate task plan' },
      { status: 500 }
    );
  }
}
