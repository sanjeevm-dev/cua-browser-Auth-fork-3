"use client";

import { motion } from "framer-motion";
import { useState, useEffect, useCallback, useRef } from "react";
import React from "react";
import { useWindowSize } from "usehooks-ts";
import posthog from "posthog-js";
import {
  FunctionOutput,
  Item,
  ComputerCallOutput,
  OutputText,
} from "../api/cua/agent/types";
import { SessionControls } from "./SessionControls";
import BrowserSessionContainer from "./BrowserSessionContainer";
import { SessionLiveURLs } from "@browserbasehq/sdk/resources/index.mjs";
import BrowserTabs from "./BrowserTabs";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";
import GoalMessage from "./chat/GoalMessage";
import ChatMessagesList from "./chat/ChatMessagesList";
import ChatInput from "./chat/ChatInput";

interface ChatFeedProps {
  initialMessage?: string;
  onClose: () => void;
  url?: string;
  existingBrowserSessionId?: string;
  existingSessionId?: string;
}

export interface BrowserStep {
  text: string;
  reasoning: string;
  tool:
    | "GOTO"
    | "ACT"
    | "EXTRACT"
    | "OBSERVE"
    | "CLOSE"
    | "WAIT"
    | "NAVBACK"
    | "MESSAGE"
    | "CLICK"
    | "TYPE"
    | "KEYPRESS"
    | "SCROLL"
    | "DOUBLECLICK"
    | "DRAG"
    | "SCREENSHOT"
    | "MOVE";
  instruction: string;
  stepNumber?: number;
  messageId?: string;
}

interface AgentState {
  sessionId: string | null;
  sessionUrl: string | null;
  connectUrl: string | null;
  steps: BrowserStep[];
  isLoading: boolean;
}

// formatTime moved to SessionControls component

// Generate detailed reasoning for actions based on context and action type
const generateDetailedReasoning = (
  action: Record<string, unknown>,
  actionType: string,
  contextClues: Record<string, unknown>,
  createTaskDescription: (
    action: Record<string, unknown>,
    actionType: string
  ) => string
): string => {
  // Get basic description first
  const basicDescription = createTaskDescription(action, actionType);

  // Add more detailed context based on the action type and available context
  switch (actionType) {
    case "click":
      if (contextClues.goal) {
        return `${basicDescription} to begin searching for information about ${contextClues.goal}. This interaction initiates the search process.`;
      }
      return `${basicDescription} to interact with the page interface. This helps navigate through the content to find the requested information.`;

    case "type":
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const text = action.text || "";
      if (contextClues.goal) {
        return `${basicDescription} to search for specific information about ${contextClues.goal}. Entering these search terms will help retrieve relevant results.`;
      }
      return `${basicDescription} to provide input needed for this search. This text will help narrow down the results to find the specific information requested.`;

    case "keypress":
      const keys = Array.isArray(action.keys) ? action.keys.join(", ") : "";
      if (keys.includes("ENTER")) {
        return `Submitting the search query to find information about ${
          contextClues.goal || "the requested topic"
        }. This will execute the search and retrieve relevant results.`;
      }
      return `${basicDescription} to efficiently interact with the page. This keyboard interaction helps streamline the navigation process.`;

    case "scroll":
      return `${basicDescription} to view additional content that might contain the requested information about ${
        contextClues.goal || "the topic"
      }. Scrolling allows examining more search results or content.`;

    case "goto":
      let domain = "";
      try {
        if (action.url) {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          domain = new URL(action.url as string).hostname.replace("www.", "");
        }
      } catch (e) {
        console.error("Error parsing URL:", e);
      }

      return `${basicDescription} to find information about ${
        contextClues.goal || "the requested topic"
      }. This website likely contains relevant data or search capabilities needed.`;

    case "back":
      return `${basicDescription} to return to previous content. This helps with navigation when the current page doesn't contain the needed information.`;

    case "wait":
      return `${basicDescription} while the page loads the requested information. This ensures all content is properly displayed before proceeding.`;

    case "double_click":
      return `${basicDescription} to interact with this element. Double-clicking often opens or expands content that may contain relevant information.`;

    case "drag":
      // Get start and end points from the path if available
      let startPoint = { x: 0, y: 0 };
      let endPoint = { x: 0, y: 0 };
      if (Array.isArray(action.path) && action.path.length > 0) {
        startPoint = action.path[0] as { x: number; y: number };
        endPoint = action.path[action.path.length - 1] as {
          x: number;
          y: number;
        };
      }
      return `${basicDescription} to adjust the view or interact with content. Dragging from (${startPoint.x}, ${startPoint.y}) to (${endPoint.x}, ${endPoint.y}) helps reveal or organize information in a more useful way.`;

    case "screenshot":
      return `${basicDescription} to capture the visual information displayed. This preserves the current state of the information for reference.`;

    case "move":
      return `${basicDescription} to prepare for the next interaction. Positioning the cursor is necessary before clicking or selecting content.`;

    case "message":
      if (
        typeof action.text === "string" &&
        (action.text.startsWith("yes") ||
          action.text.startsWith("no") ||
          action.text.includes("?"))
      ) {
        return `Providing additional input to refine the search for information about ${
          contextClues.goal || "the requested topic"
        }. This clarification helps the assistant provide more relevant results.`;
      }
      return `Communicating with the assistant about ${
        contextClues.goal || "the requested information"
      }. This exchange helps clarify needs and receive appropriate information.`;

    default:
      return `${basicDescription} to progress in finding information about ${
        contextClues.goal || "the requested topic"
      }. This action is part of the process to retrieve the relevant data.`;
  }
};

export default function LegacyChatFeed({
  initialMessage,
  onClose,
  existingBrowserSessionId,
  existingSessionId,
}: ChatFeedProps) {
  const [activePage, setActivePage] = useState<SessionLiveURLs.Page | null>(
    null
  );
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [isLoading, setIsLoading] = useState(false);
  const [sessionTime, setSessionTime] = useState(0);
  const { width } = useWindowSize();
  const isMobile = width ? width < 768 : false;
  const initializationRef = useRef(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const [isScrolled, setIsScrolled] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [isMounted, setIsMounted] = useState(false);
  const [isAgentFinished, setIsAgentFinished] = useState(false);
  const agentStateRef = useRef<AgentState>({
    sessionId: null,
    sessionUrl: null,
    connectUrl: null,
    steps: [],
    isLoading: false,
  });

  const [uiState, setUiState] = useState<{
    sessionId: string | null;
    sessionUrl: string | null;
    connectUrl: string | null;
    steps: BrowserStep[];
  }>({
    sessionId: null,
    sessionUrl: null,
    connectUrl: null,
    steps: [],
  });

  // generate the debugger URL for the current tab
  const activePageUrl = (
    activePage?.debuggerFullscreenUrl ??
    uiState.sessionUrl ??
    ""
  ).replace(
    "https://www.browserbase.com/devtools-fullscreen/inspector.html",
    "https://www.browserbase.com/devtools-internal-compiled/index.html"
  );

  const [userInput, setUserInput] = useState("");
  const [isWaitingForInput, setIsWaitingForInput] = useState(false);

  const scrollToBottom = useCallback(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop =
        chatContainerRef.current.scrollHeight;
    }
  }, []);

  // Set mounted state after hydration is complete
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Track scroll position to apply conditional margin
  useEffect(() => {
    const handleScroll = () => {
      if (chatContainerRef.current) {
        setIsScrolled(chatContainerRef.current.scrollTop > 10);
      }
    };

    const container = chatContainerRef.current;
    if (container) {
      container.addEventListener("scroll", handleScroll);
      return () => container.removeEventListener("scroll", handleScroll);
    }
  }, []);

  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;

    if (uiState.sessionId) {
      // Reset timer when a new session starts
      setSessionTime(0);

      // Start the timer
      timer = setInterval(() => {
        setSessionTime((prevTime) => prevTime + 1);
      }, 1000);
    }

    return () => {
      if (timer) clearInterval(timer);
    };
  }, [uiState.sessionId]);

  useEffect(() => {
    if (
      uiState.steps.length > 0 &&
      uiState.steps[uiState.steps.length - 1].tool === "CLOSE"
    ) {
      setIsAgentFinished(true);
    }
  }, [uiState.sessionId, uiState.steps]);

  // Watch for isAgentFinished state changes to terminate the session when stop button is clicked
  useEffect(() => {
    if (isAgentFinished && uiState.sessionId) {
      console.log(
        "Terminating session due to agent finished state:",
        uiState.sessionId
      );

      // Set a flag to prevent further API calls
      const abortController = new AbortController();
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const signal = abortController.signal;

      // Cancel any pending requests
      abortController.abort();

      // Wait a short delay to allow any in-progress operations to complete
      setTimeout(() => {
        fetch("/api/session", {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            sessionId: uiState.sessionId,
          }),
        }).catch((error) => {
          // Ignore errors during session termination
          console.log(
            "Error during session termination (can be ignored):",
            error
          );
        });
      }, 500);
    }
  }, [isAgentFinished, uiState.sessionId]);

  useEffect(() => {
    scrollToBottom();
  }, [uiState.steps, scrollToBottom]);

  // Add a new function to process a single step
  const processStep = useCallback(
    async (
      stepData: {
        output: Item[];
        responseId: string;
      }[],
      sessionId?: string,
      stepNumber = 1
    ) => {
      // Ensure stepData is an array before using array methods
      if (!Array.isArray(stepData)) {
        console.error("stepData is not an array:", stepData);
        // Add an error message to the UI
        const errorStep: BrowserStep = {
          text: `There was an error processing the request. Please try again.`,
          reasoning: `API returned invalid data: ${JSON.stringify(stepData)}`,
          tool: "MESSAGE",
          instruction: "",
          stepNumber: stepNumber++,
        };

        agentStateRef.current = {
          ...agentStateRef.current,
          steps: [...agentStateRef.current.steps, errorStep],
          isLoading: false,
        };

        setUiState((prev) => ({
          ...prev,
          steps: agentStateRef.current.steps,
          isLoading: false,
        }));

        setIsWaitingForInput(true);
        return;
      }

      const hasMessage = stepData.find((step) =>
        step.output.find((item) => item.type === "message")
      );
      const hasComputerCall = stepData.find((step) =>
        step.output.find((item) => item.type === "computer_call")
      );
      const hasFunctionCall = stepData.find((step) =>
        step.output.find((item) => item.type === "function_call")
      );

      const messageItem = hasMessage?.output.find(
        (item) => item.type === "message"
      );
      const computerItem = hasComputerCall?.output.find(
        (item) => item.type === "computer_call"
      );
      const functionItem = hasFunctionCall?.output.find(
        (item) => item.type === "function_call"
      );

      // Extract context from message content
      const contextClues = {
        website: "",
        action: "",
        subject: "",
        location: "",
        filter: "",
        selection: "",
        goal: "", // The overall user goal
        lastAction: "", // Keep track of the previous action
      };

      // Extract context from message content if available
      if (
        messageItem &&
        messageItem.type === "message" &&
        messageItem.content
      ) {
        // Extract text from content items
        const messageText =
          messageItem.content
            .filter((content) => content.type === "output_text")
            .map((content) => (content as OutputText).text)
            .join(" ") || "";

        // Look for goal statements
        const goalPatterns = [
          /(?:I want to|I'd like to|I need to|Can you|Please)\s+([^.?!]+)[.?!]/i,
          /(?:find|search|look up|tell me|show me)\s+([^.?!]+)[.?!]/i,
          /(?:what is|how much|how many|where is|when is)\s+([^.?!]+)[?]/i,
        ];

        // Extract website names
        const websitePatterns = [
          /(?:on|to|using|visit|open|access|browse)\s+([A-Za-z0-9]+(?:\.[A-Za-z0-9]+)+)/i,
          /([A-Za-z0-9]+(?:\.[A-Za-z0-9]+)+)\s+(?:website|site|page)/i,
          /(?:website|site|page)\s+([A-Za-z0-9]+(?:\.[A-Za-z0-9]+)+)/i,
        ];

        // Extract search terms
        const searchPatterns = [
          /(?:search|look|find)(?:\s+for)?\s+([^.,;]+)/i,
          /searching\s+for\s+([^.,;]+)/i,
        ];

        // Extract location information
        const locationPatterns = [
          /(?:in|near|at|around)\s+([A-Za-z\s]+(?:City|Town|Village|County|State|Province|District|Area|Region))/i,
          /location\s+(?:in|near|at|to)\s+([^.,;]+)/i,
          /([A-Za-z\s]+(?:City|Town|Village|County|State|Province|District|Area|Region))/i,
        ];

        // Extract filter information
        const filterPatterns = [
          /filter\s+(?:by|for|with)\s+([^.,;]+)/i,
          /(?:set|adjust|change)\s+(?:the)?\s+([^\s]+)\s+(?:filter|setting|option)\s+(?:to|for)?\s+([^.,;]+)/i,
        ];

        // Extract selection information
        const selectionPatterns = [
          /(?:select|choose|pick)\s+(?:the)?\s+([^.,;]+)/i,
          /selecting\s+(?:the)?\s+([^.,;]+)/i,
        ];

        // Apply all patterns to extract context
        for (const pattern of goalPatterns) {
          const match = messageText.match(pattern);
          if (match && match[1]) {
            contextClues.goal = match[1].trim();
            break;
          }
        }

        for (const pattern of websitePatterns) {
          const match = messageText.match(pattern);
          if (match && match[1]) {
            contextClues.website = match[1].trim();
            break;
          }
        }

        for (const pattern of searchPatterns) {
          const match = messageText.match(pattern);
          if (match && match[1]) {
            contextClues.subject = match[1].trim();
            break;
          }
        }

        for (const pattern of locationPatterns) {
          const match = messageText.match(pattern);
          if (match && match[1]) {
            contextClues.location = match[1].trim();
            break;
          }
        }

        for (const pattern of filterPatterns) {
          const match = messageText.match(pattern);
          if (match && match[1]) {
            contextClues.filter = match[1].trim();
            if (match[2]) contextClues.filter += " " + match[2].trim();
            break;
          }
        }

        for (const pattern of selectionPatterns) {
          const match = messageText.match(pattern);
          if (match && match[1]) {
            contextClues.selection = match[1].trim();
            break;
          }
        }

        // Determine the main action from the message
        if (messageText.match(/search|find|look/i)) {
          contextClues.action = "searching";
        } else if (messageText.match(/select|choose|pick/i)) {
          contextClues.action = "selecting";
        } else if (messageText.match(/filter|adjust|set/i)) {
          contextClues.action = "filtering";
        } else if (messageText.match(/click|press|tap/i)) {
          contextClues.action = "clicking";
        } else if (messageText.match(/type|enter|input|fill/i)) {
          contextClues.action = "entering";
        } else if (messageText.match(/scroll|move/i)) {
          contextClues.action = "scrolling";
        }
      }

      // Create a concise, task-oriented reasoning description
      const createTaskDescription = (
        action: Record<string, unknown>,
        actionType: string
      ): string => {
        // Default descriptions based on action type
        const defaultDescriptions: Record<string, string> = {
          click: "Clicking on an element",
          type: "Entering text",
          keypress: "Pressing keyboard keys",
          scroll: "Scrolling the page",
          goto: "Navigating to a website",
          back: "Going back to previous page",
          wait: "Waiting for page to load",
          double_click: "Double-clicking on an element",
          drag: "Dragging an element",
          screenshot: "Taking a screenshot",
          move: "Moving the cursor",
          message: "Sending a message",
        };

        // Get domain from URL for goto actions
        let domain = "";
        if (actionType === "goto" && typeof action.url === "string") {
          try {
            domain = new URL(action.url).hostname.replace("www.", "");
          } catch (e: unknown) {
            // If URL parsing fails, just use the default
            console.error("Error parsing URL:", e);
          }
        }

        // Create specific descriptions based on context
        switch (actionType) {
          case "click":
            // Try to infer what's being clicked based on common UI patterns
            const x = typeof action.x === "number" ? action.x : 0;
            const y = typeof action.y === "number" ? action.y : 0;

            if (typeof action.x === "number" && typeof action.y === "number") {
              // Check if clicking in top-left corner (often navigation/menu)
              if (x < 100 && y < 100) {
                return "Opening navigation menu";
              }
              // Check if clicking in top-right corner (often account/settings)
              else if (x > 900 && y < 100) {
                return "Accessing account options";
              }
              // Check if clicking near bottom of page (often pagination/load more)
              else if (y > 500) {
                return "Loading more content";
              }
            }

            return "Selecting an interactive element";
          case "type":
            const text = typeof action.text === "string" ? action.text : "";
            if (text.includes("@") && text.includes("."))
              return "Entering email address";
            if (text.length > 20) return "Entering detailed information";
            if (/^\d+$/.test(text)) return "Entering numeric value";
            return text
              ? `Typing "${text.substring(0, 15)}${
                  text.length > 15 ? "..." : ""
                }"`
              : defaultDescriptions.type;
          case "keypress":
            const keys = Array.isArray(action.keys)
              ? action.keys.join(", ")
              : "";
            if (keys.includes("Enter")) return "Submitting form";
            if (keys.includes("Tab")) return "Moving to next field";
            if (keys.includes("Escape")) return "Closing dialog";
            return defaultDescriptions.keypress;
          case "scroll":
            const scrollY =
              typeof action.scroll_y === "number" ? action.scroll_y : 0;
            return scrollY > 0
              ? "Scrolling down to see more results"
              : "Scrolling up to previous content";
          case "goto":
            return domain ? `Accessing ${domain}` : defaultDescriptions.goto;
          case "back":
            return "Going back to previous page";
          case "wait":
            // Provide more specific wait descriptions
            if (contextClues.action === "searching") {
              return `Waiting for search results to load`;
            } else if (contextClues.website) {
              return `Waiting for ${contextClues.website} page to load`;
            } else if (contextClues.subject) {
              return `Waiting for ${contextClues.subject} content to appear`;
            }
            return "Waiting for page to respond";
          default:
            // For other action types, try to be more specific based on context
            if (actionType === "doubleclick" && contextClues.selection) {
              return `Opening ${contextClues.selection}`;
            } else if (actionType === "drag" && contextClues.action) {
              return `Adjusting ${contextClues.action} by dragging`;
            } else if (actionType === "screenshot") {
              return "Capturing screenshot of current view";
            } else if (actionType === "move" && contextClues.action) {
              return `Positioning cursor for ${contextClues.action}`;
            }
            return (
              defaultDescriptions[actionType] ||
              `Performing ${actionType} action`
            );
        }
      };

      if (
        !hasComputerCall &&
        !hasFunctionCall &&
        messageItem &&
        messageItem.type === "message" &&
        messageItem.content[0].type === "output_text"
      ) {
        const newStep: BrowserStep = {
          text: messageItem.content?.[0].text || "",
          reasoning: "Processing message",
          tool: "MESSAGE",
          instruction: "",
          stepNumber: stepNumber++,
          messageId: messageItem.id,
        };

        // Only add the step if we haven't seen this messageId before
        const isDuplicate = agentStateRef.current.steps.some(
          (step) =>
            step.messageId === messageItem.id && messageItem.id !== undefined
        );

        if (!isDuplicate) {
          agentStateRef.current = {
            ...agentStateRef.current,
            steps: [...agentStateRef.current.steps, newStep],
          };

          setUiState((prev) => ({
            ...prev,
            steps: agentStateRef.current.steps,
          }));
        }

        setIsWaitingForInput(true);
        currentResponseRef.current = {
          id: stepData[0].responseId,
        };
      } else if (computerItem || functionItem) {
        if (
          messageItem &&
          messageItem.type === "message" &&
          messageItem.content[0].type === "output_text"
        ) {
          const newStep: BrowserStep = {
            text: messageItem.content?.[0].text || "",
            reasoning: "Processing message",
            tool: "MESSAGE",
            instruction: "",
            stepNumber: stepNumber++,
            messageId: messageItem.id,
          };

          // Only add the step if we haven't seen this messageId before
          const isDuplicate = agentStateRef.current.steps.some(
            (step) =>
              step.messageId === messageItem.id && messageItem.id !== undefined
          );

          if (!isDuplicate) {
            agentStateRef.current = {
              ...agentStateRef.current,
              steps: [...agentStateRef.current.steps, newStep],
            };

            setUiState((prev) => ({
              ...prev,
              steps: agentStateRef.current.steps,
            }));
          }
        }
        let actionStep: BrowserStep | null = null;

        if (computerItem) {
          const action = computerItem.action;

          switch (action.type) {
            case "click":
              actionStep = {
                text: `Clicking at position (${action.x}, ${action.y})`,
                reasoning: generateDetailedReasoning(
                  action,
                  "click",
                  contextClues,
                  createTaskDescription
                ),
                tool: "CLICK",
                instruction: `click(${action.x}, ${action.y})`,
                stepNumber: stepNumber++,
              };
              break;
            case "type":
              actionStep = {
                text: `Typing text: "${action.text}"`,
                reasoning: generateDetailedReasoning(
                  action,
                  "type",
                  contextClues,
                  createTaskDescription
                ),
                tool: "TYPE",
                instruction: action.text || "",
                stepNumber: stepNumber++,
              };
              break;
            case "keypress":
              actionStep = {
                text: `Pressing keys: ${action.keys?.join(", ")}`,
                reasoning: generateDetailedReasoning(
                  action,
                  "keypress",
                  contextClues,
                  createTaskDescription
                ),
                tool: "KEYPRESS",
                instruction: action.keys?.join(", ") || "",
                stepNumber: stepNumber++,
              };
              break;
            case "scroll":
              actionStep = {
                text: `Scrolling by (${action.scroll_x}, ${action.scroll_y})`,
                reasoning: generateDetailedReasoning(
                  action,
                  "scroll",
                  contextClues,
                  createTaskDescription
                ),
                tool: "SCROLL",
                instruction: `scroll(${action.scroll_x}, ${action.scroll_y})`,
                stepNumber: stepNumber++,
              };
              break;
            default:
              // Create more specific text descriptions for different action types
              let actionText = `Performing ${action.type} action`;

              if (action.type === "wait") {
                actionText = "Waiting for page to respond";
              } else if (action.type === "double_click") {
                actionText = `Double-clicking at position (${action.x || 0}, ${
                  action.y || 0
                })`;
              } else if (action.type === "drag") {
                // Drag has a path array with start and end points
                const startPoint = action.path?.[0] || { x: 0, y: 0 };
                const endPoint = action.path?.[action.path?.length - 1] || {
                  x: 0,
                  y: 0,
                };
                actionText = `Dragging from (${startPoint.x}, ${startPoint.y}) to (${endPoint.x}, ${endPoint.y})`;
              } else if (action.type === "screenshot") {
                actionText = "Taking screenshot of current page";
              } else if (action.type === "move") {
                actionText = `Moving cursor to position (${action.x || 0}, ${
                  action.y || 0
                })`;
              }

              actionStep = {
                text: actionText,
                reasoning: generateDetailedReasoning(
                  action,
                  action.type,
                  contextClues,
                  createTaskDescription
                ),
                tool: action.type.toUpperCase() as unknown as
                  | "GOTO"
                  | "ACT"
                  | "EXTRACT"
                  | "OBSERVE"
                  | "CLOSE"
                  | "WAIT"
                  | "NAVBACK"
                  | "MESSAGE"
                  | "CLICK"
                  | "TYPE"
                  | "KEYPRESS"
                  | "SCROLL"
                  | "DOUBLECLICK"
                  | "DRAG"
                  | "SCREENSHOT"
                  | "MOVE",
                instruction: action.type,
                stepNumber: stepNumber++,
              };
          }
        } else if (functionItem) {
          switch (functionItem.name) {
            case "back":
              actionStep = {
                text: "Going back to the previous page",
                reasoning: generateDetailedReasoning(
                  {},
                  "back",
                  contextClues,
                  createTaskDescription
                ),
                tool: "NAVBACK",
                instruction: "back()",
                stepNumber: stepNumber++,
              };
              break;
            case "goto":
              const gotoArgs = JSON.parse(functionItem.arguments);
              actionStep = {
                text: `Navigating to ${gotoArgs.url}`,
                reasoning: generateDetailedReasoning(
                  gotoArgs,
                  "goto",
                  contextClues,
                  createTaskDescription
                ),
                tool: "GOTO",
                instruction: `goto(${gotoArgs.url})`,
                stepNumber: stepNumber++,
              };
              break;
          }
        }
        agentStateRef.current = {
          ...agentStateRef.current,
          steps: [
            ...agentStateRef.current.steps,
            actionStep ?? {
              text: "Unknown action",
              reasoning: "Default action",
              tool: "ACT",
              instruction: "",
              stepNumber: stepNumber++,
            },
          ],
        };

        setUiState((prev) => ({
          ...prev,
          steps: agentStateRef.current.steps,
        }));

        // Handle computer call
        const computerCallResponse = await fetch("/api/cua/step/execute", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            sessionId,
            output: hasComputerCall ?? hasFunctionCall,
          }),
        });

        const computerCallData: (
          | Message
          | FunctionOutput
          | ComputerCallOutput
        )[] = await computerCallResponse.json();

        const nextStepResponse = await fetch("/api/cua/step/generate", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            sessionId,
            input: computerCallData,
            responseId: stepData[0]?.responseId || null,
          }),
        });

        // abort here if generate fails
        if (!nextStepResponse.ok) {
          console.error("API error:", nextStepResponse);
          return;
        }

        const responseData = await nextStepResponse.json();

        // Log error if we got an invalid response
        if (!Array.isArray(responseData)) {
          console.error("API returned non-array data:", responseData);
        }

        // Ensure nextStepData is always an array
        const nextStepData = Array.isArray(responseData) ? responseData : [];

        // Handle reasoning-only responses by adding a message item if needed
        if (
          nextStepData[0]?.output?.length === 1 &&
          nextStepData[0]?.output[0]?.type === "reasoning"
        ) {
          console.log("Detected reasoning-only response, adding message item");
          // Add a message item to ensure the reasoning is followed by another item
          nextStepData[0].output.push({
            id: `msg_fallback_${nextStepData[0]?.responseId || "default"}`,
            type: "message",
            role: "assistant",
            content: [
              {
                type: "output_text",
                text: "I'll continue with the task.",
                annotations: [],
              },
            ],
          });
        }

        currentResponseRef.current = {
          id: nextStepData[0]?.responseId || null,
        };

        // Process the next step recursively - ensure nextStepData is an array first
        if (Array.isArray(nextStepData)) {
          return processStep(nextStepData, sessionId, stepNumber);
        } else {
          console.error("stepData is not an array:", nextStepData);
          // Return gracefully instead of causing an error
          return;
        }
      } else {
        console.log("No message or computer call output");
        console.log("messageItem", messageItem);
        console.log("computerItem", computerItem);
      }
    },
    []
  );

  // Update the handleUserInput function
  const handleUserInput = useCallback(
    async (input: string) => {
      if (!input.trim()) return;

      // Add user message to chat
      const userStep: BrowserStep = {
        text: input,
        reasoning: "User input",
        tool: "MESSAGE",
        instruction: "",
        stepNumber: agentStateRef.current.steps.length + 1,
      };

      agentStateRef.current = {
        ...agentStateRef.current,
        steps: [...agentStateRef.current.steps, userStep],
      };

      setUiState((prev) => ({
        ...prev,
        steps: agentStateRef.current.steps,
      }));

      setIsWaitingForInput(false);

      setUserInput("");

      try {
        // Continue the conversation
        const nextStepResponse = await fetch("/api/cua/step/generate", {
          // Add retry logic for API errors
          signal: AbortSignal.timeout(15000), // 15 second timeout
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            sessionId: agentStateRef.current.sessionId,
            responseId: currentResponseRef.current?.id,
            input: [
              {
                role: "user",
                content: input,
              },
            ],
          }),
        });

        const responseData = await nextStepResponse.json();

        // Ensure nextStepData is always an array
        const nextStepData = Array.isArray(responseData) ? responseData : [];

        // Log error if we got an invalid response
        if (!Array.isArray(responseData)) {
          console.error("API returned non-array data:", responseData);
        }

        // Handle reasoning-only responses by adding a message item if needed
        if (
          nextStepData[0]?.output?.length === 1 &&
          nextStepData[0]?.output[0]?.type === "reasoning"
        ) {
          console.log("Detected reasoning-only response, adding message item");
          // Add a message item to ensure the reasoning is followed by another item
          nextStepData[0].output.push({
            id: `msg_fallback_${nextStepData[0]?.responseId || "default"}`,
            type: "message",
            role: "assistant",
            content: [
              {
                type: "output_text",
                text: "I'll help you with that task.",
                annotations: [],
              },
            ],
          });
        }

        currentResponseRef.current = {
          id: nextStepData[0].responseId,
        };

        const stepNumber = agentStateRef.current.steps.length + 1;

        if (agentStateRef.current.sessionId) {
          // Process the next step recursively
          return processStep(
            nextStepData,
            agentStateRef.current.sessionId,
            stepNumber
          );
        }
      } catch (error) {
        console.error("Error handling user input:", error);

        // Check if this is a reasoning item error
        if (
          error instanceof Error &&
          (error.message.includes("reasoning") ||
            error.message.includes("without its required following item"))
        ) {
          console.log(
            "Handling reasoning item error, retrying with modified request"
          );
          try {
            // Try again with a more specific instruction
            const retryResponse = await fetch("/api/cua/step/generate", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                sessionId: agentStateRef.current.sessionId,
                responseId: currentResponseRef.current?.id,
                input: [
                  {
                    role: "user",
                    content: input + " Please take a specific action.",
                  },
                ],
              }),
            });

            if (!retryResponse.ok) {
              throw new Error(`API error: ${retryResponse.status}`);
            }

            const retryData = await retryResponse.json();

            // If we still have a reasoning-only response, add a message item
            if (
              retryData[0]?.output?.length === 1 &&
              retryData[0]?.output[0]?.type === "reasoning"
            ) {
              console.log(
                "Still got reasoning-only response, adding message item"
              );
              // Add a message item to ensure reasoning is followed by another item
              retryData[0].output.push({
                id: `msg_fallback_${retryData[0]?.responseId || "default"}`,
                type: "message",
                role: "assistant",
                content: [
                  {
                    type: "output_text",
                    text: "I'll help you with that task.",
                    annotations: [],
                  },
                ],
              });
            }

            currentResponseRef.current = {
              id: retryData[0].responseId,
            };

            const stepNumber = agentStateRef.current.steps.length + 1;

            if (agentStateRef.current.sessionId) {
              // Process the retry step
              return processStep(
                retryData,
                agentStateRef.current.sessionId,
                stepNumber
              );
            }
          } catch (retryError) {
            console.error("Error during retry:", retryError);
            // Fall through to the default error handling
          }
        }

        // Default error handling
        const errorStep: BrowserStep = {
          text: "Sorry, there was an error processing your request. Please try again.",
          reasoning: "Error handling user input",
          tool: "MESSAGE",
          instruction: "",
          stepNumber: agentStateRef.current.steps.length + 1,
        };

        agentStateRef.current = {
          ...agentStateRef.current,
          steps: [...agentStateRef.current.steps, errorStep],
        };

        setUiState((prev) => ({
          ...prev,
          steps: agentStateRef.current.steps,
        }));

        setUserInput("");

        setIsWaitingForInput(true);
        return null;
      }
    },
    [processStep]
  );

  // Add currentResponseRef to store the current response
  const currentResponseRef = useRef<{ id: string } | null>(null);

  // Update the initialization function
  useEffect(() => {
    console.log("useEffect called");
    const initializeSession = async () => {
      if (initializationRef.current) return;
      initializationRef.current = true;

      if (initialMessage && !agentStateRef.current.sessionId) {
        setIsLoading(true);
        try {
          let sessionData;
          
          // If we have an existing browserbase session, fetch its details from the agent session
          if (existingBrowserSessionId && existingSessionId) {
            const sessionResponse = await fetch(`/api/sessions/${existingSessionId}`);
            const data = await sessionResponse.json();
            
            if (data.session && data.session.browserSessionId) {
              sessionData = {
                success: true,
                sessionId: data.session.browserSessionId,
                sessionUrl: data.session.browserDebugUrl || null,
                connectUrl: null,
              };
            } else {
              throw new Error("Could not fetch existing session details");
            }
          } else {
            // Create a new session as before
            const sessionResponse = await fetch("/api/session", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
              }),
            });
            sessionData = await sessionResponse.json();
          }

          if (!sessionData.success) {
            throw new Error(sessionData.error || "Failed to create session");
          }

          agentStateRef.current = {
            ...agentStateRef.current,
            sessionId: sessionData.sessionId,
            sessionUrl: sessionData.sessionUrl,
            connectUrl: sessionData.connectUrl,
          };

          setUiState({
            sessionId: sessionData.sessionId,
            sessionUrl: sessionData.sessionUrl,
            connectUrl: sessionData.connectUrl,
            steps: [],
          });

          // Only start a new CUA session if we're not connecting to an existing one
          if (!existingBrowserSessionId) {
            // Start the cua session
            const startResponse = await fetch("/api/cua/start", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                sessionId: sessionData.sessionId,
                userInput: initialMessage,
              }),
            });

            const responseData = await startResponse.json();

            posthog.capture("cua_start", {
              goal: initialMessage,
              sessionId: sessionData.sessionId,
            });

            // Ensure startData is always an array
            const startData = Array.isArray(responseData) ? responseData : [];

            // Log error if we got an invalid response
            if (!Array.isArray(responseData)) {
              console.error(
                "API returned non-array data from /api/cua/start:",
                responseData
              );
            }

            if (startData.length > 0) {
              const stepNumber = 1;

              // Process the first step and continue with subsequent steps
              await processStep(startData, sessionData.sessionId, stepNumber);
            }
          } else {
            // For existing sessions, just connect to view - don't start new actions
            console.log("Connected to existing browserbase session:", sessionData.sessionId);
          }
        } catch (error) {
          console.error("Session initialization error:", error);
        } finally {
          setIsLoading(false);
        }
      }
    };

    initializeSession();
  }, [initialMessage, handleUserInput, processStep, existingBrowserSessionId, existingSessionId]);

  // Spring configuration for smoother animations
  const springConfig = {
    type: "spring",
    stiffness: 350,
    damping: 30,
  };

  const containerVariants = {
    hidden: { opacity: 0, scale: 0.95 },
    visible: {
      opacity: 1,
      scale: 1,
      transition: {
        ...springConfig,
        staggerChildren: 0.1,
      },
    },
    exit: {
      opacity: 0,
      scale: 0.95,
      transition: { duration: 0.2 },
    },
  };

  return (
    <motion.div
      className="flex h-screen relative z-10"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
    >
      <Sidebar activeView="activity" onNavigate={() => {}} />
      
      <div className="flex flex-col" style={{ width: 'calc(100vw - 13.5rem)', marginLeft: '13.5rem' }}>
        <TopBar onClose={onClose} closeButtonText="Back to Agent Details" />
        
        <main
          className="flex-1 flex flex-col items-center sm:p-4 md:p-6 relative overflow-hidden"
          style={{ backgroundColor: "#000000" }}
        >
        <div
          className="absolute inset-0 z-0 overflow-hidden pointer-events-none"
          style={{
            backgroundImage: "url(/grid.svg)",
            backgroundSize: "25%",
            backgroundPosition: "center",
            backgroundRepeat: "repeat",
            opacity: 0.8,
            position: "fixed",
          }}
        ></div>
        <motion.div
          className="w-full max-w-[1600px] bg-black/[0.4] backdrop-blur-xl md:border border-white/[0.08] shadow-2xl rounded-2xl overflow-hidden mx-auto relative z-10"
          style={{ height: isMobile ? "calc(100vh - 56px)" : "calc(100vh - 9rem)" }}
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          <div className="flex flex-col md:flex-row h-full overflow-hidden">
            {/* Main browser area */}
            <div className="w-full md:flex-1 min-w-0 gap-y-2 p-4 md:p-6 md:border-l border-white/[0.08] order-first md:order-last flex flex-col items-center justify-center bg-black/[0.2]">
              {/* Tabs */}
              {!isAgentFinished && uiState.sessionId && (
                <BrowserTabs
                  sessionId={uiState.sessionId}
                  activePage={activePage}
                  setActivePage={setActivePage}
                />
              )}

              {/* Session Controls - Always visible on all screen sizes */}
              {!isAgentFinished && (
                <div className="mt-4 flex justify-center items-center">
                  <SessionControls
                    sessionTime={sessionTime}
                    onStop={() => setIsAgentFinished(true)}
                  />
                </div>
              )}

              <BrowserSessionContainer
                sessionUrl={activePageUrl}
                isVisible={true}
                isCompleted={isAgentFinished}
                initialMessage={initialMessage}
                onRestart={onClose}
              />
            </div>

            {/* Chat sidebar */}
            <div
              className="w-full md:w-[450px] flex-shrink-0 px-4 pb-4 md:p-6 flex flex-col overflow-hidden"
              style={{
                height: isMobile
                  ? "calc(100vh - 300px)"
                  : "calc(100vh - 17rem)",
                position: "relative",
              }}
            >
              <GoalMessage message={initialMessage || ""} isScrolled={isScrolled} />

              <ChatMessagesList
                steps={uiState.steps}
                containerRef={chatContainerRef}
                isMobile={isMobile}
              />

              <ChatInput
                onSubmit={async (input) => {
                  if (["quit", "exit", "bye"].includes(input.toLowerCase())) {
                    setIsAgentFinished(true);
                    return;
                  }
                  await handleUserInput(input);
                }}
                isAgentFinished={isAgentFinished}
                userInput={userInput}
                setUserInput={setUserInput}
                isWaitingForInput={isWaitingForInput}
              />
            </div>
          </div>
        </motion.div>
      </main>
      </div>
    </motion.div>
  );
}
