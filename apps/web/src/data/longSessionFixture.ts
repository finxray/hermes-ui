import type {
  Artifact,
  ChatMessage,
  ModelChoice,
  PersistedActivityEvent,
  Project,
  RunRecord,
  Session,
  ToolEvent,
  WorkspaceState
} from "@/data/types";
import type { AgentActivityEvent } from "@/types/agentActivity";

export const LONG_SESSION_PROJECT_COUNT = 5;
export const LONG_SESSION_SESSIONS_PER_PROJECT = 20;
export const LONG_SESSION_MESSAGE_COUNT = 120;
export const LONG_SESSION_ACTIVITY_EVENT_COUNT = 80;
export const LONG_SESSION_RUN_RECORD_COUNT = 24;

const tenantId = "local-dev";
const baseTimestampMs = Date.parse("2026-05-31T10:00:00.000Z");

function iso(minutesAgo: number) {
  return new Date(baseTimestampMs - minutesAgo * 60_000).toISOString();
}

function projectStableKey(projectId: string) {
  return `studio:${tenantId}:project:${projectId}`;
}

function sessionStableKey(projectId: string, sessionId: string) {
  return `studio:${tenantId}:project:${projectId}:session:${sessionId}`;
}

function makeProject(index: number): Project {
  const id = `long-session-project-${index + 1}`;
  const stableKey = projectStableKey(id);
  return {
    createdAt: iso(600 + index),
    description:
      index === 0
        ? "Deterministic long-session fixture project for UI measurement only."
        : `Secondary fixture project ${index + 1} for sidebar density measurement.`,
    icon: `L${index + 1}`,
    id,
    memoryScope: {
      contextPolicy: "balanced",
      pinnedMemoryIds: index === 0 ? ["fixture-memory-001"] : [],
      projectId: id,
      retrievalProfile: "balanced",
      stableProjectKey: stableKey,
      tenantId,
      userVisibleSummary: `Fixture project ${index + 1} context stays static and Gateway-free.`
    },
    memoryScopeKey: stableKey,
    name: index === 0 ? "Long Session Fixture" : `Fixture Project ${index + 1}`,
    updatedAt: iso(index)
  };
}

function markdownAssistantContent(index: number) {
  const phase = (index % 6) + 1;
  return [
    `## Measurement checkpoint ${index}`,
    "",
    `This assistant response is deterministic fixture content for long-session rendering pass ${phase}. It includes markdown, bounded code, and a short table without invoking live services.`,
    "",
    "| Surface | Current state | Measurement note |",
    "| --- | --- | --- |",
    `| Transcript | Full render | Message ${index} remains visible in the DOM |`,
    `| Right rail | Bounded slices | Details stay collapsed until opened |`,
    "",
    "```ts",
    `export const checkpoint${index} = {`,
    `  messageIndex: ${index},`,
    `  scope: "studio:${tenantId}:project:long-session-project-1",`,
    `  note: "Fixture code block should scroll inside the message, not widen the page."`,
    "};",
    "```",
    "",
    "- Keep browser-to-BFF boundaries intact.",
    "- Do not infer live service success from this fixture.",
    "- Measure before changing loading behavior."
  ].join("\n");
}

function userContent(index: number) {
  return `Fixture prompt ${index}: review the current long-session rendering posture for project scope studio:${tenantId}:project:long-session-project-1 without calling live services.`;
}

export const longSessionMessages: ChatMessage[] = Array.from(
  { length: LONG_SESSION_MESSAGE_COUNT },
  (_, index) => {
    const oneBased = index + 1;
    const isUser = index % 2 === 0;
    return {
      author: isUser ? "You" : "Hermes",
      content: isUser ? userContent(oneBased) : markdownAssistantContent(oneBased),
      createdAt: iso(LONG_SESSION_MESSAGE_COUNT - index),
      id: `long-message-${String(oneBased).padStart(3, "0")}`,
      references: isUser ? undefined : ["long-session fixture", "performance plan"],
      role: isUser ? "user" : "assistant",
      status: "complete"
    };
  }
);

export const longSessionMemoryEvidence = Array.from({ length: 16 }, (_, index) => ({
  excerpt:
    "Static memory evidence fixture. This is local display data only and does not prove Gateway reachability.",
  id: `fixture-memory-${String(index + 1).padStart(3, "0")}`,
  layer: index % 2 === 0 ? "semantic" : "canonical",
  score: (0.93 - index * 0.01).toFixed(2),
  source: index % 3 === 0 ? "mock-gateway-preview" : "fixture",
  timestamp: iso(index + 8),
  title: `Long-session evidence ${index + 1}`
}));

export const longSessionToolEvents: ToolEvent[] = Array.from({ length: 20 }, (_, index) => ({
  detail: `Legacy tool event fixture ${index + 1}; retained to verify compatibility rendering stays bounded.`,
  id: `fixture-tool-${String(index + 1).padStart(3, "0")}`,
  name: index % 2 === 0 ? "fixture_tool_read" : "fixture_tool_plan",
  status: index % 7 === 0 ? "mocked" : "completed",
  time: iso(index + 2)
}));

export const longSessionArtifacts: Artifact[] = Array.from({ length: 18 }, (_, index) => ({
  createdAt: iso(index + 40),
  id: `fixture-artifact-${String(index + 1).padStart(3, "0")}`,
  kind: index % 3 === 0 ? "document" : index % 3 === 1 ? "report" : "log",
  mimeType: index % 3 === 2 ? "text/plain" : "text/markdown",
  path: `docs/fixture/long-session-artifact-${String(index + 1).padStart(2, "0")}.md`,
  projectId: "long-session-project-1",
  sessionId: "long-session-project-1-session-1",
  sizeBytes: 12_000 + index * 733,
  source: "mock",
  status: index % 8 === 0 ? "pending" : "available",
  summary: "Static artifact metadata for the Files tab. Preview/download stays unavailable.",
  title: `Fixture artifact ${index + 1}`,
  updatedAt: iso(index + 4)
}));

function makeReplayEvent(runIndex: number, eventIndex: number): PersistedActivityEvent {
  const type = eventIndex % 4 === 0 ? "command" : eventIndex % 4 === 1 ? "memory" : eventIndex % 4 === 2 ? "tool" : "status";
  const id = `fixture-run-${runIndex + 1}-replay-${eventIndex + 1}`;
  return {
    collapsedByDefault: true,
    command:
      type === "command"
        ? {
            commandPreview: `npm run fixture-check -- --run=${runIndex + 1}`,
            cwd: "C:\\Users\\Alexey\\.cursor\\projects\\hermes-ui",
            exitCode: 0,
            outputPreview: "Fixture output preview is intentionally short and bounded.",
            sourceChannel: "web-ui",
            truncated: false
          }
        : undefined,
    completedAt: iso(runIndex + eventIndex),
    detailsPreview: `Persisted replay fixture detail ${eventIndex + 1} for run ${runIndex + 1}.`,
    durationMs: 500 + eventIndex * 120,
    id,
    memory:
      type === "memory"
        ? {
            memoryId: `fixture-memory-${String(eventIndex + 1).padStart(3, "0")}`,
            operation: "search",
            projectKey: projectStableKey("long-session-project-1"),
            scopeStatus: "matching-session",
            sessionKey: sessionStableKey("long-session-project-1", "long-session-project-1-session-1")
          }
        : undefined,
    runId: `fixture-run-${String(runIndex + 1).padStart(3, "0")}`,
    source: type === "memory" ? "brain-memory" : "ui",
    sourceChannel: "web-ui",
    startedAt: iso(runIndex + eventIndex + 1),
    status: "completed",
    summary: `Replay summary ${eventIndex + 1}`,
    title: `${type} replay ${eventIndex + 1}`,
    type
  };
}

export const longSessionRunRecords: RunRecord[] = Array.from(
  { length: LONG_SESSION_RUN_RECORD_COUNT },
  (_, index) => {
    const replay = Array.from({ length: 10 }, (_, eventIndex) => makeReplayEvent(index, eventIndex));
    return {
      activityEventIds: Array.from({ length: 8 }, (_, eventIndex) => `fixture-activity-${index}-${eventIndex}`),
      activityReplay: replay,
      activitySummary: {
        approvalCount: index % 5 === 0 ? 1 : 0,
        commandCount: 2,
        errorCount: index % 13 === 0 ? 1 : 0,
        memoryCount: 3,
        toolCount: 4
      },
      completedAt: iso(index),
      durationMs: 3_500 + index * 250,
      hermesRunId: `hermes-fixture-run-${index + 1}`,
      hermesSessionId: "hermes-long-session-project-1-session-1",
      id: `fixture-run-${String(index + 1).padStart(3, "0")}`,
      modelLabel: "Server-configured fixture model",
      projectId: "long-session-project-1",
      providerLabel: "Hermes fixture",
      sessionId: "long-session-project-1-session-1",
      sourceChannel: "web-ui",
      startedAt: iso(index + 1),
      status: index % 13 === 0 ? "failed" : "completed",
      summary: `Fixture run ${index + 1}`
    };
  }
);

function makeSession(project: Project, sessionIndex: number): Session {
  const id = `${project.id}-session-${sessionIndex + 1}`;
  const isActiveFixture = project.id === "long-session-project-1" && sessionIndex === 0;
  return {
    artifacts: isActiveFixture ? longSessionArtifacts : [],
    createdAt: iso(500 + sessionIndex),
    hermesSessionId: `hermes-${id}`,
    id,
    memoryEvidence: isActiveFixture ? longSessionMemoryEvidence : [],
    memoryScope: {
      includeProjectContext: true,
      includeSessionContext: true,
      projectId: project.id,
      sessionId: id,
      stableSessionKey: sessionStableKey(project.id, id),
      tenantId,
      userVisibleSummary: isActiveFixture
        ? "This active fixture session intentionally contains 120 messages and bounded local metadata."
        : "Static sidebar fixture session."
    },
    messages: isActiveFixture ? longSessionMessages : [],
    projectId: project.id,
    runRecords: isActiveFixture ? longSessionRunRecords : [],
    summary: isActiveFixture
      ? "Long-session fixture with 120 messages, static memory evidence, run history, artifacts, and activity."
      : `Sidebar density fixture session ${sessionIndex + 1}.`,
    title: isActiveFixture
      ? "120-message checkpoint transcript"
      : `Fixture chat ${String(sessionIndex + 1).padStart(2, "0")}`,
    titleSource: "mock",
    toolEvents: isActiveFixture ? longSessionToolEvents : [],
    updatedAt: iso(sessionIndex)
  };
}

export const longSessionProjects = Array.from(
  { length: LONG_SESSION_PROJECT_COUNT },
  (_, index) => makeProject(index)
);

export const longSessionSessions = longSessionProjects.flatMap((project) =>
  Array.from({ length: LONG_SESSION_SESSIONS_PER_PROJECT }, (_, index) =>
    makeSession(project, index)
  )
);

export const longSessionActiveProject = longSessionProjects[0];
export const longSessionActiveSession = longSessionSessions.find(
  (session) => session.id === "long-session-project-1-session-1"
) as Session;

export const longSessionActivityEvents: AgentActivityEvent[] = Array.from(
  { length: LONG_SESSION_ACTIVITY_EVENT_COUNT },
  (_, index) => {
    const eventNumber = index + 1;
    const type = index % 5 === 0 ? "command" : index % 5 === 1 ? "memory" : index % 5 === 2 ? "tool" : index % 5 === 3 ? "status" : "elapsed";
    return {
      collapsedByDefault: true,
      command:
        type === "command"
          ? {
              command: `npm run fixture:${eventNumber}`,
              cwd: "C:\\Users\\Alexey\\.cursor\\projects\\hermes-ui",
              durationMs: 800 + index * 20,
              exitCode: 0,
              outputPreview: "Bounded fixture command output preview.",
              sourceChannel: "web-ui",
              truncated: false
            }
          : undefined,
      completedAt: iso(index),
      details: {
        detail: `Static long-session activity event ${eventNumber}`,
        fixture: true
      },
      durationMs: 800 + index * 20,
      hermes: {
        eventType: `fixture.${type}`,
        runId: `fixture-run-${String((index % LONG_SESSION_RUN_RECORD_COUNT) + 1).padStart(3, "0")}`,
        sessionId: "hermes-long-session-project-1-session-1",
        toolCallId: type === "tool" || type === "command" ? `fixture-tool-call-${eventNumber}` : undefined,
        toolName: type === "memory" ? "mcp_brain_memory_search" : "fixture_tool"
      },
      id: `fixture-activity-${String(eventNumber).padStart(3, "0")}`,
      memory:
        type === "memory"
          ? {
              memoryId: `fixture-memory-${String(eventNumber).padStart(3, "0")}`,
              operation: "search",
              projectKey: projectStableKey("long-session-project-1"),
              scopeStatus: "matching-session",
              sessionKey: sessionStableKey("long-session-project-1", "long-session-project-1-session-1")
            }
          : undefined,
      metadata: {
        fixture: "long-session-performance",
        sequence: eventNumber
      },
      source: type === "memory" ? "brain-memory" : "ui",
      startedAt: iso(index + 1),
      status: eventNumber % 17 === 0 ? "failed" : "completed",
      summary: `Activity fixture summary ${eventNumber}`,
      title: `${type} fixture ${eventNumber}`,
      type
    };
  }
);

export const longSessionModelChoices: ModelChoice[] = [
  {
    id: "hermes-agent",
    label: "Hermes Agent",
    provider: "Hermes"
  }
];

export const longSessionWorkspaceState: WorkspaceState = {
  activeProjectId: longSessionActiveProject.id,
  activeSessionId: longSessionActiveSession.id,
  connectionStatus: {
    brainMemory: "fixture",
    hermes: "fixture"
  },
  modelChoices: longSessionModelChoices,
  projects: longSessionProjects,
  sessions: longSessionSessions
};
