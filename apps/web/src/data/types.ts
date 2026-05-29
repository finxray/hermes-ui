export type Project = {
  id: string;
  name: string;
  description: string;
  icon: string;
  memoryScopeKey: string;
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
  title: string;
  summary: string;
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
