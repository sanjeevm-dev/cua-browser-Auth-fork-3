import { NextResponse } from 'next/server';
import { connectDB, Agent, AgentTask, DailyTask } from '../../../server/db';
import { encryptCredentials } from '../../lib/encryption';
import { createAgentSchema, validateRequest } from '../../lib/validation';
import { applyRateLimit, apiRateLimiter } from '@/app/lib/rate-limiter';
import { getUserId } from '@/app/lib/auth-helpers';
import { generateDailyTasks, generateOneShotTask } from '@/app/lib/master-agent';
import NotificationService from '@/lib/services/NotificationService';

// GET /api/agents - Get all agents for the authenticated user
export async function GET(request: Request) {
  const rateLimit = await applyRateLimit(request, apiRateLimiter);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { 
        status: 429,
        headers: rateLimit.headers
      }
    );
  }

  const { userId, error } = await getUserId();
  if (error) return error;

  try {
    await connectDB();
    
    const allAgents = await Agent.find({ userId })
      .sort({ createdAt: -1 })
      .lean()
      .exec();

    // Convert MongoDB _id to id for frontend compatibility
    const agentsWithId = allAgents.map(agent => ({
      ...agent,
      id: agent._id.toString(),
      _id: undefined,
    }));

    return NextResponse.json({ agents: agentsWithId }, {
      headers: rateLimit.headers
    });
  } catch (error) {
    console.error('Error fetching agents:', error);
    return NextResponse.json(
      { error: 'Failed to fetch agents' },
      { status: 500, headers: rateLimit.headers }
    );
  }
}

// POST /api/agents - Create a new agent for the authenticated user
export async function POST(request: Request) {
  const rateLimit = await applyRateLimit(request, apiRateLimiter);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { 
        status: 429,
        headers: rateLimit.headers
      }
    );
  }

  const { userId, error } = await getUserId();
  if (error) return error;

  try {
    const body = await request.json();
    
    const validation = validateRequest(createAgentSchema, body);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error }, { 
        status: 400,
        headers: rateLimit.headers
      });
    }
    const validatedData = validation.data;

    const bodyWithExtra = body as Record<string, unknown>;

    // Encrypt credentials if they exist
    let encryptedAuthCredentials = validatedData.authCredentials || null;
    if (validatedData.authCredentials?.customFields && Object.keys(validatedData.authCredentials.customFields).length > 0) {
      const customFields = validatedData.authCredentials.customFields as Record<string, unknown>;
      const customFieldsAsStrings: Record<string, string> = {};
      for (const [key, value] of Object.entries(customFields)) {
        customFieldsAsStrings[key] = String(value || '');
      }
      const encryptedFields = encryptCredentials(customFieldsAsStrings);
      encryptedAuthCredentials = {
        ...validatedData.authCredentials,
        customFields: encryptedFields
      };
    }

    // No longer use single executionPrompt - Master Agent creates multi-day tasks instead
    console.log('💾 POST /api/agents - Creating agent with multi-day task architecture');

    await connectDB();

    const executionMode = (bodyWithExtra.executionMode as 'one-shot' | 'multi-step' | undefined) || 'multi-step';
    
    const createdAgent = await Agent.create({
      userId,
      name: validatedData.name,
      description: validatedData.description || null,
      systemPrompt: validatedData.systemPrompt,
      executionPrompt: null, // Always null - daily tasks are the execution method
      targetWebsite: validatedData.targetWebsite || null,
      authCredentials: encryptedAuthCredentials,
      knowledgeBase: validatedData.knowledgeBase || null,
      userExpectations: validatedData.userExpectations || null,
      planningData: (bodyWithExtra.planningData as Record<string, unknown> | undefined) || null,
      runtimePerDay: (bodyWithExtra.runtimePerDay as number | undefined) || 15,
      executionMode,
      isDeployed: validatedData.isDeployed || false,
    });
    
    console.log('✅ Agent created in DB with ID:', createdAgent._id.toString(), `(executionMode: ${executionMode})`);

    // Prepare shared parameters
    const icp = (bodyWithExtra.icp as string | undefined) || '';
    const valueProp = (bodyWithExtra.valueProp as string | undefined) || '';
    const platforms = (bodyWithExtra.platforms as string[] | undefined) || [];
    const uploadedFiles = (bodyWithExtra.uploadedFiles as Array<{name: string; content: string; type: string; size: number}> | undefined) || [];
    
    // Route to appropriate master agent based on execution mode
    if (executionMode === 'one-shot') {
      console.log('🎯 One-shot mode: Creating single comprehensive task...');
      
      try {
        const oneShotParams = {
          agentId: createdAgent._id.toString(),
          agentName: validatedData.name,
          objective: String((bodyWithExtra.planningData as Record<string, unknown> | undefined)?.objective || validatedData.description || ''),
          targetWebsite: validatedData.targetWebsite || '',
          dataFields: ((bodyWithExtra.planningData as Record<string, unknown> | undefined)?.dataFields as string[]) || [],
          outputDestination: String((bodyWithExtra.planningData as Record<string, unknown> | undefined)?.outputDestination || ''),
          constraints: String((bodyWithExtra.planningData as Record<string, unknown> | undefined)?.constraints || ''),
          systemPrompt: validatedData.systemPrompt,
          knowledgeBase: validatedData.knowledgeBase || '',
          authCredentials: encryptedAuthCredentials,
          planningData: (bodyWithExtra.planningData as Record<string, unknown> | undefined) || {},
          icp,
          valueProp,
          platforms,
          uploadedFiles,
        };
        
        const oneShotResult = await generateOneShotTask(oneShotParams);

        if (oneShotResult.success && oneShotResult.dailyTasks.length > 0) {
          console.log('✅ One-Shot Master Agent generated comprehensive task');

          const oneShotTaskToCreate = {
            userId,
            agentId: createdAgent._id,
            dayNumber: 0, // Use 0 to indicate one-shot task
            taskPrompt: oneShotResult.dailyTasks[0].taskPrompt,
            status: 'pending',
            outcomes: null,
            error: null,
          };

          await DailyTask.create(oneShotTaskToCreate);
          console.log('✅ Stored one-shot task in database');
        } else {
          console.warn('⚠️ One-Shot Master Agent returned no task');
        }
      } catch (oneShotError) {
        console.error('❌ Error calling One-Shot Master Agent:', oneShotError);
        // Continue without one-shot task
      }
    } else {
      // Multi-step mode: Call existing Master Agent to decompose into daily tasks
      console.log('🧠 Multi-step mode: Calling Master Agent to decompose sales plan into daily tasks...');
      
      try {
        const masterAgentParams = {
          agentId: createdAgent._id.toString(),
          agentName: validatedData.name,
          objective: String((bodyWithExtra.planningData as Record<string, unknown> | undefined)?.objective || validatedData.description || ''),
          targetWebsite: validatedData.targetWebsite || '',
          dataFields: ((bodyWithExtra.planningData as Record<string, unknown> | undefined)?.dataFields as string[]) || [],
          outputDestination: String((bodyWithExtra.planningData as Record<string, unknown> | undefined)?.outputDestination || ''),
          constraints: String((bodyWithExtra.planningData as Record<string, unknown> | undefined)?.constraints || ''),
          systemPrompt: validatedData.systemPrompt,
          knowledgeBase: validatedData.knowledgeBase || '',
          authCredentials: encryptedAuthCredentials,
          planningData: (bodyWithExtra.planningData as Record<string, unknown> | undefined) || {},
          icp,
          valueProp,
          platforms,
          uploadedFiles,
        };
        
        const masterAgentResult = await generateDailyTasks(masterAgentParams);

        if (masterAgentResult.success && masterAgentResult.dailyTasks.length > 0) {
          console.log(`✅ Master Agent generated ${masterAgentResult.dailyTasks.length}-day campaign`);

          const dailyTasksToCreate = masterAgentResult.dailyTasks.map((task) => ({
            userId,
            agentId: createdAgent._id,
            dayNumber: task.dayNumber,
            taskPrompt: task.taskPrompt,
            status: 'pending',
            outcomes: null,
            error: null,
          }));

          await DailyTask.insertMany(dailyTasksToCreate);
          console.log(`✅ Stored ${dailyTasksToCreate.length} daily tasks in database`);
        } else {
          console.warn('⚠️ Master Agent returned no tasks - fallback to legacy execution');
        }
      } catch (masterError) {
        console.error('❌ Error calling Master Agent:', masterError);
        // Continue without daily tasks - fallback to legacy execution
      }
    }

    // Create initial tasks if provided (legacy support)
    const initialTasks = bodyWithExtra.initialTasks as Array<{ description: string; type?: string; priority?: number; frequency?: string }> | undefined;
    if (initialTasks && Array.isArray(initialTasks) && initialTasks.length > 0) {
      const tasksToCreate = initialTasks.map((task) => ({
        userId,
        agentId: createdAgent._id,
        taskDescription: task.description,
        taskType: task.type || 'general',
        priority: task.priority || 3,
        frequency: task.frequency || 'one-time',
        status: 'pending',
      }));

      await AgentTask.insertMany(tasksToCreate);
    }

    // Create agent_created notification
    let agentNotification = undefined;
    if (userId) {
      try {
        const notification = await NotificationService.createNotification({
          userId,
          typeKey: 'agent_created',
          metadata: {
            agentId: createdAgent._id.toString(),
            agentName: createdAgent.name,
          }
        });
        
        agentNotification = {
          type: 'agent',
          title: notification.title,
          message: notification.body,
          priority: notification.priority,
        };
      } catch (notifError) {
        console.error('Error creating agent_created notification:', notifError);
      }
    }

    // Convert to frontend-compatible format
    const agentResponse = {
      ...createdAgent.toObject(),
      id: createdAgent._id.toString(),
      _id: undefined,
    };

    return NextResponse.json({ 
      agent: agentResponse,
      agentNotification 
    }, { 
      status: 201,
      headers: rateLimit.headers
    });
  } catch (error) {
    console.error('Error creating agent:', error);
    return NextResponse.json(
      { error: 'Failed to create agent' },
      { status: 500, headers: rateLimit.headers }
    );
  }
}
