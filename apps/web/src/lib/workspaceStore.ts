import { workspaceMock } from "../data/mockWorkspace";
import type {
  ChatMessage,
  ProjectMemoryScope,
  PersistedWorkspaceState,
  Project,
  Session,
  SessionMemoryScope,
  ToolEvent,
  WorkspaceState
} from "@/data/types";

export const WORKSPACE_STORAGE_KEY = "hermes-ui.workspace.v1";
export const WORKSPACE_STORAGE_VERSION = 1;
export const DEFAULT_TENANT_ID = "tenant-local";

type WorkspaceAction =
  | { type: "hydrate"; state: WorkspaceState }
  | { type: "switchProject"; projectId: string }
  | { type: "switchSession"; sessionId: string }
  | { type: "createProject" }
  | { type: "createSession" }
  | { type: "renameProject"; projectId: string; name: string }
  | { type: "renameSession"; sessionId: string; title: string }
  | { type: "archiveSession"; sessionId: string }
  | { type: "appendMessage"; sessionId: string; message: ChatMessage }
  | {
      type: "updateMessage";
      sessionId: string;
      messageId: string;
      content: string;
      status?: ChatMessage["status"];
      references?: string[];
    }
  | { type: "appendToolEvent"; sessionId: string; event: ToolEvent }
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
    case "appendMessage":
      return appendMessage(state, action.sessionId, action.message);
    case "updateMessage":
      return updateMessage(state, action);
    case "appendToolEvent":
      return appendToolEvent(state, action.sessionId, action.event);
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
  const rawProjects =
    state.projects.length > 0 ? state.projects : createMockWorkspaceState().projects;
  const projects = rawProjects.map((project) => normalizeProject(project));
  const sessions = state.sessions.map((session) => normalizeSession(session, projects));

  const activeProjectId = projects.some((project) => project.id === state.activeProjectId)
    ? state.activeProjectId
    : selectMostRecentProject(projects)?.id;
  const repairedProjectId = activeProjectId ?? "";
  const activeSession = selectSessionForProject(
    sessions,
    repairedProjectId,
    state.activeSessionId
  );

  return {
    ...state,
    activeProjectId: repairedProjectId,
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
  const name = makeUniqueTitle(
    "Untitled project",
    state.projects.map((project) => project.name)
  );
  const id = `project-${crypto.randomUUID()}`;
  const memoryScopeKey = makeProjectStableKey(DEFAULT_TENANT_ID, id);
  const project: Project = {
    id,
    name,
    description: "Local mock project. Rename and add chats when ready.",
    icon: makeProjectIcon(name),
    memoryScopeKey,
    memoryScope: makeProjectMemoryScope({
      id,
      name,
      memoryScopeKey
    }),
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
  const id = `session-${crypto.randomUUID()}`;
  const hermesSessionId = `hermes-${id}`;
  const title = makeUniqueTitle(
    "New chat",
    state.sessions
      .filter((session) => session.projectId === project.id)
      .map((session) => session.title)
  );
  const session: Session = {
    id,
    projectId: project.id,
    hermesSessionId,
    title,
    titleSource: "default",
    summary: "Empty local mock session",
    memoryScope: makeSessionMemoryScope({
      project,
      sessionId: id,
      title
    }),
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
            titleSource: "manual" as const,
            renamedAt: now,
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

function appendMessage(
  state: WorkspaceState,
  sessionId: string,
  message: ChatMessage
): WorkspaceState {
  const session = state.sessions.find((item) => item.id === sessionId);
  if (!session) {
    return state;
  }

  const now = new Date().toISOString();
  const next = {
    ...state,
    sessions: state.sessions.map((item) =>
      item.id === sessionId ? appendMessageToSession(item, message, now) : item
    )
  };
  return touchProject(next, session.projectId, now);
}

function updateMessage(
  state: WorkspaceState,
  action: Extract<WorkspaceAction, { type: "updateMessage" }>
): WorkspaceState {
  const session = state.sessions.find((item) => item.id === action.sessionId);
  if (!session) {
    return state;
  }

  const now = new Date().toISOString();
  const next = {
    ...state,
    sessions: state.sessions.map((item) =>
      item.id === action.sessionId
        ? {
            ...item,
            messages: item.messages.map((message) =>
              message.id === action.messageId
                ? {
                    ...message,
                    content: action.content,
                    references: action.references ?? message.references,
                    status: action.status ?? message.status
                  }
                : message
            ),
            updatedAt: now
          }
        : item
    )
  };
  return touchProject(next, session.projectId, now);
}

function appendToolEvent(
  state: WorkspaceState,
  sessionId: string,
  event: ToolEvent
): WorkspaceState {
  const session = state.sessions.find((item) => item.id === sessionId);
  if (!session) {
    return state;
  }

  const now = new Date().toISOString();
  const next = {
    ...state,
    sessions: state.sessions.map((item) =>
      item.id === sessionId
        ? {
            ...item,
            toolEvents: [event, ...item.toolEvents].slice(0, 24),
            updatedAt: now
          }
        : item
    )
  };
  return touchProject(next, session.projectId, now);
}

function touchProject(state: WorkspaceState, projectId: string, updatedAt: string): WorkspaceState {
  return {
    ...state,
    projects: state.projects.map((project) =>
      project.id === projectId ? { ...project, updatedAt } : project
    )
  };
}

function normalizeProject(project: Project): Project {
  const memoryScope = project.memoryScope ?? makeProjectMemoryScope(project);
  const memoryScopeKey = project.memoryScopeKey || memoryScope.stableProjectKey;

  return {
    ...project,
    memoryScopeKey,
    memoryScope: {
      ...memoryScope,
      tenantId: memoryScope.tenantId || DEFAULT_TENANT_ID,
      projectId: memoryScope.projectId || project.id,
      stableProjectKey: memoryScope.stableProjectKey || memoryScopeKey,
      retrievalProfile: memoryScope.retrievalProfile || "balanced",
      pinnedMemoryIds: memoryScope.pinnedMemoryIds ?? [],
      contextPolicy: memoryScope.contextPolicy || "balanced"
    }
  };
}

function normalizeSession(session: Session, projects: Project[]): Session {
  const project = projects.find((item) => item.id === session.projectId);
  const memoryScope =
    session.memoryScope ??
    makeSessionMemoryScope({
      project,
      sessionId: session.id,
      title: session.title
    });

  return {
    ...session,
    hermesSessionId: session.hermesSessionId || `hermes-${session.id}`,
    titleSource: normalizeTitleSource(session),
    memoryScope: {
      ...memoryScope,
      tenantId: memoryScope.tenantId || project?.memoryScope.tenantId || DEFAULT_TENANT_ID,
      projectId: memoryScope.projectId || session.projectId,
      sessionId: memoryScope.sessionId || session.id,
      stableSessionKey:
        memoryScope.stableSessionKey ||
        makeSessionStableKey(project?.memoryScope.tenantId ?? DEFAULT_TENANT_ID, session.projectId, session.id),
      includeProjectContext: memoryScope.includeProjectContext !== false,
      includeSessionContext: memoryScope.includeSessionContext !== false
    },
    messages: session.messages ?? [],
    memoryEvidence: session.memoryEvidence ?? [],
    toolEvents: session.toolEvents ?? [],
    artifacts: session.artifacts ?? []
  };
}

export function getVisibleSessions(state: WorkspaceState, projectId: string): Session[] {
  return state.sessions
    .filter((session) => session.projectId === projectId && !session.archivedAt)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function formatSessionUpdatedAt(
  updatedAt: string,
  nowMs = Date.now()
): string {
  const updatedMs = Date.parse(updatedAt);
  if (!Number.isFinite(updatedMs)) {
    return "";
  }

  const diffMs = Math.max(0, nowMs - updatedMs);
  const minuteMs = 60_000;
  const hourMs = 60 * minuteMs;
  const dayMs = 24 * hourMs;

  if (diffMs < minuteMs) {
    return "now";
  }
  if (diffMs < hourMs) {
    return `${Math.floor(diffMs / minuteMs)}min`;
  }
  if (diffMs < dayMs) {
    return `${Math.floor(diffMs / hourMs)}h`;
  }
  return `${Math.floor(diffMs / dayMs)}d`;
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

function selectMostRecentProject(projects: Project[]): Project | null {
  return [...projects].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0] ?? null;
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

function makeProjectMemoryScope(project: Pick<Project, "id" | "name"> & Partial<Project>): ProjectMemoryScope {
  const stableProjectKey =
    project.memoryScopeKey || makeProjectStableKey(DEFAULT_TENANT_ID, project.id);

  return {
    tenantId: DEFAULT_TENANT_ID,
    projectId: project.id,
    stableProjectKey,
    retrievalProfile: "balanced",
    pinnedMemoryIds: [],
    contextPolicy: "balanced",
    userVisibleSummary: `${project.name} project context is prepared for future Brain Memory retrieval.`
  };
}

function makeSessionMemoryScope(args: {
  project?: Project;
  sessionId: string;
  title: string;
}): SessionMemoryScope {
  const tenantId = args.project?.memoryScope.tenantId ?? DEFAULT_TENANT_ID;
  const projectId = args.project?.id ?? "project-unknown";

  return {
    tenantId,
    projectId,
    sessionId: args.sessionId,
    stableSessionKey: makeSessionStableKey(tenantId, projectId, args.sessionId),
    includeProjectContext: true,
    includeSessionContext: true,
    userVisibleSummary: `${args.title} session context is prepared for future Brain Memory continuity.`
  };
}

function makeProjectStableKey(tenantId: string, projectId: string): string {
  return `studio:${tenantId}:project:${projectId}`;
}

function makeSessionStableKey(tenantId: string, projectId: string, sessionId: string): string {
  return `studio:${tenantId}:project:${projectId}:session:${sessionId}`;
}

function makeUniqueTitle(baseTitle: string, existingTitles: string[]): string {
  const used = new Set(existingTitles.map((title) => title.trim().toLowerCase()));
  if (!used.has(baseTitle.toLowerCase())) {
    return baseTitle;
  }

  let next = 2;
  while (used.has(`${baseTitle} ${next}`.toLowerCase())) {
    next += 1;
  }
  return `${baseTitle} ${next}`;
}

function isDefaultSessionTitle(title: string): boolean {
  return /^New chat(?: \d+)?$/i.test(title.trim());
}

function appendMessageToSession(session: Session, message: ChatMessage, now: string): Session {
  const titleSource = session.titleSource ?? normalizeTitleSource(session);
  const shouldAutoTitle =
    message.role === "user" &&
    titleSource === "default" &&
    isDefaultSessionTitle(session.title);
  const nextTitle = shouldAutoTitle ? summarizeTitle(message.content) : session.title;

  return {
    ...session,
    messages: [...session.messages, message],
    summary:
      session.messages.length === 0 && message.role === "user"
        ? summarizeMessage(message.content)
        : session.summary,
    title: nextTitle,
    titleSource: shouldAutoTitle ? "first-message" : titleSource,
    firstUserMessageAt:
      shouldAutoTitle && !session.firstUserMessageAt ? now : session.firstUserMessageAt,
    updatedAt: now
  };
}

function normalizeTitleSource(session: Session): NonNullable<Session["titleSource"]> {
  if (session.titleSource) {
    return session.titleSource;
  }
  if (isDefaultSessionTitle(session.title)) {
    return "default";
  }

  const firstUserMessage = session.messages?.find((message) => message.role === "user");
  if (firstUserMessage && summarizeTitle(firstUserMessage.content) === session.title) {
    return "first-message";
  }

  return "manual";
}

function summarizeTitle(content: string): string {
  const clean = summarizeMessage(content)
    .replace(/^(please\s+)?(can|could|would)\s+you\s+/i, "")
    .replace(/^(please\s+)/i, "")
    .replace(/[`"'()[\]{}<>]/g, "")
    .replace(/[?!.,:;]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!clean) {
    return "New chat";
  }
  return `${clean[0].toUpperCase()}${clean.slice(1)}`.slice(0, 44);
}

function summarizeMessage(content: string): string {
  const clean = content.replace(/\s+/g, " ").trim();
  return clean.length > 80 ? `${clean.slice(0, 77)}...` : clean || "New chat";
}
