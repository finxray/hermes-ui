export type AgentActivityType =
  | "reasoning"
  | "command"
  | "tool"
  | "memory"
  | "file"
  | "approval"
  | "error"
  | "elapsed"
  | "status"
  | "stream";

export type AgentActivityStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "cancelled"
  | "waiting_for_approval"
  | "info";

export type AgentActivitySource = "hermes" | "brain-memory" | "ui" | "mcp" | "unknown";

export type AgentActivityEvent = {
  id: string;
  type: AgentActivityType;
  status: AgentActivityStatus;
  title: string;
  summary?: string;
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
  collapsedByDefault: boolean;
  details?: unknown;
  source: AgentActivitySource;
  hermes?: {
    sessionId?: string;
    runId?: string;
    eventType?: string;
    messageId?: string;
    toolName?: string;
    toolCallId?: string;
  };
  memory?: {
    memoryId?: string;
    operation?: string;
    projectKey?: string;
    sessionKey?: string;
    scopeStatus?: string;
  };
  artifact?: {
    fileId?: string;
    path?: string;
    kind?: string;
  };
  metadata?: Record<string, unknown>;
};
