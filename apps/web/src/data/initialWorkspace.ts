import type { Project, Session, WorkspaceState } from "./types";

const tenantId = "local";
const projectId = "project-default";
const sessionId = "session-default";

export function createInitialWorkspace(): WorkspaceState {
  const now = new Date().toISOString();
  const project: Project = {
    id: projectId,
    name: "Untitled project",
    description: "Local Hermes workspace",
    icon: "H",
    contextScopeKey: `stoix:${tenantId}:project:${projectId}`,
    contextScope: {
      tenantId,
      projectId,
      stableProjectKey: `stoix:${tenantId}:project:${projectId}`,
      retrievalProfile: "balanced",
      contextPolicy: "balanced"
    },
    createdAt: now,
    updatedAt: now
  };
  const session: Session = {
    id: sessionId,
    projectId,
    hermesSessionId: "hermes-session-default",
    title: "New chat",
    titleSource: "default",
    summary: "",
    contextScope: {
      tenantId,
      projectId,
      sessionId,
      stableSessionKey: `stoix:${tenantId}:project:${projectId}:session:${sessionId}`,
      includeProjectContext: true,
      includeSessionContext: true
    },
    createdAt: now,
    updatedAt: now,
    messages: [],
    toolEvents: [],
    runRecords: [],
    artifacts: []
  };

  return {
    activeProjectId: projectId,
    activeSessionId: sessionId,
    projects: [project],
    sessions: [session],
    modelChoices: [
      {
        id: "hermes-default",
        label: "Hermes default",
        provider: "Hermes"
      }
    ],
    connectionStatus: {
      hermes: "Not configured"
    }
  };
}
