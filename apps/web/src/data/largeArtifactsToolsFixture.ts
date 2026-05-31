import type { AgentActivityEvent, AgentActivityStatus, AgentActivityType } from "@/types/agentActivity";
import type { Artifact, ModelChoice, Project, Session, ToolEvent, WorkspaceState } from "@/data/types";

export const LARGE_ARTIFACTS_COUNT = 500;
export const LARGE_LEGACY_TOOL_EVENT_COUNT = 500;
export const LARGE_ACTIVITY_EVENT_COUNT = 500;

const tenantId = "local-dev";
const projectId = "large-artifacts-tools-project";
const sessionId = "large-artifacts-tools-session";
const baseTimestampMs = Date.parse("2026-05-31T14:00:00.000Z");

const artifactKinds: Artifact["kind"][] = ["document", "code", "log", "report", "data", "unknown"];
const artifactStatuses: Artifact["status"][] = ["available", "pending", "unavailable", "error"];
const toolStatuses: ToolEvent["status"][] = ["completed", "started", "failed", "mocked", "pending"];
const activityTypes: AgentActivityType[] = ["command", "memory", "tool", "error", "status"];

function iso(minutesAgo: number) {
  return new Date(baseTimestampMs - minutesAgo * 60_000).toISOString();
}

function projectStableKey(value: string) {
  return `studio:${tenantId}:project:${value}`;
}

function sessionStableKey(value: string) {
  return `${projectStableKey(projectId)}:session:${value}`;
}

export const largeArtifactsToolsProject: Project = {
  createdAt: iso(2_000),
  description: "Static local fixture for large Files and Tools panel measurement.",
  icon: "AT",
  id: projectId,
  memoryScope: {
    contextPolicy: "balanced",
    pinnedMemoryIds: [],
    projectId,
    retrievalProfile: "balanced",
    stableProjectKey: projectStableKey(projectId),
    tenantId,
    userVisibleSummary: "Large artifacts/tools fixture context. No live services are called."
  },
  memoryScopeKey: projectStableKey(projectId),
  name: "Artifacts Tools Fixture",
  updatedAt: iso(0)
};

export const largeArtifacts: Artifact[] = Array.from({ length: LARGE_ARTIFACTS_COUNT }, (_, index) => {
  const oneBased = index + 1;
  const kind = artifactKinds[index % artifactKinds.length];
  return {
    activityEventId: `large-activity-${String(oneBased).padStart(3, "0")}`,
    createdAt: iso(1_500 + index),
    id: `large-artifact-${String(oneBased).padStart(3, "0")}`,
    kind,
    metadata: {
      fixture: "large-artifacts-tools",
      index: oneBased,
      preview: `bounded metadata preview ${oneBased}`,
      sourceChannel: index % 4 === 0 ? "web-ui" : "fixture"
    },
    mimeType: kind === "code" ? "text/typescript" : kind === "data" ? "application/json" : "text/plain",
    path: `artifacts/large-fixture/${kind}/artifact-${String(oneBased).padStart(3, "0")}.${extensionForKind(kind)}`,
    projectId,
    sessionId,
    sizeBytes: 4_096 + index * 317,
    source: index % 5 === 0 ? "ui" : "mock",
    status: artifactStatuses[index % artifactStatuses.length],
    summary: `Bounded local artifact summary ${oneBased}. Preview and download remain unavailable in this fixture.`,
    title: `${kind === "document" ? "file" : kind} artifact ${String(oneBased).padStart(3, "0")}`,
    updatedAt: iso(index)
  };
});

export const largeLegacyToolEvents: ToolEvent[] = Array.from(
  { length: LARGE_LEGACY_TOOL_EVENT_COUNT },
  (_, index) => {
    const oneBased = index + 1;
    return {
      detail: `Legacy tool event ${oneBased}: bounded display row for the Tools tab measurement.`,
      id: `large-legacy-tool-${String(oneBased).padStart(3, "0")}`,
      name: index % 3 === 0 ? "fixture_file_scan" : index % 3 === 1 ? "fixture_tool_plan" : "fixture_log_read",
      status: toolStatuses[index % toolStatuses.length],
      time: iso(index)
    };
  }
);

export const largeActivityEvents: AgentActivityEvent[] = Array.from(
  { length: LARGE_ACTIVITY_EVENT_COUNT },
  (_, index) => makeActivityEvent(index)
);

export const largeArtifactsToolsSession: Session = {
  artifacts: largeArtifacts,
  createdAt: iso(1_800),
  hermesSessionId: `hermes-${sessionId}`,
  id: sessionId,
  memoryEvidence: [],
  memoryScope: {
    includeProjectContext: true,
    includeSessionContext: true,
    projectId,
    sessionId,
    stableSessionKey: sessionStableKey(sessionId),
    tenantId,
    userVisibleSummary: "Large local artifacts/tools measurement session."
  },
  messages: [],
  projectId,
  runRecords: [],
  summary: "Static local fixture with 500 artifacts, 500 legacy tool rows, and 500 activity events.",
  title: "Large artifacts/tools measurement",
  titleSource: "mock",
  toolEvents: largeLegacyToolEvents,
  updatedAt: iso(0)
};

export const largeArtifactsToolsModelChoices: ModelChoice[] = [
  {
    id: "hermes-agent",
    label: "Hermes Agent",
    provider: "Hermes"
  }
];

export const largeArtifactsToolsWorkspaceState: WorkspaceState = {
  activeProjectId: largeArtifactsToolsProject.id,
  activeSessionId: largeArtifactsToolsSession.id,
  connectionStatus: {
    brainMemory: "fixture",
    hermes: "fixture"
  },
  modelChoices: largeArtifactsToolsModelChoices,
  projects: [largeArtifactsToolsProject],
  sessions: [largeArtifactsToolsSession]
};

function makeActivityEvent(index: number): AgentActivityEvent {
  const oneBased = index + 1;
  const type = activityTypes[index % activityTypes.length];
  const status = statusForActivity(type, index);
  const base = {
    collapsedByDefault: true,
    completedAt: status === "running" ? undefined : iso(index),
    durationMs: 300 + index * 7,
    hermes: {
      eventType: `fixture.${type}`,
      runId: `large-fixture-run-${String(Math.floor(index / 10) + 1).padStart(3, "0")}`,
      sessionId: `hermes-${sessionId}`,
      toolCallId: `large-fixture-tool-call-${String(oneBased).padStart(3, "0")}`,
      toolName: type === "command" ? "run_command" : type === "memory" ? "mcp_brain_memory_search" : "fixture_tool"
    },
    id: `large-activity-${String(oneBased).padStart(3, "0")}`,
    metadata: {
      bounded: true,
      fixture: "large-artifacts-tools",
      index: oneBased,
      note: `metadata preview ${oneBased}`,
      tags: ["local", "measurement", type]
    },
    source: type === "memory" ? "brain-memory" : "ui",
    startedAt: iso(index + 1),
    status,
    summary: `Bounded ${type} activity summary ${oneBased}.`,
    title: `${type} activity ${String(oneBased).padStart(3, "0")}`,
    type
  } satisfies AgentActivityEvent;

  if (type === "command") {
    return {
      ...base,
      command: {
        args: ["--fixture", String(oneBased)],
        command: `npm run fixture:large -- --index=${oneBased}`,
        cwd: "C:\\Users\\Alexey\\.cursor\\projects\\hermes-ui",
        durationMs: base.durationMs,
        exitCode: index % 25 === 0 ? 1 : 0,
        outputPreview: `bounded command output preview ${oneBased}`,
        sourceChannel: "web-ui",
        stderrPreview: index % 25 === 0 ? `bounded stderr preview ${oneBased}` : undefined,
        stdoutPreview: `bounded stdout preview ${oneBased}`,
        toolName: "run_command",
        truncated: true
      },
      details: {
        command: `npm run fixture:large -- --index=${oneBased}`,
        fixture: true,
        outputPreview: `bounded output ${oneBased}`
      }
    };
  }

  if (type === "memory") {
    return {
      ...base,
      memory: {
        memoryId: `large-memory-${String(oneBased).padStart(3, "0")}`,
        operation: index % 2 === 0 ? "search" : "store",
        projectKey: projectStableKey(projectId),
        scopeStatus: "matching-session",
        sessionKey: sessionStableKey(sessionId)
      },
      details: {
        fixture: true,
        operation: index % 2 === 0 ? "search" : "store",
        preview: `bounded memory activity detail ${oneBased}`
      }
    };
  }

  if (type === "tool") {
    return {
      ...base,
      details: {
        fixture: true,
        tool: "fixture_tool",
        preview: `bounded tool detail ${oneBased}`
      }
    };
  }

  if (type === "error") {
    return {
      ...base,
      details: {
        error: `Fixture error detail ${oneBased}`,
        fixture: true,
        stackPreview: "stack preview intentionally bounded"
      },
      source: "ui",
      status: "failed"
    };
  }

  return {
    ...base,
    details: {
      fixture: true,
      status: "informational lifecycle checkpoint"
    },
    status: "info"
  };
}

function statusForActivity(type: AgentActivityType, index: number): AgentActivityStatus {
  if (type === "error") {
    return "failed";
  }
  if (type === "status") {
    return "info";
  }
  if (index % 37 === 0) {
    return "running";
  }
  return "completed";
}

function extensionForKind(kind: Artifact["kind"]) {
  if (kind === "code") {
    return "ts";
  }
  if (kind === "data") {
    return "json";
  }
  if (kind === "report") {
    return "md";
  }
  if (kind === "log") {
    return "log";
  }
  return "txt";
}
