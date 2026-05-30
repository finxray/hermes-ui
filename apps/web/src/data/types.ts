export type ContextPolicy =
  | "balanced"
  | "project-first"
  | "session-first"
  | "minimal";

export type RetrievalProfile = "balanced" | "precise" | "broad" | "minimal";

export type ProjectMemoryScope = {
  tenantId: string;
  projectId: string;
  stableProjectKey: string;
  retrievalProfile: RetrievalProfile;
  pinnedMemoryIds: string[];
  contextPolicy: ContextPolicy;
  userVisibleSummary?: string;
};

export type SessionMemoryScope = {
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
  memoryScopeKey: string;
  memoryScope: ProjectMemoryScope;
  createdAt: string;
  updatedAt: string;
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  author: string;
  createdAt: string;
  content: string;
  references?: string[];
  status?: "complete" | "streaming" | "error" | "mock";
};

export type MemoryEvidence = {
  id: string;
  title: string;
  layer: string;
  score: string;
  excerpt: string;
  source: string;
  timestamp: string;
};

export type ToolEvent = {
  id: string;
  name: string;
  status: "started" | "completed" | "failed" | "mocked" | "pending";
  detail: string;
  time: string;
};

export type Artifact = {
  id: string;
  name: string;
  kind: string;
  status: string;
};

export type Session = {
  id: string;
  projectId: string;
  hermesSessionId: string;
  title: string;
  titleSource?: "default" | "first-message" | "manual" | "mock";
  firstUserMessageAt?: string;
  renamedAt?: string;
  summary: string;
  memoryScope: SessionMemoryScope;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
  messages: ChatMessage[];
  memoryEvidence: MemoryEvidence[];
  toolEvents: ToolEvent[];
  artifacts: Artifact[];
};

export type ModelChoice = {
  id: string;
  label: string;
  provider: string;
};

export type WorkspaceState = {
  activeProjectId: string;
  activeSessionId: string | null;
  projects: Project[];
  sessions: Session[];
  modelChoices: ModelChoice[];
  connectionStatus: {
    hermes: string;
    brainMemory: string;
  };
};

export type PersistedWorkspaceState = WorkspaceState & {
  version: number;
};
