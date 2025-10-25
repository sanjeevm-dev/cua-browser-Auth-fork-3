import { NextResponse } from "next/server";
import mongoose from 'mongoose';
import { connectDB, Agent as AgentModel, AgentSession, SessionLog, DailyTask } from "../../../../../server/db";
import { Agent as CUAAgent } from "../../../cua/agent/agent";
import { BrowserbaseBrowser } from "../../../cua/agent/browserbase";
import { decryptCredentials } from "../../../../lib/encryption";
import type { Item } from "../../../cua/agent/types";
import {
  applyRateLimit,
  agentExecutionRateLimiter,
} from "@/app/lib/rate-limiter";
import {
  formatActionText,
  formatToolBadge,
} from "@/app/lib/action-formatter";
import { getUserId } from "@/app/lib/auth-helpers";
import { checkSufficientCredits, deductCredits, calculateSessionMinutes } from "@/app/lib/credits";
import { CREDITS_CONFIG } from "@/app/lib/constants";
import NotificationService from "@/lib/services/NotificationService";

// Allow up to 120 seconds for CUA agent execution (browser automation can take time)
export const maxDuration = 120;

/**
 * Validate OpenAI API key before starting execution
 * Makes a lightweight API call to verify credentials
 */
async function validateOpenAIKey(): Promise<{ valid: boolean; error?: string }> {
  const apiKey = process.env.OPENAI_API_KEY;
  
  if (!apiKey) {
    return {
      valid: false,
      error: "OpenAI API key is not configured. Please set OPENAI_API_KEY environment variable."
    };
  }
  
  try {
    // Make a simple API call to verify the key is valid
    const response = await fetch('https://api.openai.com/v1/models', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(5000), // 5 second timeout
    });
    
    if (response.status === 401) {
      return {
        valid: false,
        error: "OpenAI API key is invalid or expired. Please check your API key configuration."
      };
    }
    
    if (response.status === 429) {
      // Rate limited but key is valid
      console.warn('⚠️ OpenAI API key validation hit rate limit, but key appears valid');
      return { valid: true };
    }
    
    if (!response.ok) {
      return {
        valid: false,
        error: `OpenAI API returned unexpected status: ${response.status}. Please try again.`
      };
    }
    
    console.log('✅ OpenAI API key validated successfully');
    return { valid: true };
  } catch (error) {
    console.error('❌ OpenAI API key validation failed:', error);
    return {
      valid: false,
      error: error instanceof Error 
        ? `Failed to validate OpenAI API key: ${error.message}`
        : "Failed to validate OpenAI API key. Please check your configuration."
    };
  }
}

interface AgentData {
  id: string;
  name: string;
  systemPrompt: string;
  targetWebsite?: string | null;
  authCredentials?: unknown;
  knowledgeBase?: string | null;
  userExpectations?: string | null;
  isDeployed: boolean | null;
}

interface Message {
  role: "user" | "system" | "assistant" | "developer";
  content: string;
}

// Helper function to substitute credential placeholders in execution prompts
function substituteCredentials(
  prompt: string,
  credentials: Record<string, string>,
): string {
  let substitutedPrompt = prompt;

  // Common credential placeholder patterns to substitute
  const placeholderPatterns = [
    { regex: /\{linkedin_email\}/gi, key: "linkedin_email" },
    { regex: /\{linkedin_password\}/gi, key: "linkedin_password" },
    { regex: /\{twitter_username\}/gi, key: "twitter_username" },
    { regex: /\{twitter_password\}/gi, key: "twitter_password" },
    { regex: /\{google_email\}/gi, key: "google_email" },
    { regex: /\{google_password\}/gi, key: "google_password" },
    { regex: /\{email\}/gi, key: "email" },
    { regex: /\{password\}/gi, key: "password" },
    { regex: /\{username\}/gi, key: "username" },
  ];

  // Track which credentials were actually needed
  const missingCredentials: string[] = [];

  for (const pattern of placeholderPatterns) {
    if (substitutedPrompt.match(pattern.regex)) {
      const credentialValue = credentials[pattern.key];
      if (!credentialValue) {
        missingCredentials.push(pattern.key);
      } else {
        substitutedPrompt = substitutedPrompt.replace(
          pattern.regex,
          credentialValue,
        );
      }
    }
  }

  // If critical credentials are missing, throw error
  if (missingCredentials.length > 0) {
    throw new Error(
      `Missing required credentials for execution: ${missingCredentials.join(", ")}. ` +
        `The execution prompt requires these credentials but they were not provided.`,
    );
  }

  return substitutedPrompt;
}

// Execute agent using pre-generated execution prompt
async function executeWithExecutionPrompt(
  agentId: string,
  sessionId: string,
  executionPrompt: string,
  agent: AgentData,
  dailyTaskId: string | undefined,
  userId: string,
) {
  let browser: BrowserbaseBrowser | null = null;

  try {
    // Initialize Browserbase browser with proxies and CAPTCHA solving enabled
    browser = new BrowserbaseBrowser(1024, 768, "us-east-1", true, null, null, null, null, true, userId);

    console.log("🌐 Connecting to Browserbase session...");
    await browser.connect();
    console.log("✅ Browser connection initiated");

    // CRITICAL: Verify browser is fully ready before proceeding
    // Browserbase can take 30-60+ seconds to provision a session
    const browserSessionId = (
      browser as unknown as { session?: { id: string } }
    ).session?.id;

    if (!browserSessionId) {
      throw new Error(
        "Failed to establish Browserbase session - no session ID returned",
      );
    }

    // Store browser session ID in database
    await AgentSession.findByIdAndUpdate(sessionId, { browserSessionId });

    // Wait for browser to be fully ready by taking a test screenshot
    console.log("⏳ Verifying browser readiness...");
    const maxReadinessWait = 90000; // 90 seconds max wait (Browserbase can take 60+ seconds)
    const readinessStart = Date.now();
    let browserReady = false;
    let retryDelay = 2000; // Start with 2 second delays

    while (Date.now() - readinessStart < maxReadinessWait) {
      try {
        // Attempt a screenshot to verify browser is responsive
        await browser.screenshot();
        browserReady = true;
        const elapsedSeconds = Math.floor((Date.now() - readinessStart) / 1000);
        console.log(
          `✅ Browser is ready and responsive (took ${elapsedSeconds}s)`,
        );
        break;
      } catch {
        // Browser not ready yet, wait and retry with progressive backoff
        const elapsedSeconds = Math.floor((Date.now() - readinessStart) / 1000);
        console.log(
          `⏳ Browser not ready yet, waiting... (${elapsedSeconds}s elapsed)`,
        );
        await new Promise((resolve) => setTimeout(resolve, retryDelay));

        // Progressive backoff: increase delay after 30 seconds
        if (elapsedSeconds > 30 && retryDelay < 5000) {
          retryDelay = 5000; // Increase to 5 seconds after 30s
          console.log("⏱️ Switching to 5-second check interval");
        }
      }
    }

    if (!browserReady) {
      throw new Error(
        "Browser failed to become ready within 90 seconds. Browserbase may be experiencing delays. Please try again.",
      );
    }

    // Initialize CUA agent
    const cuaAgent = new CUAAgent("computer-use-preview", browser);

    // Fetch previous day's outcomes for context (if this is a daily task)
    let previousDaysContext = "";
    if (dailyTaskId) {
      const completedTasks = await DailyTask.find({
        agentId,
        userId,
        status: "completed"
      }).sort({ dayNumber: 1 });

      if (completedTasks.length > 0) {
        previousDaysContext =
          "\n\n📊 PREVIOUS DAYS OUTCOMES (use this context to inform today's actions):\n\n";
        completedTasks.forEach((task) => {
          previousDaysContext += `Day ${task.dayNumber} Results:\n`;
          if (task.outcomes) {
            const outcomes = task.outcomes as Record<string, unknown>;
            previousDaysContext += `- Actions taken: ${(outcomes.actions as string[] | undefined)?.join(", ") || "N/A"}\n`;
            previousDaysContext += `- URLs visited: ${(outcomes.urlsVisited as string[] | undefined)?.join(", ") || "N/A"}\n`;
            previousDaysContext += `- Summary: ${(outcomes.summary as string) || "N/A"}\n`;
          }
          previousDaysContext += "\n";
        });
      }
    }

    // Decrypt credentials if they exist
    let credentialsText = "No credentials provided";
    let decryptedCreds: Record<string, string> = {};

    const authCreds = agent.authCredentials as
      | { customFields?: string | Record<string, string> }
      | null
      | undefined;
    if (authCreds?.customFields) {
      try {
        const encryptedFields = authCreds.customFields;
        if (typeof encryptedFields === "string") {
          decryptedCreds = decryptCredentials(encryptedFields);
          credentialsText = Object.entries(decryptedCreds)
            .map(([key, value]) => `${key}: ${value}`)
            .join("\n");
        } else {
          decryptedCreds = encryptedFields as Record<string, string>;
          credentialsText = Object.entries(encryptedFields)
            .map(([key, value]) => `${key}: ${value}`)
            .join("\n");
        }
      } catch {
        console.error("Error decrypting credentials");
        throw new Error(
          "Failed to decrypt authentication credentials. Please check your credentials and try again.",
        );
      }
    }

    // Substitute credential placeholders in execution prompt
    let substitutedPrompt = executionPrompt;
    try {
      substitutedPrompt = substituteCredentials(
        executionPrompt,
        decryptedCreds,
      );
      console.log(
        "✅ Credentials substituted successfully in execution prompt",
      );
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes("Missing required credentials")
      ) {
        // Re-throw credential errors immediately - these are fatal
        console.error("❌ Credential substitution failed:", error.message);
        throw error;
      }
      // If no placeholders found, that's fine - continue with original prompt
      console.log("ℹ️ No credential placeholders found in prompt");
    }

    // Set up messages with substituted execution prompt and previous days' context
    const messages: Message[] = [
      {
        role: "developer",
        content: `${substitutedPrompt}\n\nAVAILABLE CREDENTIALS:\n${credentialsText}${previousDaysContext}`,
      },
      {
        role: "user",
        content: `Begin autonomous execution now.

⚠️ CRITICAL INSTRUCTIONS:
- You MUST complete EVERY item in the WORKFLOW section above
- Do NOT stop after completing just one step
- Continue executing until ALL workflow items (1, 2, 3, 4, 5...) are finished
- Only stop when you have achieved ALL the success criteria listed
- If you encounter errors, retry or find workarounds - do not give up early

Start with the AUTHENTICATION (if specified), then systematically work through each WORKFLOW item until the entire task is complete.`,
      },
    ];

    // 1️⃣ LOG FINAL PROMPT SENT TO CUA
    console.log('\n' + '='.repeat(80));
    console.log('🚀 FINAL PROMPT SENT TO CUA AGENT');
    console.log('='.repeat(80));
    console.log('\n📋 DEVELOPER MESSAGE (System Prompt):');
    console.log(messages[0].content);
    console.log('\n👤 USER MESSAGE (Execution Trigger):');
    console.log(messages[1].content);
    console.log('\n' + '='.repeat(80) + '\n');

    let stepCount = 0;
    const maxSteps = 100; // Increased for complex multi-step workflows
    let previousResponseId: string | undefined = undefined;
    const performanceMetrics = {
      aiCallTimes: [] as number[],
      actionExecutionTimes: [] as number[],
      totalStartTime: Date.now(),
    };

    // Run agent loop
    console.log(`\n🔄 Starting CUA execution loop (max ${maxSteps} steps)\n`);
    
    while (stepCount < maxSteps) {
      stepCount++;

      // 2️⃣ LOG STEP COUNT
      console.log(`\n📍 STEP ${stepCount}/${maxSteps} - Starting...`);

      // Check if agent has been paused
      const currentAgent = await AgentModel.findById(agentId);

      if (!currentAgent || !currentAgent.isDeployed) {
        console.log(`\n❌ STOP REASON: Agent paused by user at step ${stepCount}`);
        console.log(`   isDeployed = ${currentAgent?.isDeployed || 'agent not found'}\n`);
        break;
      }

      // Get action from AI (track performance)
      const aiStartTime = Date.now();
      const response = await cuaAgent.getAction(messages, previousResponseId);
      const aiDuration = Date.now() - aiStartTime;
      performanceMetrics.aiCallTimes.push(aiDuration);

      // 3️⃣ LOG CUA RESPONSE DETAILS
      console.log(`   ⏱️  AI call took ${aiDuration}ms`);
      console.log(`   📤 Response ID: ${response?.responseId || 'none'}`);
      console.log(`   🔧 Output items: ${response?.output?.length || 0}`);

      if (!response || !response.output || response.output.length === 0) {
        // Task completed or no actions to take
        console.log(`\n✅ STOP REASON: CUA returned empty output at step ${stepCount}`);
        console.log(`   This means the AI has decided the task is complete.`);
        console.log(`   Response exists: ${!!response}`);
        console.log(`   Output exists: ${!!response?.output}`);
        console.log(`   Output length: ${response?.output?.length || 0}\n`);
        break;
      }

      // Store responseId for next iteration
      previousResponseId = response.responseId;

      // 4️⃣ LOG ACTIONS TO DATABASE FIRST (before execution)
      // This ensures steps appear in live preview BEFORE CUA executes them
      console.log(`   📝 Logging ${response.output.length} action(s) to database...`);
      for (const item of response.output) {
        const itemType = (item as Item).type;

        if (itemType === "computer_call") {
          const computerCall = item as unknown as {
            action: {
              type: string;
              [key: string]: unknown;
            };
          };

          // Extract the tool type from action.type (not action.tool)
          const rawTool = computerCall.action?.type || "";

          // Format the action into user-friendly text
          const formattedText = formatActionText(computerCall.action);
          const formattedTool = formatToolBadge(rawTool);
          const formattedReasoning = '';

          await SessionLog.create({
            userId,
            sessionId: sessionId,
            stepNumber: stepCount,
            tool: formattedTool,
            instruction: formattedText, // User-friendly text instead of JSON
            reasoning: formattedReasoning || null,
            output: computerCall.action, // Keep raw data for debugging
          });
        }

        if (itemType === "function_call") {
          const functionCall = item as unknown as {
            name: string;
            arguments: string;
          };

          // Parse and format function arguments
          let formattedArgs = functionCall.arguments;
          try {
            const args = JSON.parse(functionCall.arguments);
            // Create user-friendly description based on function name
            if (functionCall.name === "goto") {
              formattedArgs = `Navigating to ${args.url || "webpage"}`;
            } else {
              formattedArgs = `Executing ${functionCall.name} with parameters`;
            }
          } catch {
            formattedArgs = `Executing ${functionCall.name}`;
          }

          await SessionLog.create({
            userId,
            sessionId: sessionId,
            stepNumber: stepCount,
            tool: formatToolBadge(functionCall.name),
            instruction: formattedArgs,
            reasoning: null,
            output: { name: functionCall.name, args: functionCall.arguments },
          });
        }
      }

      // 5️⃣ NOW EXECUTE THE ACTIONS (after logging) with error boundaries
      const actionStartTime = Date.now();
      
      console.log(`   🎬 Executing ${response.output.length} action(s)...`);
      response.output.forEach((item: Item, idx: number) => {
        const itemType = item.type;
        if (itemType === 'computer_call') {
          const computerCall = item as unknown as { action?: { type?: string } };
          console.log(`      ${idx + 1}. ${computerCall.action?.type || 'unknown'}`);
        } else if (itemType === 'function_call') {
          const funcCall = item as unknown as { name?: string };
          console.log(`      ${idx + 1}. Function: ${funcCall.name || 'unknown'}`);
        }
      });
      
      // Wrap action execution in error boundary to prevent single action failures from killing session
      let actionOutputs: unknown[] = [];
      try {
        actionOutputs = await cuaAgent.takeAction(response.output);
        const actionDuration = Date.now() - actionStartTime;
        performanceMetrics.actionExecutionTimes.push(actionDuration);
        console.log(`   ✅ Actions executed in ${actionDuration}ms`);
      } catch (actionError) {
        const actionDuration = Date.now() - actionStartTime;
        performanceMetrics.actionExecutionTimes.push(actionDuration);
        
        // Log error but continue execution - don't let single action failure crash entire session
        console.error(`   ⚠️ Action execution error (step ${stepCount}):`, actionError);
        console.log(`   🔄 Continuing session despite action error - resilient execution mode`);
        
        // Create error message for AI to see and potentially recover from
        actionOutputs = [{
          type: "assistant",
          role: "assistant",
          content: `Action execution encountered an error: ${actionError instanceof Error ? actionError.message : 'Unknown error'}. Please try a different approach or skip this action if not critical.`
        }];
      }

      // Add outputs to messages for next iteration
      messages.push(...(actionOutputs as unknown as Message[]))
    }

    // 5️⃣ LOG FINAL EXECUTION SUMMARY
    console.log('\n' + '='.repeat(80));
    console.log('🏁 CUA EXECUTION LOOP ENDED');
    console.log('='.repeat(80));
    console.log(`📊 Total steps executed: ${stepCount}/${maxSteps}`);
    
    if (stepCount >= maxSteps) {
      console.log(`⚠️  Reason: Reached maximum step limit (${maxSteps} steps)`);
    } else if (stepCount === 0) {
      console.log(`⚠️  Reason: No steps executed - check if agent was immediately paused`);
    } else {
      console.log(`✅ Reason: CUA completed task or returned empty output`);
    }
    console.log('='.repeat(80) + '\n');

    // Calculate and log performance metrics
    const totalDuration = Date.now() - performanceMetrics.totalStartTime;
    const avgAiCallTime =
      performanceMetrics.aiCallTimes.length > 0
        ? performanceMetrics.aiCallTimes.reduce((a, b) => a + b, 0) /
          performanceMetrics.aiCallTimes.length
        : 0;
    const avgActionTime =
      performanceMetrics.actionExecutionTimes.length > 0
        ? performanceMetrics.actionExecutionTimes.reduce((a, b) => a + b, 0) /
          performanceMetrics.actionExecutionTimes.length
        : 0;

    console.log("📊 PERFORMANCE METRICS:");
    console.log(
      `  Total execution time: ${(totalDuration / 1000).toFixed(2)}s`,
    );
    console.log(`  Total steps: ${stepCount}`);
    console.log(`  Avg AI call time: ${(avgAiCallTime / 1000).toFixed(2)}s`);
    console.log(
      `  Avg action execution time: ${(avgActionTime / 1000).toFixed(2)}s`,
    );
    console.log(
      `  Steps per second: ${(stepCount / (totalDuration / 1000)).toFixed(2)}`,
    );

    // Mark session as completed ONLY if it was running
    // This prevents double-deductions if manual stop occurred during execution
    const session = await AgentSession.findOneAndUpdate(
      { _id: sessionId, status: "running" },
      {
        status: "completed",
        completedAt: new Date(),
        totalSteps: stepCount,
        summary: `Autonomous execution completed successfully (${stepCount} steps in ${(totalDuration / 1000).toFixed(1)}s)`,
      },
      { new: true }
    );

    // Deduct credits ONLY if we successfully transitioned from running to completed
    if (session && session.startedAt) {
      const sessionMinutes = calculateSessionMinutes(session.startedAt, new Date());
      const creditResult = await deductCredits(
        userId,
        sessionMinutes,
        'agent_run',
        {
          agentId: agentId,
          sessionId: sessionId,
          totalSteps: stepCount,
          duration: sessionMinutes,
        }
      );
      
      if (creditResult.success) {
        console.log(`✅ Deducted ${Math.ceil(sessionMinutes)} credits for session (${sessionMinutes.toFixed(2)} minutes). New balance: ${creditResult.newBalance}`);
      } else {
        console.error(`⚠️ Failed to deduct credits: ${creditResult.error}`);
      }
    } else if (!session) {
      console.log(`ℹ️ Session ${sessionId} was not running when completion tried - likely stopped manually. Skipping credit deduction to prevent double-charge.`);
    }

    // Update daily task if this was a daily task execution AND session was successfully completed
    // Only update if session was not manually stopped (session !== null)
    if (dailyTaskId && session) {
      // Extract detailed outcomes from session logs
      const logs = await SessionLog.find({ sessionId, userId }).sort({ stepNumber: 1 });

      // Parse outcomes from execution logs
      const urls: string[] = [];
      const actions: string[] = [];

      logs.forEach((log) => {
        if (log.instruction) {
          actions.push(log.instruction);

          // Extract URLs from navigation actions
          if (log.instruction.toLowerCase().includes("navigating to")) {
            const urlMatch = log.instruction.match(
              /(?:https?:\/\/)?(?:www\.)?([^\s]+)/,
            );
            if (urlMatch) urls.push(urlMatch[0]);
          }
        }
      });

      const outcomes = {
        totalSteps: stepCount,
        completedAt: new Date().toISOString(),
        summary: `Completed with ${stepCount} actions`,
        actions: actions.slice(0, 10), // Store first 10 actions for context
        urlsVisited: [...new Set(urls)], // Unique URLs
        executionTime: new Date().toISOString(),
      };

      await DailyTask.findByIdAndUpdate(dailyTaskId, {
        status: "completed",
        completedAt: new Date(),
        outcomes: outcomes,
      });

      console.log(`✅ Day task ${dailyTaskId} completed with outcomes:`, {
        totalSteps: stepCount,
        actionsCount: actions.length,
        urlsCount: urls.length,
      });
    } else if (dailyTaskId && !session) {
      console.log(`ℹ️ Day task ${dailyTaskId} not marked complete - session was stopped manually`);
    }

    return { success: true };
  } catch (error) {
    console.error("Error during autonomous execution:", error);

    // Determine user-friendly error message
    let errorMessage = "Unknown error occurred";
    if (error instanceof Error) {
      errorMessage = error.message;

      // Check for specific error types with user-friendly messages
      if (
        error.message.includes("402") ||
        error.message.includes("Free plan browser minutes limit")
      ) {
        errorMessage =
          "402 Free plan browser minutes limit reached. Please upgrade your account at https://browserbase.com/plans";
      } else if (
        error.message.includes("Cannot navigate to invalid URL") ||
        error.message.includes("Invalid URL")
      ) {
        errorMessage =
          "Navigation error: Invalid URL provided. Please ensure URLs include the full protocol (https://). The system has been updated with automatic URL correction.";
      } else if (error.message.includes("ERR_ABORTED")) {
        errorMessage =
          "Navigation error: Page navigation was aborted. This can happen when multiple navigation requests conflict. The system will retry automatically.";
      } else if (
        error.message.includes("401") ||
        error.message.includes("Unauthorized")
      ) {
        errorMessage =
          "Authentication error (401): OpenAI API key is invalid or expired. Please verify your API key configuration.";
      } else if (
        error.message.includes("429") ||
        error.message.includes("rate limit")
      ) {
        errorMessage =
          "Rate limit exceeded (429): Too many API requests. The system will automatically retry with exponential backoff (5s → 15s → 30s → 60s → 120s).";
      } else if (
        error.message.includes("400") ||
        error.message.includes("No tool output found")
      ) {
        errorMessage =
          "Browser automation error: Tool execution failed. This may be due to temporary API issues. Please try again.";
      } else if (
        error.message.includes("Target page, context or browser has been closed")
      ) {
        errorMessage =
          "Browser session error: The browser was closed unexpectedly. This may happen if the session was manually paused. Please try again.";
      }
    }

    // Mark session as failed ONLY if it was running
    // This prevents issues if manual stop occurred during execution
    const failedSession = await AgentSession.findOneAndUpdate(
      { _id: sessionId, status: "running" },
      {
        status: "failed",
        errorMessage: errorMessage,
        completedAt: new Date(),
      },
      { new: true }
    );

    // NO CREDIT DEDUCTION FOR FAILED SESSIONS
    // Credits are only deducted when user manually stops or task completes successfully
    if (failedSession) {
      console.log(`ℹ️ Session ${sessionId} failed - no credits deducted (failures are free)`);
    } else {
      console.log(`ℹ️ Session ${sessionId} was not running when failure occurred - likely stopped manually.`);
    }

    // Update daily task if this was a daily task execution AND session was actually failed
    // Set to 'pending' instead of 'failed' so it can be re-run
    // Only update if session wasn't manually stopped (failedSession !== null)
    if (dailyTaskId && failedSession) {
      await DailyTask.findByIdAndUpdate(dailyTaskId, {
        status: "pending",
        error: errorMessage,
      });

      console.log(
        `⚠️ Day task ${dailyTaskId} stopped/failed - status reset to pending for retry: ${errorMessage}`,
      );
    } else if (dailyTaskId && !failedSession) {
      console.log(`ℹ️ Day task ${dailyTaskId} not updated - session was stopped manually before failure could be recorded`);
    }

    // Stop the Browserbase session
    if (browser) {
      try {
        await browser.disconnect();
        browser = null; // Prevent double cleanup in finally block
      } catch (err) {
        console.error("Error stopping browser session:", err);
      }
    }

    return { success: false, error: errorMessage };
  } finally {
    // Clean up browser if not already cleaned up
    if (browser) {
      try {
        await browser.disconnect();
      } catch (err) {
        console.error("Error disconnecting browser:", err);
      }
    }
  }
}

// POST /api/agents/[id]/deploy - Deploy an agent (execute using pre-generated executionPrompt)
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const rateLimit = await applyRateLimit(request, agentExecutionRateLimiter);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      {
        status: 429,
        headers: rateLimit.headers,
      },
    );
  }

  try {
    const { userId, error } = await getUserId();
    if (error || !userId) return error || NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const agentId = id;

    if (!mongoose.Types.ObjectId.isValid(agentId)) {
      return NextResponse.json(
        { error: "Invalid agent ID" },
        { status: 400, headers: rateLimit.headers },
      );
    }

    await connectDB();

    // Get agent with userId verification
    const agent = await AgentModel.findOne({ _id: agentId, userId });

    if (!agent) {
      return NextResponse.json(
        { error: "Agent not found" },
        { status: 404, headers: rateLimit.headers },
      );
    }

    // Check if user has sufficient credits before starting execution
    const creditCheck = await checkSufficientCredits(userId, CREDITS_CONFIG.MINIMUM_CREDITS_TO_RUN);
    
    if (!creditCheck.sufficient) {
      return NextResponse.json(
        { 
          error: "Insufficient credits to run agent. You need at least 1 credit to start an agent run.",
          currentBalance: creditCheck.currentBalance,
          required: creditCheck.required,
        },
        { status: 402, headers: rateLimit.headers },
      );
    }

    // Validate OpenAI API key before starting execution (prevents 401 errors mid-execution)
    const apiKeyValidation = await validateOpenAIKey();
    if (!apiKeyValidation.valid) {
      console.error('❌ OpenAI API key validation failed:', apiKeyValidation.error);
      return NextResponse.json(
        { error: apiKeyValidation.error || "Invalid OpenAI API configuration" },
        { status: 500, headers: rateLimit.headers },
      );
    }

    // Check for daily tasks first (multi-day campaign mode) with userId filtering
    const nextPendingTask = await DailyTask.find({
      agentId,
      userId,
      status: "pending"
    }).sort({ dayNumber: 1 }).limit(1);

    let executionPrompt = agent.executionPrompt;
    let currentDailyTaskId: string | undefined;
    console.log(`@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@ ${executionPrompt}`);

    if (nextPendingTask.length > 0) {
      // Use daily task prompt for multi-day campaigns
      const task = nextPendingTask[0];
      executionPrompt = task.taskPrompt;
      currentDailyTaskId = task._id.toString();
      console.log(`$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$ ${task.taskPrompt}`);

      console.log(`🎯 Executing Day ${task.dayNumber} task (ID: ${task._id})`);

      console.log(`################################# ${executionPrompt}`);
      // Update task status to running
      await DailyTask.findByIdAndUpdate(task._id, { status: "running" });
    } else if (!agent.executionPrompt) {
      // No daily tasks and no executionPrompt - cannot execute
      return NextResponse.json(
        {
          error:
            "Agent does not have an execution plan. Please recreate the agent.",
        },
        { status: 400, headers: rateLimit.headers },
      );
    }

    // PROGRAMMATIC FAILSAFE: Ensure browser capabilities are present in the execution prompt
    // If GPT-4o forgot to include them, we add them here
    // Case-insensitive check to handle "BROWSER CAPABILITIES", "Browser Capabilities", etc.
    if (executionPrompt && !/browser capabilities/i.test(executionPrompt)) {
      const { generateBrowserCapabilitiesHeader } = await import('@/app/lib/master-agent');
      const browserCapabilitiesHeader = generateBrowserCapabilitiesHeader(
        agent.platforms,
        agent.targetWebsite ?? undefined
      );
      
      // Insert browser capabilities after AUTHENTICATION section or after OBJECTIVE if no AUTH
      const authIndex = executionPrompt.indexOf('AUTHENTICATION:');
      const objectiveIndex = executionPrompt.indexOf('OBJECTIVE:');
      
      if (authIndex !== -1) {
        // Find the end of the AUTHENTICATION section (next section starts with all caps word followed by :)
        const afterAuth = executionPrompt.substring(authIndex);
        const nextSectionMatch = afterAuth.match(/\n\n([A-Z\s]+):/);
        if (nextSectionMatch) {
          const insertPosition = authIndex + afterAuth.indexOf(nextSectionMatch[0]);
          executionPrompt = executionPrompt.slice(0, insertPosition) + '\n\n' + browserCapabilitiesHeader + '\n' + executionPrompt.slice(insertPosition);
        } else {
          executionPrompt = executionPrompt + '\n\n' + browserCapabilitiesHeader;
        }
      } else if (objectiveIndex !== -1) {
        // Find the end of the OBJECTIVE section
        const afterObjective = executionPrompt.substring(objectiveIndex);
        const nextSectionMatch = afterObjective.match(/\n\n([A-Z\s]+):/);
        if (nextSectionMatch) {
          const insertPosition = objectiveIndex + afterObjective.indexOf(nextSectionMatch[0]);
          executionPrompt = executionPrompt.slice(0, insertPosition) + '\n\n' + browserCapabilitiesHeader + '\n' + executionPrompt.slice(insertPosition);
        } else {
          executionPrompt = executionPrompt + '\n\n' + browserCapabilitiesHeader;
        }
      } else {
        // If no AUTHENTICATION or OBJECTIVE sections found, prepend to the entire prompt
        executionPrompt = browserCapabilitiesHeader + '\n\n' + executionPrompt;
      }
      
      console.log('✅ Programmatic failsafe: Browser capabilities added to execution prompt');
    }

    // Set isDeployed to true BEFORE starting execution to prevent race condition
    const deployedAgent = await AgentModel.findByIdAndUpdate(
      agentId,
      {
        isDeployed: true,
        updatedAt: new Date(),
      },
      { new: true }
    );

    // Create a new session with userId
    const session = await AgentSession.create({
      userId,
      agentId: agentId,
      status: "running",
      startedAt: new Date(),
    });

    // Start autonomous execution in background using executionPrompt
    let sessionInfo = null;
    try {
      // Start execution in the background (don't await, but capture promise)
      const agentData: AgentData = {
        id: agent._id.toString(),
        name: agent.name,
        systemPrompt: agent.systemPrompt,
        targetWebsite: agent.targetWebsite,
        authCredentials: agent.authCredentials,
        knowledgeBase: agent.knowledgeBase,
        userExpectations: agent.userExpectations,
        isDeployed: agent.isDeployed,
      };
      
      const executionPromise = executeWithExecutionPrompt(
        agentId,
        session._id.toString(),
        executionPrompt!,
        agentData,
        currentDailyTaskId,
        userId,
      );

      // Poll for the session with browserSessionId to appear
      // Wait up to 90 seconds for the browser session to start (browserbase can take 60+ seconds)
      const maxWaitTime = 90000; // 90 seconds
      const pollInterval = 500; // Check every 500ms
      const startTime = Date.now();

      while (Date.now() - startTime < maxWaitTime) {
        const runningSession = await AgentSession.findOne({
          agentId,
          userId,
          status: "running"
        }).sort({ _id: -1 });

        if (runningSession && runningSession.browserSessionId) {
          sessionInfo = runningSession;
          console.log(
            "Session with browserSessionId found:",
            runningSession.browserSessionId,
          );
          break;
        }

        // Wait before next poll
        await new Promise((resolve) => setTimeout(resolve, pollInterval));
      }

      // Let execution continue in background
      executionPromise.catch((error) => {
        console.error("Background execution error:", error);
      });

      console.log("Session info after polling:", sessionInfo);
    } catch (error) {
      console.error("Error starting execution:", error);
      // If execution fails, rollback isDeployed
      await AgentModel.findByIdAndUpdate(agentId, { isDeployed: false });
    }

    // Create agent_deployed notification
    let agentNotification = undefined;
    if (userId) {
      try {
        const notification = await NotificationService.createNotification({
          userId,
          typeKey: 'agent_deployed',
          metadata: {
            agentId: agentId,
            agentName: deployedAgent?.name || agent.name,
          }
        });
        
        agentNotification = {
          type: 'agent',
          title: notification.title,
          message: notification.body,
          priority: notification.priority,
        };
      } catch (notifError) {
        console.error('Error creating agent_deployed notification:', notifError);
      }
    }

    return NextResponse.json(
      {
        success: true,
        agent: deployedAgent,
        session: sessionInfo,
        agentNotification,
        message:
          "Agent deployed successfully! Autonomous execution has started.",
      },
      { status: 200, headers: rateLimit.headers },
    );
  } catch (error) {
    console.error("Error deploying agent:", error);
    return NextResponse.json(
      { error: "Failed to deploy agent" },
      { status: 500, headers: rateLimit.headers },
    );
  }
}
