export type ContextPolicy =
  | "balanced"
  | "project-first"
  | "session-first"
  | "minimal";

export type RetrievalProfile = "balanced" | "precise" | "broad" | "minimal";

export type ProjectContextScope = {
  tenantId: string;
  projectId: string;
  stableProjectKey: string;
  retrievalProfile: RetrievalProfile;
  contextPolicy: ContextPolicy;
  userVisibleSummary?: string;
};

export type SessionContextScope = {
  tenantId: string;
  projectId: string;
  sessionId: string;
  stableSessionKey: string;
  includeProjectContext: boolean;
  includeSessionContext: boolean;
  lastContextRefreshAt?: string;
  userVisibleSummary?: string;
};

export type Project = {
  id: string;
  name: string;
  description: string;
  icon: string;
  contextScopeKey: string;
  contextScope: ProjectContextScope;
  createdAt: string;
  updatedAt: string;
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  author: string;
  attachments?: ChatAttachment[];
  createdAt: string;
  content: string;
  references?: string[];
  status?: "complete" | "streaming" | "error" | "mock";
  usage?: ChatUsageMetadata;
};

export type ChatAttachmentKind =
  | "image"
  | "pdf"
  | "text"
  | "spreadsheet"
  | "presentation"
  | "document"
  | "archive"
  | "code"
  | "unknown";

export type ChatAttachment = {
  id: string;
  storageId?: string;
  contentHash?: string;
  fileName: string;
  kind: ChatAttachmentKind;
  mimeType: string;
  previewUrl?: string;
  downloadUrl?: string;
  sizeBytes: number;
  source: "local";
  status:
    | "ready"
    | "uploading"
    | "upload-error"
    | "needs-upload"
    | "too-large"
    | "unsupported"
    | "unavailable";
};

export type ChatUsageMetadata = {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  cachedTokens?: number;
  reasoningTokens?: number;
  costUsd?: number;
  provider?: string;
  model?: string;
  upstreamModel?: string;
  generationId?: string;
  finishReason?: string;
  latencyMs?: number;
  requestId?: string;
  requestedModel?: string;
  requestedProvider?: string;
  routeMismatch?: boolean;
  routeVerified?: boolean;
  source?: "provider" | "hermes_usage" | "estimated" | "unavailable";
  timeToFirstTokenMs?: number;
  tokensPerSecond?: number;
};

export type ToolEvent = {
  id: string;
  name: string;
  status: "started" | "completed" | "failed" | "mocked" | "pending";
  detail: string;
  time: string;
};

export type RunRecordStatus = "running" | "completed" | "stopped" | "failed" | "cancelled";

export type RunRecordSourceChannel = "web-ui" | "telegram" | "cli" | "api" | "unknown";

export type RunActivitySummary = {
  toolCount: number;
  memoryCount: number;
  commandCount: number;
  approvalCount: number;
  errorCount: number;
};

export type PersistedActivityEvent = {
  id: string;
  runId: string;
  type:
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
  status:
    | "queued"
    | "running"
    | "completed"
    | "failed"
    | "cancelled"
    | "waiting_for_approval"
    | "info";
  title: string;
  summary?: string;
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
  collapsedByDefault: boolean;
  source: "hermes" | "ui" | "mcp" | "unknown";
  sourceChannel: RunRecordSourceChannel;
  hermes?: {
    sessionId?: string;
    runId?: string;
    eventType?: string;
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
  command?: {
    commandPreview?: string;
    cwd?: string;
    exitCode?: number;
    stdoutPreview?: string;
    stderrPreview?: string;
    outputPreview?: string;
    truncated?: boolean;
    sourceChannel?: RunRecordSourceChannel;
  };
  approval?: {
    approvalId?: string;
    decision?: string;
    requestedAction?: string;
    riskLevel?: string;
  };
  artifact?: {
    fileId?: string;
    path?: string;
    kind?: string;
  };
  detailsPreview?: string;
  metadata?: Record<string, unknown>;
};

export type RunRecord = {
  id: string;
  projectId: string;
  sessionId: string;
  hermesSessionId: string;
  hermesRunId?: string;
  userMessageId?: string;
  assistantMessageId?: string;
  sourceChannel: RunRecordSourceChannel;
  status: RunRecordStatus;
  startedAt: string;
  completedAt?: string;
  durationMs?: number;
  stoppedByUser?: boolean;
  modelLabel?: string;
  providerLabel?: string;
  summary?: string;
  metadata?: Record<string, unknown>;
  activityEventIds: string[];
  activitySummary: RunActivitySummary;
  activityReplay: PersistedActivityEvent[];
};

export type StudioArtifactKind =
  | "architecture"
  | "code"
  | "contract"
  | "data"
  | "design"
  | "document"
  | "image"
  | "log"
  | "report"
  | "unknown";

export type StudioArtifactSource =
  | "hermes"
  | "mcp"
  | "ui"
  | "local"
  | "mock";

export type StudioArtifactStatus =
  | "available"
  | "pending"
  | "unavailable"
  | "error";

export type StudioArtifact = {
  id: string;
  projectId: string;
  sessionId?: string;
  title: string;
  kind: StudioArtifactKind;
  source: StudioArtifactSource;
  status: StudioArtifactStatus;
  path?: string;
  mimeType?: string;
  sizeBytes?: number;
  createdAt?: string;
  updatedAt?: string;
  summary?: string;
  activityEventId?: string;
  metadata?: Record<string, unknown>;
};

export type Artifact = StudioArtifact;

export type Session = {
  id: string;
  projectId: string;
  hermesSessionId: string;
  title: string;
  titleSource?: "default" | "first-message" | "model" | "manual" | "mock";
  titleGenerationRequestedAt?: string;
  titleGeneratedAt?: string;
  firstUserMessageAt?: string;
  renamedAt?: string;
  summary: string;
  contextScope: SessionContextScope;
  createdAt: string;
  updatedAt: string;
  lastViewedAt?: string;
  archivedAt?: string;
  messages: ChatMessage[];
  toolEvents: ToolEvent[];
  runRecords: RunRecord[];
  artifacts: Artifact[];
  modelPreference?: SessionModelPreference;
  channel?: SessionChannel;
};

export type SessionChannel = {
  source: string;
  label: string;
  external: boolean;
  lastActiveAt?: string;
  parentSessionId?: string;
};

export type ModelChoice = {
  id: string;
  label: string;
  provider: string;
};

export type SessionModelPreference = {
  catalogModelId: string;
  catalogSource?: "hermes-config" | "ui-lmstudio" | "ui-openrouter";
  label?: string;
  provider: string | null;
  selectedAt: string;
  selectionScope?: "session" | "turn";
  selectModelId: string;
};

export type WorkspaceState = {
  activeProjectId: string;
  activeSessionId: string | null;
  projects: Project[];
  sessions: Session[];
  modelChoices: ModelChoice[];
  connectionStatus: {
    hermes: string;
  };
};

export type PersistedWorkspaceState = WorkspaceState & {
  version: number;
};
