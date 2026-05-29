export type Project = {
  id: string;
  name: string;
  description: string;
  icon: string;
  sessionCount: number;
  memoryScopeKey: string;
};

export type Session = {
  id: string;
  projectId: string;
  title: string;
  summary: string;
  updatedAt: string;
  messageCount: number;
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  author: string;
  createdAt: string;
  content: string;
  references?: string[];
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
  status: "completed" | "mocked" | "pending";
  detail: string;
  time: string;
};

export type Artifact = {
  id: string;
  name: string;
  kind: string;
  status: string;
};

export type ModelChoice = {
  id: string;
  label: string;
  provider: string;
};

export type WorkspaceMock = {
  activeProjectId: string;
  activeSessionId: string;
  projects: Project[];
  sessions: Session[];
  messages: ChatMessage[];
  memoryEvidence: MemoryEvidence[];
  toolEvents: ToolEvent[];
  artifacts: Artifact[];
  modelChoices: ModelChoice[];
  connectionStatus: {
    hermes: string;
    brainMemory: string;
  };
};
