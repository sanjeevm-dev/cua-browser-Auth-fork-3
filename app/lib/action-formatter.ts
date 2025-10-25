/**
 * Transform technical browser automation actions into user-friendly descriptions
 */

export interface BrowserAction {
  tool?: string;
  type?: string;
  url?: string;
  text?: string;
  coordinate?: number[];
  x?: number;
  y?: number;
  keys?: string[];
  scroll_x?: number;
  scroll_y?: number;
  [key: string]: unknown;
}

/**
 * Convert raw action data into user-friendly text
 */
export function formatActionText(action: BrowserAction): string {
  const tool = action.tool || action.type;
  
  switch (tool) {
    case 'screenshot':
      return 'Taking a screenshot to analyze the current page';
    
    case 'goto':
    case 'navigate':
      const url = action.url as string || 'the webpage';
      // Extract domain for cleaner display
      try {
        const urlObj = new URL(url);
        return `Navigating to ${urlObj.hostname}${urlObj.pathname !== '/' ? urlObj.pathname : ''}`;
      } catch {
        return `Navigating to ${url}`;
      }
    
    case 'click':
    case 'mouse_click':
      if (action.text) {
        return `Clicking on "${action.text}" button`;
      }
      if (action.x !== undefined && action.y !== undefined) {
        return `Clicking on an element at position (${action.x}, ${action.y})`;
      }
      if (action.coordinate) {
        return `Clicking on an element on the page`;
      }
      return 'Clicking on a page element';
    
    case 'type':
    case 'keyboard_type':
      const text = (action.text as string) || '';
      // Don't expose sensitive data like passwords
      const lowerText = text.toLowerCase();
      if (lowerText.includes('password') || lowerText.includes('secret') || lowerText.includes('token')) {
        return 'Typing secure credentials';
      }
      if (text.length > 0 && text.length < 100) {
        return `Typing "${text}" into a field`;
      }
      if (text.length > 0) {
        return `Typing text into a field (${text.length} characters)`;
      }
      return 'Typing text into a field';
    
    case 'key':
    case 'keyboard_key':
      const keys = (action.keys as string[]) || [];
      const keyText = (action.text as string) || keys.join('+');
      return `Pressing ${keyText} key${keys.length > 1 ? 's' : ''}`;
    
    case 'scroll':
    case 'mouse_scroll':
      const scrollX = action.scroll_x || 0;
      const scrollY = action.scroll_y || 0;
      if (scrollY > 0) {
        return 'Scrolling down the page';
      } else if (scrollY < 0) {
        return 'Scrolling up the page';
      } else if (scrollX !== 0) {
        return 'Scrolling horizontally';
      }
      return 'Scrolling the page';
    
    case 'wait':
      return 'Waiting for the page to load';
    
    case 'extract':
    case 'read':
      return 'Reading and analyzing page content';
    
    case 'fill':
    case 'fill_form':
      return 'Filling out a form with information';
    
    case 'hover':
    case 'mouse_move':
      return 'Moving cursor to an element';
    
    default:
      // For unknown tools, try to infer from the action data
      if (action.url) {
        return `Navigating to ${action.url}`;
      }
      if (action.text) {
        return `Performing action: ${action.text}`;
      }
      return 'Performing a page action';
  }
}

/**
 * Convert tool name into user-friendly badge text
 */
export function formatToolBadge(tool: string | null | undefined): string {
  if (!tool || tool === 'UNKNOWN') {
    return 'ACTION';
  }
  
  switch (tool.toLowerCase()) {
    case 'screenshot':
      return 'SCREENSHOT';
    case 'goto':
    case 'navigate':
      return 'NAVIGATE';
    case 'click':
    case 'mouse_click':
      return 'CLICK';
    case 'type':
    case 'keyboard_type':
      return 'TYPE';
    case 'key':
    case 'keyboard_key':
      return 'KEYPRESS';
    case 'scroll':
    case 'mouse_scroll':
      return 'SCROLL';
    case 'wait':
      return 'WAIT';
    case 'extract':
    case 'read':
      return 'READ';
    case 'fill':
    case 'fill_form':
      return 'FORM';
    case 'message':
      return 'MESSAGE';
    default:
      return tool.toUpperCase().replace('_', ' ');
  }
}

/**
 * Clean up reasoning text to remove technical jargon
 */
export function formatReasoning(reasoning: string | null | undefined): string {
  if (!reasoning) {
    return '';
  }
  
  // Remove "Executing UNKNOWN action" and similar phrases
  const cleaned = reasoning
    .replace(/Executing UNKNOWN action/gi, 'Taking action')
    .replace(/Executing .* action/gi, 'Processing')
    .replace(/to progress in finding information about/gi, 'to find information about')
    .replace(/This action is part of the process to retrieve the relevant data/gi, 'Gathering the necessary information')
    .replace(/\{.*?\}/g, '') // Remove JSON objects
    .replace(/\[.*?\]/g, '') // Remove arrays
    .trim();
  
  return cleaned;
}

/**
 * Format a complete session log entry
 */
export function formatSessionLog(log: {
  tool: string | null;
  instruction: string | null;
  reasoning: string | null;
  output?: unknown;
}): {
  formattedTool: string;
  formattedText: string;
  formattedReasoning: string;
} {
  let action: BrowserAction = {};
  
  // Parse instruction if it's a JSON string
  if (log.instruction) {
    try {
      action = JSON.parse(log.instruction);
    } catch {
      // If not JSON, treat as plain text
      action = { text: log.instruction };
    }
  }
  
  // Use output if instruction is not available
  if (!log.instruction && log.output) {
    action = log.output as BrowserAction;
  }
  
  return {
    formattedTool: formatToolBadge(log.tool),
    formattedText: formatActionText(action),
    formattedReasoning: formatReasoning(log.reasoning),
  };
}
