# Stagehand Integration Guide

## Overview

Stagehand is now integrated into your Browserbase CUA (Computer-Use-Agent) system, providing AI-powered browser automation capabilities alongside your existing Playwright-based actions.

## What is Stagehand?

Stagehand is a browser automation framework that combines AI with code to control browsers using natural language. It provides four powerful primitives:

1. **Act** - Execute actions using natural language (e.g., "click the login button")
2. **Extract** - Pull structured data with Zod schemas
3. **Observe** - Discover available actions on any page
4. **Agent** - Automate entire workflows autonomously

## Architecture

### Dual-Mode Operation

Your system now supports **two modes** of browser automation:

1. **Traditional Playwright Mode** (existing)
   - Low-level coordinate-based actions (click at x,y coordinates)
   - Direct DOM manipulation
   - Full control over browser
   - Uses `BrowserbaseBrowser` class

2. **Stagehand AI Mode** (new)
   - Natural language actions ("click the submit button")
   - AI-powered element detection
   - Self-healing automations that adapt to UI changes
   - Uses `StagehandBrowser` class

### How They Work Together

Both modes use the same Browserbase infrastructure:
- Same session management
- Same context persistence (cookies, fingerprinting)
- Same authentication flows
- Can even share sessions between modes

## Usage Examples

### 1. Using Stagehand Act (Natural Language Actions)

```typescript
import { StagehandBrowser } from '@/app/api/cua/agent/stagehand';

const stagehand = new StagehandBrowser();
await stagehand.init();

// Navigate to a page
await stagehand.goto('https://example.com/login');

// Perform actions with natural language
await stagehand.act('click the login button');
await stagehand.act({
  action: 'enter %username% in the email field',
  variables: {
    username: 'user@example.com'
  }
});
await stagehand.act('click submit');
```

### 2. Using Stagehand Extract (Data Extraction)

```typescript
import { z } from 'zod';

// Extract structured data with a schema
const products = await stagehand.extract({
  instruction: 'extract all product listings',
  schema: z.object({
    products: z.array(z.object({
      name: z.string(),
      price: z.string(),
      rating: z.number()
    }))
  })
});

console.log(products.products); // Fully typed!

// Or extract with just a prompt
const result = await stagehand.extract('what is the main headline?');
console.log(result.extraction);
```

### 3. Using Stagehand Observe (Element Discovery)

```typescript
// Discover all available actions on a page
const actions = await stagehand.observe('find all buttons');

// Each action includes:
// - selector: xpath or CSS selector
// - description: what the element does
// - method: click, type, etc.
// - arguments: any required args

// You can then act on observed elements
if (actions.length > 0) {
  await stagehand.act(actions[0]); // No LLM call needed!
}
```

### 4. Using Stagehand Agent (Autonomous Workflows)

```typescript
// Let the agent handle an entire workflow
const result = await stagehand.runAgent(
  'Find the product with the best price-to-rating ratio and add it to cart'
);

console.log(result);
```

## API Route Example

Test the integration using the example API route:

### Example 1: Act (Natural Language Action)
```bash
POST /api/cua/stagehand-example
Content-Type: application/json

{
  "action": "act",
  "url": "https://example.com",
  "instruction": "click the first link"
}
```

### Example 2: Extract with Predefined Schema
```bash
POST /api/cua/stagehand-example
Content-Type: application/json

{
  "action": "extract",
  "url": "https://example.com",
  "instruction": "extract page information",
  "schemaType": "page_info"
}
```

Available predefined schema types:
- `products` - Extract product listings (name, price, rating)
- `page_info` - Extract page metadata (title, description, links)
- `contact_info` - Extract contact details (email, phone, address)

### Example 3: Extract with Natural Language (No Schema)
```bash
POST /api/cua/stagehand-example
Content-Type: application/json

{
  "action": "extract",
  "url": "https://example.com",
  "instruction": "what is the main headline?"
}
```

### Example 4: Session Reuse
```bash
POST /api/cua/stagehand-example
Content-Type: application/json

{
  "action": "act",
  "sessionId": "sess_xxx_from_previous_request",
  "instruction": "click the next link"
}
```

Response:
```json
{
  "success": true,
  "sessionId": "sess_xxx",
  "sessionUrl": "https://www.browserbase.com/sessions/sess_xxx",
  "debugUrl": "https://www.browserbase.com/devtools/inspector.html?wss=...",
  "result": { ... },
  "screenshot": "base64_image_data"
}
```

## When to Use Which Mode?

### Use Traditional Playwright Mode When:
- You need pixel-perfect precision (OCR, visual testing)
- You have exact coordinates
- You want maximum speed (no LLM calls)
- You're working with canvas/WebGL elements

### Use Stagehand AI Mode When:
- UI layouts change frequently
- You want self-healing automations
- You need to extract structured data
- You want natural language workflows
- You're building autonomous agents

## Best Practices

### 1. Start with Observe
```typescript
// Plan your actions first
const buttons = await stagehand.observe('find login buttons');
console.log(buttons); // Validate before acting

// Then execute
await stagehand.act(buttons[0]);
```

### 2. Use Variables for Sensitive Data
```typescript
// Never hardcode passwords
await stagehand.act({
  action: 'enter %password% in the password field',
  variables: {
    password: process.env.USER_PASSWORD
  }
});
```

### 3. Cache Observed Actions
```typescript
const actionCache = new Map();

const getCachedAction = async (instruction: string) => {
  if (actionCache.has(instruction)) {
    return actionCache.get(instruction);
  }
  const [action] = await stagehand.observe(instruction);
  actionCache.set(instruction, action);
  return action;
};

// Reuse cached actions - no LLM calls!
const loginAction = await getCachedAction('click login');
await stagehand.act(loginAction);
```

### 4. Session Sharing Between Modes
```typescript
import { BrowserbaseBrowser } from '@/app/api/cua/agent/browserbase';
import { StagehandBrowser } from '@/app/api/cua/agent/stagehand';

// Create a Stagehand session first
const stagehand = new StagehandBrowser();
const initResult = await stagehand.init();
const sessionId = stagehand.getSessionId();

console.log(`Session ID: ${sessionId}`);
console.log(`Watch live: ${initResult.sessionUrl}`);

// Perform AI-powered actions
await stagehand.act('navigate to the login page');
await stagehand.act('click the email field');

// You can now reuse this session in another Stagehand instance
const stagehand2 = new StagehandBrowser(sessionId);
await stagehand2.init(); // Reconnects to existing session
await stagehand2.act('type my@email.com');
```

## Environment Variables

Make sure these are set:

```bash
# Required for Browserbase
BROWSERBASE_API_KEY=your_api_key
BROWSERBASE_PROJECT_ID=your_project_id

# Required for Stagehand AI features
OPENAI_API_KEY=your_openai_key
```

## Advanced Features

### Custom Models
```typescript
const stagehand = new StagehandBrowser(
  null, // sessionId
  true, // enableCaching
  'gpt-4o-mini', // faster/cheaper model
  process.env.OPENAI_API_KEY
);
```

### Timeouts and Retries
```typescript
await stagehand.act({
  action: 'click the submit button',
  timeoutMs: 30000, // 30 second timeout
  domSettleTimeoutMs: 5000 // wait 5s for DOM to settle
});
```

### Working with iFrames
```typescript
await stagehand.act({
  action: 'click the button in the payment iframe',
  iframes: true // Enable iframe search
});
```

## Troubleshooting

### "Element not found"
- Use `observe()` first to check if element exists
- Increase `domSettleTimeoutMs` for dynamic content
- Check if element is in an iframe (set `iframes: true`)

### "Method not supported"
- Use `observe()` to validate the action
- Check [Stagehand evals](https://stagehand.dev/evals) for model compatibility
- Try a more specific instruction

### Performance Issues
- Cache observed actions when possible
- Use `gpt-4o-mini` for faster/cheaper operations
- Break large extractions into smaller chunks

## Resources

- [Stagehand Documentation](https://docs.stagehand.dev)
- [Stagehand GitHub](https://github.com/browserbase/stagehand)
- [Browserbase Docs](https://docs.browserbase.com)
- [Your CUA Implementation](./app/api/cua/agent)

## Next Steps

1. Try the example API route: `/api/cua/stagehand-example`
2. Integrate Stagehand into your agent workflows
3. Combine with existing Playwright actions for best of both worlds
4. Build self-healing automations that adapt to UI changes
