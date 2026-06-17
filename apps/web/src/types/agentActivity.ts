export type AgentActivityType =
  | "narration"
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
  approval?: {
    approvalId?: string;
    action?: string;
    choices?: string[];
    decision?: string;
    prompt?: string;
    reason?: string;
    respondedAt?: string;
    riskLevel?: string;
    actionAvailable: boolean;
    unavailableReason?: string;
  };
  command?: {
    command?: string;
    args?: string[];
    cwd?: string;
    exitCode?: number;
    durationMs?: number;
    stdoutPreview?: string;
    stderrPreview?: string;
    outputPreview?: string;
    sourceChannel?: "web-ui" | "telegram" | "cli" | "api" | "unknown";
    toolName?: string;
    truncated?: boolean;
  };
  artifact?: {
    artifactId?: string;
    fileId?: string;
    title?: string;
    path?: string;
    kind?: string;
    action?: string;
    source?: AgentActivitySource;
    status?: AgentActivityStatus;
    mimeType?: string;
    sizeBytes?: number;
  };
  metadata?: Record<string, unknown>;
};
