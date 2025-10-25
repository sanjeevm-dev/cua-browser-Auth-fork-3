import { NextResponse } from "next/server";
import { Agent } from "../agent/agent";
import { BrowserbaseBrowser } from "../agent/browserbase";
import { InputItem } from "../agent/types";
import { cuaStartSchema, validateRequest } from "../../../lib/validation";
import {
  applyRateLimit,
  resourceIntensiveRateLimiter,
} from "@/app/lib/rate-limiter";

export async function POST(request: Request) {
  const rateLimit = await applyRateLimit(request, resourceIntensiveRateLimiter);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      {
        status: 429,
        headers: rateLimit.headers,
      },
    );
  }

  let computer: BrowserbaseBrowser | null = null;
  let agent: Agent | null = null;

  try {
    const body = await request.json();

    console.log(
      "body%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%",
      body,
    );

    const validation = validateRequest(cuaStartSchema, body);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error },
        {
          status: 400,
          headers: rateLimit.headers,
        },
      );
    }

    const bodyWithExtra = body as Record<string, unknown>;
    const sessionId = bodyWithExtra.sessionId as string | undefined;
    const userInput = bodyWithExtra.userInput as string | undefined;

    computer = new BrowserbaseBrowser(1024, 768, "us-west-2", false, sessionId);
    agent = new Agent("computer-use-preview", computer);
    if (!sessionId || !userInput) {
      return NextResponse.json(
        { error: "Missing sessionId or userInput in request body" },
        { status: 400, headers: rateLimit.headers },
      );
    }

    await computer.connect();

    // Check if userInput contains a URL and navigate to it
    const urlPattern =
      /(https?:\/\/[^\s]+)|(?:^|\s)([a-zA-Z0-9-]+\.(?:com|org|edu|gov|net|io|ai|app|dev|co|me|info|biz)\b)/;
    const urlMatch = userInput.match(urlPattern);

    const initialMessages: InputItem[] = [
      {
        role: "developer",
        content:
          "You are a helpful assistant that can use a web browser to accomplish tasks. Your starting point is the Brave Search page. If you see nothing, try going to Brave Search.",
      },
      {
        role: "user",
        content: urlMatch
          ? "What page are we on? Can you take a screenshot to confirm?"
          : userInput,
      },
    ];

    console.log(
      "initialMessages%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%",
      initialMessages,
    );

    // Initialize the agent with the first step
    let stepResult = await agent.getAction(initialMessages, undefined);

    if (
      stepResult.output.length > 0 &&
      stepResult.output.find((item) => item.type === "message")
    ) {
      return NextResponse.json([stepResult], {
        headers: rateLimit.headers,
      });
    }

    const actions = await agent.takeAction(stepResult.output);

    // This is a hack because function calling doesn't work if it's the first call made by the LLM.
    if (urlMatch) {
      let fakeAction;
      let fakeStep;
      let done = false;

      do {
        if (fakeStep) {
          fakeAction = await agent.getAction(
            fakeStep.filter((item) => item.type === "computer_call_output"),
            fakeAction!.responseId,
          );
        } else {
          fakeAction = await agent.getAction(
            actions.filter((item) => item.type === "computer_call_output"),
            stepResult.responseId,
          );
        }
        stepResult = fakeAction;
        if (
          fakeAction.output.length > 0 &&
          fakeAction.output.find((item) => item.type === "message") != null
        ) {
          done = true;
        } else {
          fakeStep = await agent.takeAction(fakeAction.output);
        }
      } while (!done);

      stepResult = await agent.getAction(
        [
          {
            role: "user",
            content: "Let's continue.",
          },
          {
            role: "user",
            content: userInput,
          },
        ],
        stepResult.responseId,
      );
      return NextResponse.json([stepResult], {
        headers: rateLimit.headers,
      });
    }

    const nextStep = [];

    for (const action of actions) {
      if ("type" in action && action.type === "message") {
        nextStep.push({ output: [action], responseId: stepResult.responseId });
      } else {
        const nextStepResult = await agent.getAction(
          [action],
          stepResult.responseId,
        );
        nextStep.push(nextStepResult);
      }
    }

    return NextResponse.json(nextStep, {
      headers: rateLimit.headers,
    });
  } catch (error) {
    console.error("Error in cua endpoint:", error);
    return NextResponse.json(
      { success: false, error: "Failed to process request" },
      { status: 500, headers: rateLimit.headers },
    );
  }
}
