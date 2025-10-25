// Utility functions to format step data for display

export interface SessionLog {
  stepNumber: number;
  tool: string;
  instruction: string;
  reasoning?: string;
  output?: unknown;
}

export interface FormattedStep {
  stepNumber: number;
  tool: string;
  title: string;
  reasoning: string;
}

/**
 * Formats a session log into a user-friendly step display
 */
export function formatStepForDisplay(log: SessionLog): FormattedStep {
  const tool = log.tool.toUpperCase();
  let title = log.instruction;

  // Format the title based on tool type
  switch (tool) {
    case 'TYPE':
    case 'INPUT':
      title = `Typing text: "${log.instruction}"`;
      break;

    case 'CLICK':
      // Try to extract coordinates if present
      const clickMatch = log.instruction.match(/click\((\d+),\s*(\d+)\)/);
      if (clickMatch) {
        title = `Clicking at position (${clickMatch[1]}, ${clickMatch[2]})`;
      } else {
        title = `Clicking element`;
      }
      break;

    case 'KEYPRESS':
      title = `Pressing keys: ${log.instruction}`;
      break;

    case 'GOTO':
    case 'NAVIGATE':
      const urlMatch = log.instruction.match(/goto\((.*?)\)/);
      if (urlMatch) {
        title = `Navigating to ${urlMatch[1]}`;
      } else {
        title = `Navigating to ${log.instruction}`;
      }
      break;

    case 'SCROLL':
      const scrollMatch = log.instruction.match(/scroll\(([-\d]+),\s*([-\d]+)\)/);
      if (scrollMatch) {
        title = `Scrolling by (${scrollMatch[1]}, ${scrollMatch[2]})`;
      } else {
        title = `Scrolling page`;
      }
      break;

    case 'WAIT':
      title = `Waiting for page to respond`;
      break;

    case 'SCREENSHOT':
      title = `Taking screenshot`;
      break;

    case 'NAVBACK':
    case 'BACK':
      title = `Going back to the previous page`;
      break;

    case 'COMPUTER_USE':
    case 'COMPUTER_USE_PREVIEW':
      // Parse the output field to get the actual action details
      if (log.output && typeof log.output === 'object') {
        const outputObj = log.output as Record<string, unknown>;
        const action = (outputObj.action || outputObj) as Record<string, unknown>;
        const actionType = (action.type as string | undefined)?.toLowerCase();
        
        switch (actionType) {
          case 'click':
            title = `Clicking at position (${action.x || 0}, ${action.y || 0})`;
            break;
          case 'type':
            title = `Typing text: "${action.text || ''}"`;
            break;
          case 'keypress':
          case 'key':
            const keys = Array.isArray(action.keys) ? action.keys.join(', ') : action.text || '';
            title = `Pressing keys: ${keys}`;
            break;
          case 'scroll':
            title = `Scrolling by (${action.scroll_x || 0}, ${action.scroll_y || 0})`;
            break;
          case 'mouse_move':
          case 'move':
            title = `Moving cursor to position (${action.x || 0}, ${action.y || 0})`;
            break;
          case 'screenshot':
            title = 'Taking screenshot';
            break;
          case 'double_click':
            title = `Double-clicking at position (${action.x || 0}, ${action.y || 0})`;
            break;
          case 'drag':
            const path = action.path as Array<{ x?: number; y?: number }> | undefined;
            const startX = path?.[0]?.x ?? (action.x as number | undefined) ?? 0;
            const startY = path?.[0]?.y ?? (action.y as number | undefined) ?? 0;
            const endX = path?.[path.length - 1]?.x ?? (action.x as number | undefined) ?? 0;
            const endY = path?.[path.length - 1]?.y ?? (action.y as number | undefined) ?? 0;
            title = `Dragging from (${startX}, ${startY}) to (${endX}, ${endY})`;
            break;
          default:
            title = log.instruction || 'Computer action executed';
        }
      } else {
        title = log.instruction || 'Computer action executed';
      }
      break;

    case 'FUNCTION_CALL_OUTPUT':
      title = `Action: ${log.instruction}`;
      break;

    case 'MESSAGE':
      title = log.instruction;
      break;

    default:
      title = log.instruction;
  }

  return {
    stepNumber: log.stepNumber,
    tool,
    title,
    reasoning: log.reasoning || 'Executing action as part of the task workflow.',
  };
}

/**
 * Generate detailed reasoning for an action (similar to ChatFeed implementation)
 */
export function generateDetailedReasoning(
  action: Record<string, unknown>,
  actionType: string,
  goal?: string
): string {
  switch (actionType.toLowerCase()) {
    case 'click':
      if (goal) {
        return `Clicking to begin searching for information about ${goal}. This interaction initiates the search process.`;
      }
      return `Clicking to interact with the page interface. This helps navigate through the content to find the requested information.`;

    case 'type':
    case 'input':
      if (goal) {
        return `Entering detailed information to provide input needed for this search. This text will help narrow down the results to find the specific information requested.`;
      }
      return `Typing to provide input needed for this search. This text will help narrow down the results to find the specific information requested.`;

    case 'keypress':
      const keys = Array.isArray(action.keys) ? action.keys.join(', ') : (action.instruction as string || '');
      if (typeof keys === 'string' && keys.includes('ENTER')) {
        return `Submitting the search query to find information about ${goal || 'the requested topic'}. This will execute the search and retrieve relevant results.`;
      }
      return `Using keyboard input to efficiently interact with the page. This keyboard interaction helps streamline the navigation process.`;

    case 'scroll':
      return `Scrolling to view additional content that might contain the requested information about ${goal || 'the topic'}. Scrolling allows examining more search results or content.`;

    case 'goto':
    case 'navigate':
      return `Navigating to find information about ${goal || 'the requested topic'}. This website likely contains relevant data or search capabilities needed.`;

    case 'back':
    case 'navback':
      return `Going back to return to previous content. This helps with navigation when the current page doesn't contain the needed information.`;

    case 'wait':
      return `Waiting for page to respond while the page loads the requested information. This ensures all content is properly displayed before proceeding.`;

    case 'screenshot':
      return `Taking a screenshot to capture the visual information displayed. This preserves the current state of the information for reference.`;

    case 'computer_use':
    case 'computer_use_preview':
      return `Executing computer action to progress in the task. This action is part of the automated workflow.`;

    default:
      return `Executing ${actionType} action to progress in finding information about ${goal || 'the requested topic'}. This action is part of the process to retrieve the relevant data.`;
  }
}
