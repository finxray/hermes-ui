import type { ModelChoice, Project, Session, WorkspaceState } from "@/data/types";

export const LARGE_SIDEBAR_PROJECT_COUNT = 25;
export const LARGE_SIDEBAR_SESSIONS_PER_PROJECT = 40;
export const LARGE_SIDEBAR_SESSION_COUNT =
  LARGE_SIDEBAR_PROJECT_COUNT * LARGE_SIDEBAR_SESSIONS_PER_PROJECT;
export const LARGE_SIDEBAR_RECENT_CHAT_COUNT = 2;

const tenantId = "local-dev";
const baseTimestampMs = Date.parse("2026-05-31T12:00:00.000Z");

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
  const id = `large-sidebar-project-${String(index + 1).padStart(2, "0")}`;
  const stableKey = projectStableKey(id);
  return {
    createdAt: iso(2_000 + index),
    description: `Large sidebar measurement project ${index + 1}. Static fixture data only.`,
    icon: `S${index + 1}`,
    id,
    memoryScope: {
      contextPolicy: index % 3 === 0 ? "project-first" : "balanced",
      pinnedMemoryIds: [],
      projectId: id,
      retrievalProfile: "balanced",
      stableProjectKey: stableKey,
      tenantId,
      userVisibleSummary: `Large sidebar fixture project ${index + 1}.`
    },
    memoryScopeKey: stableKey,
    name: `Sidebar Project ${String(index + 1).padStart(2, "0")}`,
    updatedAt: iso(index)
  };
}

function makeSession(project: Project, projectIndex: number, sessionIndex: number): Session {
  const oneBased = sessionIndex + 1;
  const id = `${project.id}-session-${String(oneBased).padStart(3, "0")}`;
  const globalIndex = projectIndex * LARGE_SIDEBAR_SESSIONS_PER_PROJECT + sessionIndex;
  return {
    artifacts: [],
    createdAt: iso(1_500 + globalIndex),
    hermesSessionId: `hermes-${id}`,
    id,
    memoryEvidence: [],
    memoryScope: {
      includeProjectContext: true,
      includeSessionContext: true,
      projectId: project.id,
      sessionId: id,
      stableSessionKey: sessionStableKey(project.id, id),
      tenantId,
      userVisibleSummary: "Static large-sidebar fixture session."
    },
    messages: [],
    projectId: project.id,
    runRecords: [],
    summary: `Large sidebar measurement session ${oneBased} for ${project.name}.`,
    title: `Sidebar chat ${String(projectIndex + 1).padStart(2, "0")}-${String(oneBased).padStart(3, "0")}`,
    titleSource: "mock",
    toolEvents: [],
    updatedAt: iso(globalIndex)
  };
}

export const largeSidebarProjects: Project[] = Array.from(
  { length: LARGE_SIDEBAR_PROJECT_COUNT },
  (_, index) => makeProject(index)
);

export const largeSidebarSessions: Session[] = largeSidebarProjects.flatMap((project, projectIndex) =>
  Array.from({ length: LARGE_SIDEBAR_SESSIONS_PER_PROJECT }, (_, sessionIndex) =>
    makeSession(project, projectIndex, sessionIndex)
  )
);

export const largeSidebarActiveProject = largeSidebarProjects[0];
export const largeSidebarActiveSession = largeSidebarSessions[0];

export const largeSidebarModelChoices: ModelChoice[] = [
  {
    id: "hermes-agent",
    label: "Hermes Agent",
    provider: "Hermes"
  }
];

export const largeSidebarWorkspaceState: WorkspaceState = {
  activeProjectId: largeSidebarActiveProject.id,
  activeSessionId: largeSidebarActiveSession.id,
  connectionStatus: {
    brainMemory: "fixture",
    hermes: "fixture"
  },
  modelChoices: largeSidebarModelChoices,
  projects: largeSidebarProjects,
  sessions: largeSidebarSessions
};
