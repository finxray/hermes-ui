import type {
  Artifact,
  ChatMessage,
  MemoryEvidence,
  ModelChoice,
  Project,
  Session,
  ToolEvent,
  WorkspaceMock
} from "./types";

export const projects: Project[] = [
  {
    id: "project-brain-memory",
    name: "Brain Memory",
    description: "Gateway-scoped persistent memory and UI console",
    icon: "BM",
    sessionCount: 3,
    memoryScopeKey: "studio:tenant-local:project-brain-memory"
  },
  {
    id: "project-hermes-agent",
    name: "Hermes Agent",
    description: "API server, runs, approvals, and tool events",
    icon: "HA",
    sessionCount: 2,
    memoryScopeKey: "studio:tenant-local:project-hermes-agent"
  },
  {
    id: "project-packaging",
    name: "Packaging",
    description: "Local desktop, Docker, and release workflow",
    icon: "PK",
    sessionCount: 1,
    memoryScopeKey: "studio:tenant-local:project-packaging"
  }
];

export const sessions: Session[] = [
  {
    id: "session-roadmap",
    projectId: "project-brain-memory",
    title: "Hermes UI roadmap",
    summary: "Slice planning for the Studio shell and future integration path",
    updatedAt: "Today 13:18",
    messageCount: 12
  },
  {
    id: "session-memory-contract",
    projectId: "project-brain-memory",
    title: "Gateway memory contract",
    summary: "Read-only search, evidence, supersession, and audit endpoints",
    updatedAt: "Yesterday",
    messageCount: 9
  },
  {
    id: "session-evidence-ui",
    projectId: "project-brain-memory",
    title: "Evidence cards and audit trail",
    summary: "Memory console display rules and trust markers",
    updatedAt: "May 27",
    messageCount: 7
  },
  {
    id: "session-runs-api",
    projectId: "project-hermes-agent",
    title: "Runs API event model",
    summary: "Mapping run lifecycle events into a future tool panel",
    updatedAt: "May 28",
    messageCount: 8
  },
  {
    id: "session-approval-flow",
    projectId: "project-hermes-agent",
    title: "Approval and stop UX",
    summary: "Mocking approval controls without wiring real Hermes calls",
    updatedAt: "May 26",
    messageCount: 5
  },
  {
    id: "session-desktop-package",
    projectId: "project-packaging",
    title: "Downloadable local package",
    summary: "Install, run, and health-check expectations",
    updatedAt: "May 25",
    messageCount: 6
  }
];

export const messages: ChatMessage[] = [
  {
    id: "msg-1",
    role: "user",
    author: "Alexey",
    createdAt: "13:04",
    content:
      "For Slice 01, make the product surface feel like a real ChatGPT-style workspace, but keep everything mocked and do not touch Hermes or Brain Memory yet."
  },
  {
    id: "msg-2",
    role: "assistant",
    author: "Hermes UI mock",
    createdAt: "13:05",
    content:
      "I will keep this slice focused on the visual shell: project navigation, session history, a central chat workspace, and a read-only memory/context panel. The mocked context says Brain Memory must stay behind Gateway-approved endpoints, so the UI will only show planned scope metadata and evidence cards.",
    references: ["ADR-0001", "Brain Memory UI endpoints", "OpenAI dark brief"]
  },
  {
    id: "msg-3",
    role: "user",
    author: "Alexey",
    createdAt: "13:07",
    content:
      "The active project should be Brain Memory and the active session should be Hermes UI roadmap. Show disconnected mock statuses clearly."
  },
  {
    id: "msg-4",
    role: "assistant",
    author: "Hermes UI mock",
    createdAt: "13:08",
    content:
      "Done in the static model: Brain Memory is selected, Hermes UI roadmap is active, and both Hermes plus Brain Memory Gateway are labeled as disconnected mock connections. Future slices can replace these labels with BFF-backed health checks without changing the shell layout.",
    references: ["Mock status", "Slice 03 health plan"]
  }
];

export const memoryEvidence: MemoryEvidence[] = [
  {
    id: "memory-adr",
    title: "BFF boundary is mandatory",
    layer: "canonical",
    score: "0.94",
    excerpt:
      "Browser code should call the Web UI BFF. The BFF attaches credentials and forwards to Hermes or Brain Memory Gateway.",
    source: "ADR-0001",
    timestamp: "2026-05-29"
  },
  {
    id: "memory-scope",
    title: "Project memory scope",
    layer: "semantic",
    score: "0.89",
    excerpt:
      "Brain Memory project context should map to a stable session key such as studio:tenant:project.",
    source: "Hermes discovery",
    timestamp: "2026-05-29"
  },
  {
    id: "memory-streaming",
    title: "Fast stream guardrail",
    layer: "curated",
    score: "0.86",
    excerpt:
      "Future Cerebras/Kimi-style streams must batch deltas instead of calling React state setters per token.",
    source: "Performance note",
    timestamp: "2026-05-29"
  }
];

export const toolEvents: ToolEvent[] = [
  {
    id: "tool-docs",
    name: "read_docs",
    status: "completed",
    detail: "Loaded Slice 00 architecture and design direction",
    time: "13:02"
  },
  {
    id: "tool-plan",
    name: "compose_shell",
    status: "mocked",
    detail: "Static layout only; no network or agent runtime",
    time: "13:06"
  },
  {
    id: "tool-memory",
    name: "memory.search",
    status: "mocked",
    detail: "Would retrieve Gateway-approved evidence in Slice 06",
    time: "13:08"
  }
];

export const artifacts: Artifact[] = [
  {
    id: "artifact-adr",
    name: "ADR-0001 stack and integration",
    kind: "Architecture",
    status: "source note"
  },
  {
    id: "artifact-contract",
    name: "Brain Memory UI endpoint proposal",
    kind: "Contract",
    status: "draft"
  },
  {
    id: "artifact-brief",
    name: "OpenAI dark UI brief",
    kind: "Design",
    status: "active"
  }
];

export const modelChoices: ModelChoice[] = [
  {
    id: "hermes-default",
    label: "Hermes default",
    provider: "Mock"
  },
  {
    id: "openai-compatible",
    label: "OpenAI-compatible",
    provider: "Placeholder"
  },
  {
    id: "cerebras-kimi",
    label: "Cerebras / Kimi K2.6",
    provider: "Future fast mode"
  }
];

export const workspaceMock: WorkspaceMock = {
  activeProjectId: "project-brain-memory",
  activeSessionId: "session-roadmap",
  projects,
  sessions,
  messages,
  memoryEvidence,
  toolEvents,
  artifacts,
  modelChoices,
  connectionStatus: {
    hermes: "Disconnected / mock",
    brainMemory: "Disconnected / mock"
  }
};
