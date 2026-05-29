import { workspaceMock } from "@/data/mockWorkspace";
import type { PersistedWorkspaceState, Project, Session, WorkspaceState } from "@/data/types";

export const WORKSPACE_STORAGE_KEY = "hermes-ui.workspace.v1";
export const WORKSPACE_STORAGE_VERSION = 1;

type WorkspaceAction =
  | { type: "hydrate"; state: WorkspaceState }
  | { type: "switchProject"; projectId: string }
  | { type: "switchSession"; sessionId: string }
  | { type: "createProject" }
  | { type: "createSession" }
  | { type: "renameProject"; projectId: string; name: string }
  | { type: "renameSession"; sessionId: string; title: string }
  | { type: "archiveSession"; sessionId: string }
  | { type: "reset" };

export type { WorkspaceAction };

export function createMockWorkspaceState(): WorkspaceState {
  return structuredClone(workspaceMock);
}

export function workspaceReducer(
  state: WorkspaceState,
  action: WorkspaceAction
): WorkspaceState {
  switch (action.type) {
    case "hydrate":
      return normalizeWorkspace(action.state);
    case "switchProject":
      return switchProject(state, action.projectId);
    case "switchSession":
      return switchSession(state, action.sessionId);
    case "createProject":
      return createProject(state);
    case "createSession":
      return createSession(state);
    case "renameProject":
      return renameProject(state, action.projectId, action.name);
    case "renameSession":
      return renameSession(state, action.sessionId, action.title);
    case "archiveSession":
      return archiveSession(state, action.sessionId);
    case "reset":
      return createMockWorkspaceState();
    default:
      return state;
  }
}

export function loadWorkspaceState(storage: Storage): WorkspaceState | null {
  const raw = storage.getItem(WORKSPACE_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as PersistedWorkspaceState;
    if (parsed.version !== WORKSPACE_STORAGE_VERSION) {
      return null;
    }
    return normalizeWorkspace(parsed);
  } catch {
    return null;
  }
}

export function saveWorkspaceState(storage: Storage, state: WorkspaceState) {
  const payload: PersistedWorkspaceState = {
    ...normalizeWorkspace(state),
    version: WORKSPACE_STORAGE_VERSION
  };
  storage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(payload));
}

function normalizeWorkspace(state: WorkspaceState): WorkspaceState {
  const projects = state.projects.length > 0 ? state.projects : createMockWorkspaceState().projects;
  const sessions = state.sessions.map((session) => ({
    ...session,
    messages: session.messages ?? [],
    memoryEvidence: session.memoryEvidence ?? [],
    toolEvents: session.toolEvents ?? [],
    artifacts: session.artifacts ?? []
  }));

  const activeProjectId = projects.some((project) => project.id === state.activeProjectId)
    ? state.activeProjectId
    : projects[0]?.id;
  const activeSession = selectSessionForProject(sessions, activeProjectId, state.activeSessionId);

  return {
    ...state,
    activeProjectId,
    activeSessionId: activeSession?.id ?? null,
    projects,
    sessions
  };
}

function switchProject(state: WorkspaceState, projectId: string): WorkspaceState {
  if (!state.projects.some((project) => project.id === projectId)) {
    return state;
  }
  const activeSession = selectSessionForProject(state.sessions, projectId, null);
  return {
    ...state,
    activeProjectId: projectId,
    activeSessionId: activeSession?.id ?? null
  };
}

function switchSession(state: WorkspaceState, sessionId: string): WorkspaceState {
  const session = state.sessions.find((item) => item.id === sessionId && !item.archivedAt);
  if (!session) {
    return state;
  }
  return {
    ...state,
    activeProjectId: session.projectId,
    activeSessionId: session.id
  };
}

function createProject(state: WorkspaceState): WorkspaceState {
  const now = new Date().toISOString();
  const nextNumber = state.projects.filter((project) =>
    project.name.startsWith("Untitled project")
  ).length;
  const suffix = nextNumber === 0 ? "" : ` ${nextNumber + 1}`;
  const id = `project-${crypto.randomUUID()}`;
  const project: Project = {
    id,
    name: `Untitled project${suffix}`,
    description: "Local mock project. Rename and add chats when ready.",
    icon: makeProjectIcon(`Untitled project${suffix}`),
    memoryScopeKey: `studio:tenant-local:${id}`,
    createdAt: now,
    updatedAt: now
  };

  return {
    ...state,
    activeProjectId: id,
    activeSessionId: null,
    projects: [project, ...state.projects]
  };
}

function createSession(state: WorkspaceState): WorkspaceState {
  const project = state.projects.find((item) => item.id === state.activeProjectId);
  if (!project) {
    return state;
  }

  const now = new Date().toISOString();
  const session: Session = {
    id: `session-${crypto.randomUUID()}`,
    projectId: project.id,
    title: "New chat",
    summary: "Empty local mock session",
    createdAt: now,
    updatedAt: now,
    messages: [],
    memoryEvidence: [],
    toolEvents: [],
    artifacts: []
  };

  return {
    ...touchProject(state, project.id, now),
    activeSessionId: session.id,
    sessions: [session, ...state.sessions]
  };
}

function renameProject(state: WorkspaceState, projectId: string, name: string): WorkspaceState {
  const cleanName = name.trim();
  if (!cleanName) {
    return state;
  }
  const now = new Date().toISOString();
  return {
    ...state,
    projects: state.projects.map((project) =>
      project.id === projectId
        ? {
            ...project,
            name: cleanName,
            icon: makeProjectIcon(cleanName),
            updatedAt: now
          }
        : project
    )
  };
}

function renameSession(state: WorkspaceState, sessionId: string, title: string): WorkspaceState {
  const cleanTitle = title.trim();
  if (!cleanTitle) {
    return state;
  }
  const now = new Date().toISOString();
  const session = state.sessions.find((item) => item.id === sessionId);
  const next = {
    ...state,
    sessions: state.sessions.map((item) =>
      item.id === sessionId
        ? {
            ...item,
            title: cleanTitle,
            summary: item.messages.length === 0 ? "Empty local mock session" : item.summary,
            updatedAt: now
          }
        : item
    )
  };
  return session ? touchProject(next, session.projectId, now) : next;
}

function archiveSession(state: WorkspaceState, sessionId: string): WorkspaceState {
  const session = state.sessions.find((item) => item.id === sessionId);
  if (!session) {
    return state;
  }
  const now = new Date().toISOString();
  const sessions = state.sessions.map((item) =>
    item.id === sessionId
      ? {
          ...item,
          archivedAt: now,
          updatedAt: now
        }
      : item
  );
  const nextSession =
    state.activeSessionId === sessionId
      ? selectSessionForProject(sessions, session.projectId, null)
      : selectSessionForProject(sessions, state.activeProjectId, state.activeSessionId);

  return {
    ...touchProject(state, session.projectId, now),
    sessions,
    activeSessionId: nextSession?.id ?? null
  };
}

function touchProject(state: WorkspaceState, projectId: string, updatedAt: string): WorkspaceState {
  return {
    ...state,
    projects: state.projects.map((project) =>
      project.id === projectId ? { ...project, updatedAt } : project
    )
  };
}

export function getVisibleSessions(state: WorkspaceState, projectId: string): Session[] {
  return state.sessions
    .filter((session) => session.projectId === projectId && !session.archivedAt)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

function selectSessionForProject(
  sessions: Session[],
  projectId: string,
  preferredSessionId: string | null
): Session | null {
  const visible = sessions
    .filter((session) => session.projectId === projectId && !session.archivedAt)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  return visible.find((session) => session.id === preferredSessionId) ?? visible[0] ?? null;
}

function makeProjectIcon(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("")
    .padEnd(2, "P")
    .slice(0, 2);
}
