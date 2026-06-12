import type { BrainMemorySearchContext } from "@hermes-ui/brain-memory-client";

/**
 * Shared request parsing for the Brain Memory BFF routes. Both the search and
 * inspect routes accept the same structured project/session context envelope;
 * keeping the validation here guarantees they stay in lockstep.
 */
export function readBrainMemoryContext(value: unknown): BrainMemorySearchContext | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const context = value as Record<string, unknown>;
  const project = readObject(context.project);
  const ui = readObject(context.ui);
  const session = context.session === null ? null : readObject(context.session);

  if (!project || !ui) {
    return null;
  }

  const projectId = cleanString(project.id, 256);
  const title = cleanString(project.title, 256);
  const stableKey = cleanString(project.stableKey, 256);
  const tenantId = cleanString(project.tenantId, 256);
  const workspaceVersion = Number(ui.workspaceVersion);

  if (!projectId || !title || !stableKey || !tenantId || !Number.isInteger(workspaceVersion)) {
    return null;
  }

  return {
    project: {
      id: projectId,
      title,
      stableKey,
      tenantId,
      retrievalProfile: cleanString(project.retrievalProfile, 64) || "balanced",
      contextPolicy: cleanString(project.contextPolicy, 64) || "balanced"
    },
    session: session ? readSessionContext(session) : null,
    ui: {
      source: "hermes-ui",
      workspaceVersion
    }
  };
}

function readSessionContext(session: Record<string, unknown>) {
  const id = cleanString(session.id, 256);
  const title = cleanString(session.title, 256);
  const stableKey = cleanString(session.stableKey, 256);

  if (!id || !title || !stableKey) {
    return null;
  }

  return {
    id,
    title,
    stableKey,
    includeProjectContext: session.includeProjectContext !== false,
    includeSessionContext: session.includeSessionContext !== false
  };
}

export function readObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function cleanString(value: unknown, maxLength: number): string {
  return typeof value === "string"
    ? value.replace(/[\r\n\x00]/g, " ").trim().slice(0, maxLength)
    : "";
}

export function cleanText(value: unknown, maxLength: number): string {
  return typeof value === "string" ? value.replace(/\x00/g, "").trim().slice(0, maxLength) : "";
}
