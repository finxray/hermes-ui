import type {
  Artifact,
  ChatMessage,
  MemoryEvidence,
  ModelChoice,
  Project,
  Session,
  ToolEvent,
  WorkspaceState
} from "./types";

const createdAt = "2026-05-29T09:00:00.000Z";
const updatedAt = "2026-05-29T09:18:00.000Z";
const tenantId = "tenant-local";

function projectScope(
  projectId: string,
  summary: string,
  retrievalProfile: Project["memoryScope"]["retrievalProfile"] = "balanced",
  contextPolicy: Project["memoryScope"]["contextPolicy"] = "balanced",
  pinnedMemoryIds: string[] = []
): Project["memoryScope"] {
  return {
    tenantId,
    projectId,
    stableProjectKey: `studio:${tenantId}:project:${projectId}`,
    retrievalProfile,
    pinnedMemoryIds,
    contextPolicy,
    userVisibleSummary: summary
  };
}

function sessionScope(
  projectId: string,
  sessionId: string,
  summary: string,
  includeProjectContext = true,
  includeSessionContext = true
): Session["memoryScope"] {
  return {
    tenantId,
    projectId,
    sessionId,
    stableSessionKey: `studio:${tenantId}:project:${projectId}:session:${sessionId}`,
    includeProjectContext,
    includeSessionContext,
    lastContextRefreshAt: "2026-05-29T09:15:00.000Z",
    userVisibleSummary: summary
  };
}

export const projects: Project[] = [
  {
    id: "project-brain-memory",
    name: "brain-memory",
    description: "Gateway-scoped persistent memory and UI console",
    icon: "BM",
    memoryScopeKey: "studio:tenant-local:project:project-brain-memory",
    memoryScope: projectScope(
      "project-brain-memory",
      "Use canonical architecture and Gateway contract notes before session-local chat history.",
      "balanced",
      "project-first",
      ["memory-adr", "memory-scope"]
    ),
    createdAt,
    updatedAt
  },
  {
    id: "project-hermes-agent",
    name: "hermes-ui",
    description: "API server, runs, approvals, and tool events",
    icon: "HA",
    memoryScopeKey: "studio:tenant-local:project:project-hermes-agent",
    memoryScope: projectScope(
      "project-hermes-agent",
      "Prefer Hermes API discovery, run events, and session continuity facts.",
      "precise",
      "session-first",
      ["memory-adr"]
    ),
    createdAt,
    updatedAt: "2026-05-28T12:00:00.000Z"
  },
  {
    id: "project-packaging",
    name: "projects",
    description: "Local desktop, Docker, and release workflow",
    icon: "PK",
    memoryScopeKey: "studio:tenant-local:project:project-packaging",
    memoryScope: projectScope(
      "project-packaging",
      "Keep setup, environment, and release packaging context scoped away from agent-runtime design.",
      "broad",
      "balanced"
    ),
    createdAt,
    updatedAt: "2026-05-25T12:00:00.000Z"
  },
  {
    id: "project-integrations",
    name: "integrations  brain-memory",
    description: "External service wiring and optional Brain Memory attach mode",
    icon: "IN",
    memoryScopeKey: "studio:tenant-local:project:project-integrations",
    memoryScope: projectScope(
      "project-integrations",
      "Integration context should stay provider-neutral and keep optional services decoupled.",
      "balanced",
      "minimal"
    ),
    createdAt,
    updatedAt: "2026-05-24T12:00:00.000Z"
  }
];

const roadmapMessages: ChatMessage[] = [
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

const gatewayMessages: ChatMessage[] = [
  {
    id: "msg-contract-1",
    role: "user",
    author: "Alexey",
    createdAt: "12:41",
    content: "What should the Brain Memory Gateway expose to the UI first?"
  },
  {
    id: "msg-contract-2",
    role: "assistant",
    author: "Hermes UI mock",
    createdAt: "12:42",
    content:
      "Start read-only: project/session lists, memory search, memory detail, evidence, supersession chain, and audit. Admin actions should stay behind explicit Gateway policy in a later slice.",
    references: ["Gateway endpoint proposal", "Read-only console"]
  }
];

const evidenceMessages: ChatMessage[] = [
  {
    id: "msg-evidence-1",
    role: "assistant",
    author: "Hermes UI mock",
    createdAt: "11:18",
    content:
      "Evidence cards should show source, layer, score, timestamp, and a short excerpt. The user needs to see why memory was retrieved without seeing raw storage internals.",
    references: ["Memory evidence", "Audit visibility"]
  }
];

const runsMessages: ChatMessage[] = [
  {
    id: "msg-runs-1",
    role: "assistant",
    author: "Hermes UI mock",
    createdAt: "10:04",
    content:
      "The Runs API is the best future fit for long-lived work because it can expose pollable status, structured events, approvals, and stop support.",
    references: ["/v1/runs", "run events", "stop"]
  }
];

const approvalMessages: ChatMessage[] = [
  {
    id: "msg-approval-1",
    role: "assistant",
    author: "Hermes UI mock",
    createdAt: "09:31",
    content:
      "Approval UI should stay capability-gated until Hermes is connected. The shell can reserve panel space, but it must not pretend approvals are live.",
    references: ["approval.request", "approval.responded"]
  }
];

const packageMessages: ChatMessage[] = [
  {
    id: "msg-package-1",
    role: "assistant",
    author: "Hermes UI mock",
    createdAt: "08:45",
    content:
      "Packaging can come later with Docker Compose, env examples, health checks, and local setup docs. Slice 02 should stay browser-local.",
    references: ["Slice 09", "local package"]
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

export const sessions: Session[] = [
  {
    id: "session-roadmap",
    projectId: "project-brain-memory",
    hermesSessionId: "hermes-session-roadmap",
    title: "Add memory detail and evidence",
    summary: "Slice planning for the Studio shell and future integration path",
    memoryScope: sessionScope(
      "project-brain-memory",
      "session-roadmap",
      "Roadmap discussion should include Brain Memory project policy plus this session's slice history."
    ),
    createdAt,
    updatedAt,
    messages: roadmapMessages,
    memoryEvidence,
    toolEvents,
    artifacts
  },
  {
    id: "session-memory-contract",
    projectId: "project-brain-memory",
    hermesSessionId: "hermes-session-memory-contract",
    title: "Add read-only UI API",
    summary: "Read-only search, evidence, supersession, and audit endpoints",
    memoryScope: sessionScope(
      "project-brain-memory",
      "session-memory-contract",
      "Gateway contract work should prioritize read-only memory visibility and audited future mutations."
    ),
    createdAt,
    updatedAt: "2026-05-28T10:00:00.000Z",
    messages: gatewayMessages,
    memoryEvidence: memoryEvidence.slice(0, 2),
    toolEvents: toolEvents.slice(1),
    artifacts: artifacts.slice(0, 2)
  },
  {
    id: "session-evidence-ui",
    projectId: "project-brain-memory",
    hermesSessionId: "hermes-session-evidence-ui",
    title: "Check crash status",
    summary: "Memory console display rules and trust markers",
    memoryScope: sessionScope(
      "project-brain-memory",
      "session-evidence-ui",
      "Evidence UI work should focus on traceability, source layers, and user trust markers."
    ),
    createdAt,
    updatedAt: "2026-05-27T11:00:00.000Z",
    messages: evidenceMessages,
    memoryEvidence: memoryEvidence.slice(1),
    toolEvents: toolEvents.slice(2),
    artifacts: artifacts.slice(1)
  },
  {
    id: "session-runs-api",
    projectId: "project-hermes-agent",
    hermesSessionId: "hermes-session-runs-api",
    title: "Polish Codex-style UI",
    summary: "Mapping run lifecycle events into a future tool panel",
    memoryScope: sessionScope(
      "project-hermes-agent",
      "session-runs-api",
      "Runs API context should emphasize lifecycle events, reconnect, stop, and approvals."
    ),
    createdAt,
    updatedAt: "2026-05-28T12:00:00.000Z",
    messages: runsMessages,
    memoryEvidence: memoryEvidence.slice(0, 1),
    toolEvents,
    artifacts
  },
  {
    id: "session-approval-flow",
    projectId: "project-hermes-agent",
    hermesSessionId: "hermes-session-approval-flow",
    title: "Initialize Hermes UI repo",
    summary: "Mocking approval controls without wiring real Hermes calls",
    memoryScope: sessionScope(
      "project-hermes-agent",
      "session-approval-flow",
      "Approval UX should remain capability-gated until Hermes event payloads are verified.",
      true,
      true
    ),
    createdAt,
    updatedAt: "2026-05-26T12:00:00.000Z",
    messages: approvalMessages,
    memoryEvidence: memoryEvidence.slice(0, 1),
    toolEvents: toolEvents.slice(1),
    artifacts: artifacts.slice(0, 1)
  },
  {
    id: "session-desktop-package",
    projectId: "project-packaging",
    hermesSessionId: "hermes-session-desktop-package",
    title: "Remove OpenClaw files",
    summary: "Install, run, and health-check expectations",
    memoryScope: sessionScope(
      "project-packaging",
      "session-desktop-package",
      "Packaging session context should stay focused on setup scripts, env docs, and health checks.",
      true,
      false
    ),
    createdAt,
    updatedAt: "2026-05-25T12:00:00.000Z",
    messages: packageMessages,
    memoryEvidence: memoryEvidence.slice(2),
    toolEvents: toolEvents.slice(1),
    artifacts: artifacts.slice(2)
  },
  {
    id: "session-audit-hermes-integration",
    projectId: "project-packaging",
    hermesSessionId: "hermes-session-audit-hermes-integration",
    title: "Audit Hermes integration",
    summary: "Review Hermes API status, streaming, and BFF boundaries",
    memoryScope: sessionScope(
      "project-packaging",
      "session-audit-hermes-integration",
      "Audit context should focus on Hermes BFF behavior and endpoint compatibility.",
      true,
      false
    ),
    createdAt,
    updatedAt: "2026-05-24T15:00:00.000Z",
    messages: runsMessages,
    memoryEvidence: memoryEvidence.slice(0, 1),
    toolEvents,
    artifacts: artifacts.slice(0, 2)
  },
  {
    id: "session-integrate-brain-memory",
    projectId: "project-brain-memory",
    hermesSessionId: "hermes-session-integrate-brain-memory",
    title: "Integrate Brain Memory with Hermes",
    summary: "Scope bridge and MCP write propagation",
    memoryScope: sessionScope(
      "project-brain-memory",
      "session-integrate-brain-memory",
      "Brain Memory integration work should preserve UI -> Hermes -> MCP -> Gateway flow."
    ),
    createdAt,
    updatedAt: "2026-05-26T09:00:00.000Z",
    messages: gatewayMessages,
    memoryEvidence: memoryEvidence.slice(0, 2),
    toolEvents,
    artifacts: artifacts.slice(0, 2)
  },
  {
    id: "session-config-parse-error",
    projectId: "project-brain-memory",
    hermesSessionId: "hermes-session-config-parse-error",
    title: "Fix config parse error",
    summary: "Local runtime config parsing and diagnostics",
    memoryScope: sessionScope(
      "project-brain-memory",
      "session-config-parse-error",
      "Config repair context should stay scoped to local diagnostics and startup checks."
    ),
    createdAt,
    updatedAt: "2026-05-25T09:00:00.000Z",
    messages: evidenceMessages,
    memoryEvidence: memoryEvidence.slice(1),
    toolEvents: toolEvents.slice(1),
    artifacts: artifacts.slice(1)
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

export const workspaceMock: WorkspaceState = {
  activeProjectId: "project-brain-memory",
  activeSessionId: "session-roadmap",
  projects,
  sessions,
  modelChoices,
  connectionStatus: {
    hermes: "Disconnected / mock",
    brainMemory: "Disconnected / mock"
  }
};
