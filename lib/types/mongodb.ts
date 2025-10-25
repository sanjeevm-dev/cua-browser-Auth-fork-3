// MongoDB types for client components (serialized DTOs)

export interface Agent {
  id: string;
  name: string;
  description: string | null;
  systemPrompt: string;
  executionPrompt: string | null;
  targetWebsite: string | null;
  authCredentials: unknown;
  knowledgeBase: string | null;
  userExpectations: string | null;
  runtimePerDay: number | null;
  executionMode: 'one-shot' | 'multi-step';
  isDeployed: boolean | null;
  createdAt: string;  // Serialized as string from API
  updatedAt: string;  // Serialized as string from API
}

export interface AgentSession {
  id: string;
  agentId: string;
  browserSessionId: string | null;
  status: string;
  startedAt: string;  // Serialized as string from API
  completedAt: string | null;
  summary: string | null;
  totalSteps: number | null;
  errorMessage: string | null;
}

export interface AgentTask {
  id: string;
  agentId: string;
  taskDescription: string;
  taskType: string;
  priority: number;
  status: string;
  frequency: string;
  result: Record<string, unknown> | null;
  scheduledFor: string | null;
  completedAt: string | null;
  createdAt: string;  // Serialized as string from API
  updatedAt: string;  // Serialized as string from API
}

export interface AgentContext {
  id: string;
  agentId: string;
  contextKey: string;
  contextValue: unknown;
  createdAt: string;  // Serialized as string from API
}

export interface SessionLog {
  id: string;
  sessionId: string;
  stepNumber: number;
  tool: string | null;
  instruction: string | null;
  reasoning: string | null;
  output: unknown;
  screenshotUrl?: string | null;  // Optional screenshot URL
  createdAt: string;  // Serialized as string from API
}

export interface AgentWithRelations extends Agent {
  sessions?: AgentSession[];
  context?: AgentContext[];
  tasks?: AgentTask[];
}

export interface AgentWithSessions extends Agent {
  recentSessions?: AgentSession[];
  runningStatus?: "idle" | "running" | "paused";
}

export type NotificationTypeKey = 
  | 'task_completed'
  | 'task_failed'
  | 'agent_deployed'
  | 'agent_paused'
  | 'credits_low'
  | 'credits_exhausted'
  | 'daily_digest'
  | 'system_maintenance';

export type NotificationCategory = 'agent' | 'credits' | 'results' | 'system';
export type NotificationStatus = 'unread' | 'read';
export type NotificationPriority = 'critical' | 'warning' | 'info';

export interface UserNotification {
  id: string;
  userId: string;
  typeKey: NotificationTypeKey;
  category: NotificationCategory;
  title: string;
  body: string;
  icon: string;
  status: NotificationStatus;
  priority: NotificationPriority;
  metadata?: {
    agentId?: string;
    agentName?: string;
    sessionId?: string;
    creditBalance?: number;
    errorMessage?: string;
    [key: string]: unknown;
  };
  createdAt: string;
  readAt?: string | null;
  expiresAt?: string | null;
}
