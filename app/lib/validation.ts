import { z } from 'zod';

const optionalSafeString = (fieldName: string, maxLength: number = 5000) =>
  z.string()
    .max(maxLength, `${fieldName} must be less than ${maxLength} characters`)
    .refine(
      (val) => !/<script[\s\S]*?>[\s\S]*?<\/script>/i.test(val),
      `${fieldName} contains potentially malicious content (script tags)`
    )
    .refine(
      (val) => !/javascript:/i.test(val),
      `${fieldName} contains potentially malicious content (javascript: protocol)`
    )
    .refine(
      (val) => !/on\w+\s*=/i.test(val),
      `${fieldName} contains potentially malicious content (event handlers)`
    )
    .optional();

// Custom validation for targetWebsite - accepts both full URLs and domain names
const targetWebsiteSchema = z.string()
  .max(500, 'Target website must be less than 500 characters')
  .refine(
    (val) => !val || val === '' || (/^([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}$/.test(val) || isValidUrl(val)),
    'Must be a valid URL or domain name'
  )
  .refine(
    (val) => !/<script[\s\S]*?>[\s\S]*?<\/script>/i.test(val),
    'Target website contains potentially malicious content (script tags)'
  )
  .refine(
    (val) => !/javascript:/i.test(val),
    'Target website contains potentially malicious content (javascript: protocol)'
  )
  .refine(
    (val) => !/on\w+\s*=/i.test(val),
    'Target website contains potentially malicious content (event handlers)'
  )
  .optional()
  .or(z.literal(''));

function isValidUrl(str: string): boolean {
  try {
    new URL(str);
    return true;
  } catch {
    return false;
  }
}

// Agent schemas
export const createAgentSchema = z.object({
  name: z.string().min(1, 'Agent name is required').max(100),
  description: optionalSafeString('Description', 1000),
  systemPrompt: z.string().min(10, 'System prompt must be at least 10 characters').max(5000),
  targetWebsite: targetWebsiteSchema,
  userExpectations: optionalSafeString('User expectations', 2000),
  knowledgeBase: optionalSafeString('Knowledge base', 10000),
  authCredentials: z.record(z.unknown()).optional(),
  isDeployed: z.boolean().optional(),
  schedule: z.enum(['daily', 'weekly', 'monthly', 'custom']).optional(),
  customSchedule: optionalSafeString('Custom schedule', 500),
});

export const updateAgentSchema = createAgentSchema.partial();

// Task schemas
export const createTaskSchema = z.object({
  taskDescription: z.string().min(10, 'Task description must be at least 10 characters').max(1000),
  taskType: z.enum(['research', 'data_entry', 'monitoring', 'automation', 'communication', 'other']),
  priority: z.number().int().min(1).max(5).optional().default(3),
  frequency: z.enum(['daily', 'weekly', 'monthly', 'once']).optional().default('once'),
  taskDetails: z.record(z.unknown()).optional(),
});

// Context schemas
export const createContextSchema = z.object({
  contextKey: z.string().min(1).max(100),
  contextValue: z.unknown(),
});

// Session schemas
export const createSessionSchema = z.object({
  timezone: z.string().optional(),
  projectId: z.string().optional(),
});

// CUA schemas  
export const cuaStartSchema = z.object({
  url: z.string().url('Must be a valid URL'),
  task: z.string().min(10, 'Task must be at least 10 characters').max(1000),
  timezone: z.string().optional(),
});

export const cuaStepSchema = z.object({
  sessionId: z.string().min(1, 'Session ID is required'),
  step: z.object({
    action: z.string(),
    selector: z.string().optional(),
    value: z.string().optional(),
    reasoning: z.string().optional(),
  }),
});

// Planner agent schema
export const plannerAgentSchema = z.object({
  messages: z.array(z.object({
    role: z.enum(['system', 'user', 'assistant']),
    content: z.string().max(5000),
  })).optional(),
  initialTask: z.string().max(5000).optional(),
  currentConfig: z.record(z.unknown()).optional(),
});

// Validation helper function
export function validateRequest<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; error: string } {
  try {
    const validated = schema.parse(data);
    return { success: true, data: validated };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessages = error.errors.map((err) => `${err.path.join('.')}: ${err.message}`).join(', ');
      return { success: false, error: errorMessages };
    }
    return { success: false, error: 'Invalid request data' };
  }
}
