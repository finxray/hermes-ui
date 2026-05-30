import type {
  StudioArtifact,
  StudioArtifactKind,
  StudioArtifactSource,
  StudioArtifactStatus
} from "@/data/types";
import type { AgentActivityEvent, AgentActivitySource } from "@/types/agentActivity";

type ArtifactContext = {
  projectId: string;
  sessionId?: string;
};

export function createStudioArtifactsFromActivityEvents(
  events: AgentActivityEvent[],
  context: ArtifactContext
): StudioArtifact[] {
  return events
    .map((event) => createStudioArtifactFromActivityEvent(event, context))
    .filter((artifact): artifact is StudioArtifact => Boolean(artifact));
}

export function createStudioArtifactFromActivityEvent(
  event: AgentActivityEvent,
  context: ArtifactContext
): StudioArtifact | null {
  if (!event.artifact) {
    return null;
  }

  const title =
    event.artifact.title ||
    titleFromPath(event.artifact.path) ||
    event.artifact.fileId ||
    event.title;

  if (!title) {
    return null;
  }

  return {
    id: event.artifact.artifactId || event.artifact.fileId || `activity-artifact-${event.id}`,
    projectId: context.projectId,
    sessionId: context.sessionId,
    title,
    kind: normalizeArtifactKind(event.artifact.kind || event.artifact.mimeType),
    source: normalizeArtifactSource(event.artifact.source || event.source),
    status: normalizeArtifactStatus(event.artifact.status || event.status),
    path: event.artifact.path,
    mimeType: event.artifact.mimeType,
    sizeBytes: event.artifact.sizeBytes,
    createdAt: event.startedAt,
    updatedAt: event.completedAt ?? event.startedAt,
    summary: event.summary,
    activityEventId: event.id,
    metadata: {
      action: event.artifact.action,
      hermesRunId: event.hermes?.runId,
      hermesToolName: event.hermes?.toolName
    }
  };
}

function normalizeArtifactKind(value?: string): StudioArtifactKind {
  const normalized = (value ?? "").trim().toLowerCase();
  if (normalized.includes("image")) {
    return "image";
  }
  if (normalized.includes("json") || normalized.includes("csv") || normalized.includes("data")) {
    return "data";
  }
  if (normalized.includes("log") || normalized.includes("stdout") || normalized.includes("stderr")) {
    return "log";
  }
  if (normalized.includes("code") || normalized.includes("script") || normalized.includes("source")) {
    return "code";
  }
  if (normalized.includes("design")) {
    return "design";
  }
  if (normalized.includes("contract")) {
    return "contract";
  }
  if (normalized.includes("architecture") || normalized.includes("adr")) {
    return "architecture";
  }
  if (normalized.includes("report")) {
    return "report";
  }
  if (normalized.includes("document") || normalized.includes("text") || normalized.includes("markdown")) {
    return "document";
  }
  return "unknown";
}

function normalizeArtifactSource(value?: AgentActivitySource | string): StudioArtifactSource {
  if (value === "hermes" || value === "brain-memory" || value === "ui") {
    return value;
  }
  return value === "mcp" ? "hermes" : "mock";
}

function normalizeArtifactStatus(value?: string): StudioArtifactStatus {
  const normalized = (value ?? "").trim().toLowerCase();
  if (normalized === "running" || normalized === "queued" || normalized === "pending") {
    return "pending";
  }
  if (normalized === "failed" || normalized === "error") {
    return "error";
  }
  if (normalized === "completed" || normalized === "available") {
    return "available";
  }
  return "unavailable";
}

function titleFromPath(path?: string) {
  if (!path) {
    return "";
  }
  return path.split(/[\\/]/).filter(Boolean).at(-1) ?? path;
}
