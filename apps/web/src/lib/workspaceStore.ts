import { createInitialWorkspace } from "../data/initialWorkspace";
import type {
  Artifact,
  ChatAttachment,
  ChatMessage,
  PersistedActivityEvent,
  ProjectContextScope,
  PersistedWorkspaceState,
  Project,
  RunActivitySummary,
  RunRecord,
  Session,
  SessionChannel,
  SessionContextScope,
  SessionModelPreference,
  ToolEvent,
  WorkspaceState
} from "@/data/types";

export const WORKSPACE_STORAGE_KEY = "hermes-ui.workspace.v1";
export const WORKSPACE_STORAGE_VERSION = 1;
export const DEFAULT_TENANT_ID = "local";
export const DEFAULT_USER_DISPLAY_NAME = "You";

const LEGACY_LOCAL_TENANT_IDS = new Set(["tenant-local", "local-dev"]);

const SECRET_KEY_PATTERN = /api[_-]?key|authorization|bearer|credential|password|secret|token/i;
const BEARER_VALUE_PATTERN = /\bBearer\s+[A-Za-z0-9._~+/=-]+/gi;

type WorkspaceAction =
  | { type: "hydrate"; state: WorkspaceState }
  | { type: "switchProject"; projectId: string }
  | { type: "switchSession"; sessionId: string }
  | { type: "createProject"; activate?: boolean; name?: string; projectId?: string }
  | {
      type: "createSession";
      activate?: boolean;
      channel?: SessionChannel;
      createdAt?: string;
      hermesSessionId?: string;
      messages?: ChatMessage[];
      projectId?: string;
      sessionId?: string;
      title?: string;
      updatedAt?: string;
    }
  | { type: "renameProject"; projectId: string; name: string }
  | { type: "archiveProjectSessions"; projectId: string }
  | { type: "removeProject"; projectId: string }
  | { type: "renameSession"; sessionId: string; title: string }
  | { type: "markSessionTitleGenerationRequested"; sessionId: string; requestedAt: string }
  | { type: "applyGeneratedSessionTitle"; sessionId: string; title: string; generatedAt: string }
  | { type: "archiveSession"; sessionId: string }
  | { type: "appendMessage"; sessionId: string; message: ChatMessage }
  | { type: "updateMessageAttachments"; sessionId: string; messageId: string; attachments: ChatMessage["attachments"] }
  | { type: "appendRunRecord"; sessionId: string; run: RunRecord }
  | { type: "updateRunRecord"; sessionId: string; runId: string; patch: Partial<RunRecord> }
  | {
      type: "updateMessage";
      sessionId: string;
      messageId: string;
      content: string;
      status?: ChatMessage["status"];
      references?: string[];
      usage?: ChatMessage["usage"];
    }
  | { type: "appendToolEvent"; sessionId: string; event: ToolEvent }
  | { type: "loadHermesMessages"; sessionId: string; messages: ChatMessage[] }
  | { type: "setSessionModelPreference"; sessionId: string; preference: SessionModelPreference }
  | { type: "reset" };

export type { WorkspaceAction };

export function createInitialWorkspaceState(): WorkspaceState {
  return createInitialWorkspace();
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
      return createProject(state, action);
    case "createSession":
      return createSession(state, action);
    case "renameProject":
      return renameProject(state, action.projectId, action.name);
    case "archiveProjectSessions":
      return archiveProjectSessions(state, action.projectId);
    case "removeProject":
      return removeProject(state, action.projectId);
    case "renameSession":
      return renameSession(state, action.sessionId, action.title);
    case "markSessionTitleGenerationRequested":
      return markSessionTitleGenerationRequested(state, action.sessionId, action.requestedAt);
    case "applyGeneratedSessionTitle":
      return applyGeneratedSessionTitle(state, action.sessionId, action.title, action.generatedAt);
    case "archiveSession":
      return archiveSession(state, action.sessionId);
    case "appendMessage":
      return appendMessage(state, action.sessionId, action.message);
    case "updateMessageAttachments":
      return updateMessageAttachments(state, action.sessionId, action.messageId, action.attachments);
    case "appendRunRecord":
      return appendRunRecord(state, action.sessionId, action.run);
    case "updateRunRecord":
      return updateRunRecord(state, action.sessionId, action.runId, action.patch);
    case "updateMessage":
      return updateMessage(state, action);
    case "appendToolEvent":
      return appendToolEvent(state, action.sessionId, action.event);
    case "loadHermesMessages":
      return loadHermesMessages(state, action.sessionId, action.messages);
    case "setSessionModelPreference":
      return setSessionModelPreference(state, action.sessionId, action.preference);
    case "reset":
      return createInitialWorkspaceState();
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
    state.projects.length > 0 ? state.projects : createInitialWorkspaceState().projects;
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
  const now = new Date().toISOString();
  return {
    ...state,
    activeProjectId: projectId,
    activeSessionId: activeSession?.id ?? null,
    sessions: activeSession ? markSessionViewed(state.sessions, activeSession.id, now) : state.sessions
  };
}

function switchSession(state: WorkspaceState, sessionId: string): WorkspaceState {
  const session = state.sessions.find((item) => item.id === sessionId && !item.archivedAt);
  if (!session) {
    return state;
  }
  const now = new Date().toISOString();
  return {
    ...state,
    activeProjectId: session.projectId,
    activeSessionId: session.id,
    sessions: markSessionViewed(state.sessions, session.id, now)
  };
}

function createProject(
  state: WorkspaceState,
  options: Extract<WorkspaceAction, { type: "createProject" }>
): WorkspaceState {
  const now = new Date().toISOString();
  const name = makeUniqueTitle(
    options.name?.trim() || "Untitled project",
    state.projects.map((project) => project.name)
  );
  const id = options.projectId ?? `project-${crypto.randomUUID()}`;
  const contextScopeKey = makeProjectStableKey(DEFAULT_TENANT_ID, id);
  const project: Project = {
    id,
    name,
    description: "Local Stoix project.",
    icon: makeProjectIcon(name),
    contextScopeKey,
    contextScope: makeProjectContextScope({
      id,
      name,
      contextScopeKey
    }),
    createdAt: now,
    updatedAt: now
  };

  return {
    ...state,
    activeProjectId: options.activate === false ? state.activeProjectId : id,
    activeSessionId: options.activate === false ? state.activeSessionId : null,
    projects: [project, ...state.projects]
  };
}

function createSession(
  state: WorkspaceState,
  options: Extract<WorkspaceAction, { type: "createSession" }>
): WorkspaceState {
  const projectId = options.projectId ?? state.activeProjectId;
  const project = state.projects.find((item) => item.id === projectId);
  if (!project) {
    return state;
  }

  const now = new Date().toISOString();
  const id = options.sessionId ?? `session-${crypto.randomUUID()}`;
  const hermesSessionId = options.hermesSessionId?.trim() || `hermes-${id}`;
  const requestedTitle = options.title?.trim();
  const title = requestedTitle || makeUniqueTitle(
    "New chat",
    state.sessions
      .filter((session) => session.projectId === project.id)
      .map((session) => session.title)
  );
  const createdAt = normalizeTimestamp(options.createdAt) ?? now;
  const updatedAt = normalizeTimestamp(options.updatedAt) ?? createdAt;
  const session: Session = {
    id,
    projectId: project.id,
    hermesSessionId,
    title,
    titleSource: requestedTitle ? "manual" : "default",
    summary: "",
    contextScope: makeSessionContextScope({
      project,
      sessionId: id,
      title
    }),
    createdAt,
    updatedAt,
    lastViewedAt: now,
    messages: options.messages ?? [],
    toolEvents: [],
    runRecords: [],
    artifacts: [],
    channel: options.channel
  };

  return {
    ...touchProject(state, project.id, updatedAt),
    activeProjectId: options.activate === false ? state.activeProjectId : project.id,
    activeSessionId: options.activate === false ? state.activeSessionId : session.id,
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

function archiveProjectSessions(state: WorkspaceState, projectId: string): WorkspaceState {
  if (!state.projects.some((project) => project.id === projectId)) {
    return state;
  }

  const now = new Date().toISOString();
  const sessions = state.sessions.map((session) =>
    session.projectId === projectId && !session.archivedAt
      ? { ...session, archivedAt: now, updatedAt: now }
      : session
  );

  return {
    ...touchProject(state, projectId, now),
    activeSessionId: state.activeProjectId === projectId
      ? null
      : selectSessionForProject(sessions, state.activeProjectId, state.activeSessionId)?.id ?? null,
    sessions
  };
}

function removeProject(state: WorkspaceState, projectId: string): WorkspaceState {
  if (state.projects.length <= 1 || !state.projects.some((project) => project.id === projectId)) {
    return state;
  }

  const projects = state.projects.filter((project) => project.id !== projectId);
  const sessions = state.sessions.filter((session) => session.projectId !== projectId);
  const activeProjectId = state.activeProjectId === projectId
    ? selectMostRecentProject(projects)?.id ?? projects[0]?.id ?? ""
    : state.activeProjectId;
  const activeSessionId = selectSessionForProject(
    sessions,
    activeProjectId,
    state.activeProjectId === projectId ? null : state.activeSessionId
  )?.id ?? null;

  return {
    ...state,
    activeProjectId,
    activeSessionId,
    projects,
    sessions
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
            summary: item.messages.length === 0 ? "" : item.summary,
            updatedAt: now
          }
        : item
    )
  };
  return session ? touchProject(next, session.projectId, now) : next;
}

function markSessionTitleGenerationRequested(
  state: WorkspaceState,
  sessionId: string,
  requestedAt: string
): WorkspaceState {
  const session = state.sessions.find((item) => item.id === sessionId);
  if (!session || !shouldGenerateSessionTitle(session)) {
    return state;
  }
  return {
    ...state,
    sessions: state.sessions.map((item) =>
      item.id === sessionId
        ? { ...item, titleGenerationRequestedAt: requestedAt }
        : item
    )
  };
}

function applyGeneratedSessionTitle(
  state: WorkspaceState,
  sessionId: string,
  title: string,
  generatedAt: string
): WorkspaceState {
  const cleanTitle = title.replace(/[\r\n\x00]/g, " ").replace(/\s+/g, " ").trim().slice(0, 60);
  const session = state.sessions.find((item) => item.id === sessionId);
  if (
    !cleanTitle ||
    !session?.titleGenerationRequestedAt ||
    session.titleSource !== "default" ||
    !isDefaultSessionTitle(session.title)
  ) {
    return state;
  }
  const next = {
    ...state,
    sessions: state.sessions.map((item) =>
      item.id === sessionId
        ? {
            ...item,
            title: cleanTitle,
            titleSource: "model" as const,
            titleGeneratedAt: generatedAt,
            updatedAt: generatedAt
          }
        : item
    )
  };
  return touchProject(next, session.projectId, generatedAt);
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
      item.id === sessionId
        ? appendMessageToSession(item, message, now, state.activeSessionId === sessionId)
        : item
    )
  };
  return touchProject(next, session.projectId, now);
}

function appendRunRecord(
  state: WorkspaceState,
  sessionId: string,
  run: RunRecord
): WorkspaceState {
  const session = state.sessions.find((item) => item.id === sessionId);
  if (!session) {
    return state;
  }

  const project = state.projects.find((item) => item.id === session.projectId);
  const now = new Date().toISOString();
  const normalizedRun = normalizeRunRecord(run, session, project);
  const next = {
    ...state,
    sessions: state.sessions.map((item) =>
      item.id === sessionId
        ? {
            ...item,
            runRecords: [
              normalizedRun,
              ...(item.runRecords ?? []).filter((record) => record.id !== normalizedRun.id)
            ].slice(0, 24),
            updatedAt: now,
            lastViewedAt: state.activeSessionId === sessionId ? now : item.lastViewedAt
          }
        : item
    )
  };
  return touchProject(next, session.projectId, now);
}

function updateRunRecord(
  state: WorkspaceState,
  sessionId: string,
  runId: string,
  patch: Partial<RunRecord>
): WorkspaceState {
  const session = state.sessions.find((item) => item.id === sessionId);
  const existingRun = session?.runRecords?.find((record) => record.id === runId);
  if (!session || !existingRun) {
    return state;
  }

  const project = state.projects.find((item) => item.id === session.projectId);
  const now = new Date().toISOString();
  const mergedRun = normalizeRunRecord(
    {
      ...existingRun,
      ...patch,
      activityEventIds: patch.activityEventIds ?? existingRun.activityEventIds,
      activitySummary: patch.activitySummary ?? existingRun.activitySummary
    },
    session,
    project
  );
  const next = {
    ...state,
    sessions: state.sessions.map((item) =>
      item.id === sessionId
        ? {
            ...item,
            runRecords: (item.runRecords ?? []).map((record) =>
              record.id === runId ? mergedRun : record
            ),
            updatedAt: now,
            lastViewedAt: state.activeSessionId === sessionId ? now : item.lastViewedAt
          }
        : item
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
                    status: action.status ?? message.status,
                    usage: action.usage ?? message.usage
                  }
                : message
            ),
            updatedAt: now,
            lastViewedAt: state.activeSessionId === action.sessionId ? now : item.lastViewedAt
          }
        : item
    )
  };
  return touchProject(next, session.projectId, now);
}

function updateMessageAttachments(
  state: WorkspaceState,
  sessionId: string,
  messageId: string,
  attachments: ChatMessage["attachments"]
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
            messages: item.messages.map((message) =>
              message.id === messageId ? { ...message, attachments } : message
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
            updatedAt: now,
            lastViewedAt: state.activeSessionId === sessionId ? now : item.lastViewedAt
          }
        : item
    )
  };
  return touchProject(next, session.projectId, now);
}

function loadHermesMessages(
  state: WorkspaceState,
  sessionId: string,
  messages: ChatMessage[]
): WorkspaceState {
  const session = state.sessions.find((item) => item.id === sessionId);
  if (!session) {
    return state;
  }
  const now = new Date().toISOString();
  return {
    ...state,
    sessions: state.sessions.map((item) =>
      item.id === sessionId
        ? {
            ...item,
            messages: mergeLocalAttachments(item.messages, messages),
            updatedAt: now,
            lastViewedAt: state.activeSessionId === sessionId ? now : item.lastViewedAt
          }
        : item
    )
  };
}

function mergeLocalAttachments(
  localMessages: ChatMessage[],
  hermesMessages: ChatMessage[]
): ChatMessage[] {
  const localById = new Map(localMessages.map((message) => [message.id, message]));
  const localByContent = new Map<string, ChatMessage[]>();

  for (const message of localMessages) {
    if (!message.attachments?.length) {
      continue;
    }
    const key = `${message.role}\u0000${message.content}`;
    localByContent.set(key, [...(localByContent.get(key) ?? []), message]);
  }

  return hermesMessages.map((message) => {
    const exactMatch = localById.get(message.id);
    const contentMatches = localByContent.get(`${message.role}\u0000${message.content}`);
    const localMatch = exactMatch?.attachments?.length ? exactMatch : contentMatches?.shift();
    return localMatch?.attachments?.length
      ? {
          ...message,
          attachments: mergeMessageAttachments(message.attachments, localMatch.attachments)
        }
      : message;
  });
}

function mergeMessageAttachments(
  hermesAttachments: ChatAttachment[] | undefined,
  localAttachments: ChatAttachment[]
): ChatAttachment[] {
  if (!hermesAttachments?.length) {
    return localAttachments;
  }

  const usedLocalAttachments = new Set<ChatAttachment>();
  const merged = hermesAttachments.map((hermesAttachment) => {
    const localAttachment = localAttachments.find((candidate) =>
      !usedLocalAttachments.has(candidate) && attachmentIdentityMatches(candidate, hermesAttachment)
    );
    if (!localAttachment) {
      return hermesAttachment;
    }

    usedLocalAttachments.add(localAttachment);
    const storageId = localAttachment.storageId ?? hermesAttachment.storageId;
    const previewUrl = localAttachment.previewUrl ?? hermesAttachment.previewUrl;
    const downloadUrl = localAttachment.downloadUrl ?? hermesAttachment.downloadUrl ?? (
      storageId ? `/api/attachments/${encodeURIComponent(storageId)}?download=1` : undefined
    );

    return {
      ...hermesAttachment,
      contentHash: localAttachment.contentHash ?? hermesAttachment.contentHash,
      downloadUrl,
      previewUrl,
      storageId,
      status: storageId || previewUrl ? "ready" : hermesAttachment.status
    };
  });

  return [
    ...merged,
    ...localAttachments.filter((attachment) => !usedLocalAttachments.has(attachment))
  ];
}

function attachmentIdentityMatches(left: ChatAttachment, right: ChatAttachment) {
  if (left.storageId && right.storageId) {
    return left.storageId === right.storageId;
  }
  if (left.id && right.id && left.id === right.id) {
    return true;
  }
  if (left.contentHash && right.contentHash) {
    return left.contentHash === right.contentHash;
  }
  return left.fileName === right.fileName && left.sizeBytes === right.sizeBytes;
}

function setSessionModelPreference(
  state: WorkspaceState,
  sessionId: string,
  preference: SessionModelPreference
): WorkspaceState {
  const session = state.sessions.find((item) => item.id === sessionId);
  const normalizedPreference = normalizeSessionModelPreference(preference);
  if (!session || !normalizedPreference) {
    return state;
  }

  const now = new Date().toISOString();
  const next = {
    ...state,
    sessions: state.sessions.map((item) =>
      item.id === sessionId
        ? {
            ...item,
            modelPreference: normalizedPreference,
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
  const legacy = project as Project & {
    memoryScope?: ProjectContextScope;
    memoryScopeKey?: string;
  };
  const contextScope =
    project.contextScope ?? legacy.memoryScope ?? makeProjectContextScope(project);
  const tenantId = normalizeTenantId(contextScope.tenantId);
  const stableProjectKey = normalizeProjectStableKey(
    contextScope.stableProjectKey || project.contextScopeKey || legacy.memoryScopeKey,
    tenantId,
    project.id
  );
  const contextScopeKey = normalizeProjectStableKey(
    project.contextScopeKey || legacy.memoryScopeKey || contextScope.stableProjectKey,
    tenantId,
    project.id
  );

  return {
    ...project,
    description:
      project.description === "Local mock project. Rename and add chats when ready."
        ? "Local Stoix project."
        : project.description,
    contextScopeKey,
    contextScope: {
      ...contextScope,
      tenantId,
      projectId: contextScope.projectId || project.id,
      stableProjectKey,
      retrievalProfile: contextScope.retrievalProfile || "balanced",
      contextPolicy: contextScope.contextPolicy || "balanced"
    }
  };
}

function normalizeSession(session: Session, projects: Project[]): Session {
  const project = projects.find((item) => item.id === session.projectId);
  const legacy = session as Session & {
    memoryScope?: SessionContextScope;
    memoryEvidence?: unknown[];
  };
  const contextScope =
    session.contextScope ??
    legacy.memoryScope ??
    makeSessionContextScope({
      project,
      sessionId: session.id,
      title: session.title
    });
  const tenantId = normalizeTenantId(
    contextScope.tenantId || project?.contextScope.tenantId || DEFAULT_TENANT_ID
  );
  const stableSessionKey = normalizeSessionStableKey(
    contextScope.stableSessionKey,
    tenantId,
    session.projectId,
    session.id
  );
  const titleSource = normalizeTitleSource(session);
  const firstUserMessage = session.messages?.find((message) => message.role === "user");
  const title =
    titleSource === "first-message" && firstUserMessage
      ? summarizeTitle(firstUserMessage.content)
      : session.title;

  return {
    ...session,
    title,
    summary: session.summary === "Empty local mock session" ? "" : session.summary,
    hermesSessionId: session.hermesSessionId || `hermes-${session.id}`,
    titleSource,
    titleGenerationRequestedAt: normalizeTimestamp(session.titleGenerationRequestedAt),
    titleGeneratedAt: normalizeTimestamp(session.titleGeneratedAt),
    lastViewedAt: normalizeTimestamp(session.lastViewedAt) ?? normalizeTimestamp(session.updatedAt),
    contextScope: {
      ...contextScope,
      tenantId,
      projectId: contextScope.projectId || session.projectId,
      sessionId: contextScope.sessionId || session.id,
      stableSessionKey,
      includeProjectContext: contextScope.includeProjectContext !== false,
      includeSessionContext: contextScope.includeSessionContext !== false
    },
    messages: session.messages ?? [],
    toolEvents: session.toolEvents ?? [],
    runRecords: (session.runRecords ?? [])
      .map((run) => normalizeRunRecord(run, session, project))
      .slice(0, 24),
    artifacts: (session.artifacts ?? []).map((artifact) =>
      normalizeArtifact(artifact, session, project)
    ),
    modelPreference: normalizeSessionModelPreference(session.modelPreference),
    channel: normalizeSessionChannel(session.channel)
  };
}

function normalizeSessionChannel(value: unknown): SessionChannel | undefined {
  const source = normalizeRecord(value);
  if (!source) {
    return undefined;
  }
  const channelSource = asString(source.source).trim();
  const label = asString(source.label).trim();
  if (!channelSource || !label) {
    return undefined;
  }
  return {
    source: channelSource,
    label,
    external: source.external === true,
    lastActiveAt: normalizeTimestamp(asString(source.lastActiveAt)) ?? undefined,
    parentSessionId: asString(source.parentSessionId).trim() || undefined
  };
}

function normalizeSessionModelPreference(
  value: unknown
): SessionModelPreference | undefined {
  const source = normalizeRecord(value);
  if (!source) {
    return undefined;
  }

  const catalogModelId = asString(source.catalogModelId).trim();
  const selectModelId = asString(source.selectModelId).trim();
  if (!catalogModelId || !selectModelId) {
    return undefined;
  }

  const rawCatalogSource = asString(source.catalogSource).trim();
  const catalogSource =
    rawCatalogSource === "hermes-config" || rawCatalogSource === "ui-lmstudio" || rawCatalogSource === "ui-openrouter"
      ? rawCatalogSource
      : undefined;
  const rawSelectionScope = asString(source.selectionScope).trim();
  const selectionScope =
    rawSelectionScope === "session" || rawSelectionScope === "turn"
      ? rawSelectionScope
      : undefined;
  const selectedAt = normalizeTimestamp(source.selectedAt) || new Date().toISOString();
  const label = truncateText(asString(source.label), 120) || undefined;

  return {
    catalogModelId,
    catalogSource,
    label,
    provider: asString(source.provider).trim() || null,
    selectedAt,
    selectionScope,
    selectModelId
  };
}

function normalizeRunRecord(
  run: Partial<RunRecord>,
  session: Session,
  project?: Project
): RunRecord {
  const id = asString(run.id) || `run-${session.id}`;
  const startedAt = normalizeTimestamp(run.startedAt) || normalizeTimestamp(session.updatedAt) || new Date().toISOString();
  const completedAt = normalizeTimestamp(run.completedAt);
  const durationMs =
    typeof run.durationMs === "number" && Number.isFinite(run.durationMs)
      ? Math.max(0, Math.round(run.durationMs))
      : computeDurationMs(startedAt, completedAt);

  return {
    id,
    projectId: asString(run.projectId) || project?.id || session.projectId,
    sessionId: asString(run.sessionId) || session.id,
    hermesSessionId: asString(run.hermesSessionId) || session.hermesSessionId || `hermes-${session.id}`,
    hermesRunId: asString(run.hermesRunId) || undefined,
    userMessageId: asString(run.userMessageId) || undefined,
    assistantMessageId: asString(run.assistantMessageId) || undefined,
    sourceChannel: normalizeRunSourceChannel(run.sourceChannel),
    status: normalizeRunStatus(run.status),
    startedAt,
    completedAt,
    durationMs,
    stoppedByUser: run.stoppedByUser === true,
    modelLabel: asString(run.modelLabel) || undefined,
    providerLabel: asString(run.providerLabel) || undefined,
    summary: asString(run.summary) || undefined,
    metadata: normalizeRecord(run.metadata),
    activityEventIds: normalizeStringList(run.activityEventIds).slice(-80),
    activitySummary: normalizeActivitySummary(run.activitySummary),
    activityReplay: normalizePersistedActivityEvents(run.activityReplay, id)
  };
}

function normalizeArtifact(
  artifact: Partial<Artifact> & Record<string, unknown>,
  session: Session,
  project?: Project
): Artifact {
  const id = asString(artifact.id) || `artifact-${session.id}`;
  const title =
    asString(artifact.title) ||
    asString(artifact.name) ||
    asString(artifact.path) ||
    "Untitled artifact";
  const metadata = artifact.metadata && typeof artifact.metadata === "object" && !Array.isArray(artifact.metadata)
    ? artifact.metadata as Record<string, unknown>
    : undefined;

  return {
    id,
    projectId: asString(artifact.projectId) || project?.id || session.projectId,
    sessionId: asString(artifact.sessionId) || session.id,
    title,
    kind: normalizeArtifactKind(artifact.kind),
    source: normalizeArtifactSource(artifact.source),
    status: normalizeArtifactStatus(artifact.status),
    path: asString(artifact.path) || undefined,
    mimeType: asString(artifact.mimeType) || undefined,
    sizeBytes: typeof artifact.sizeBytes === "number" ? artifact.sizeBytes : undefined,
    createdAt: asString(artifact.createdAt) || undefined,
    updatedAt: asString(artifact.updatedAt) || undefined,
    summary: asString(artifact.summary) || undefined,
    activityEventId: asString(artifact.activityEventId) || undefined,
    metadata
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
  const weekMs = 7 * dayMs;

  if (diffMs < minuteMs) {
    return "now";
  }
  if (diffMs < hourMs) {
    return `${Math.floor(diffMs / minuteMs)}m`;
  }
  if (diffMs < dayMs) {
    return `${Math.floor(diffMs / hourMs)}h`;
  }
  if (diffMs < weekMs) {
    return `${Math.floor(diffMs / dayMs)}d`;
  }
  return `${Math.floor(diffMs / weekMs)}w`;
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

function makeProjectContextScope(project: Pick<Project, "id" | "name"> & Partial<Project>): ProjectContextScope {
  const stableProjectKey =
    project.contextScopeKey || makeProjectStableKey(DEFAULT_TENANT_ID, project.id);

  return {
    tenantId: DEFAULT_TENANT_ID,
    projectId: project.id,
    stableProjectKey,
    retrievalProfile: "balanced",
    contextPolicy: "balanced",
    userVisibleSummary: `${project.name} project context.`
  };
}

function makeSessionContextScope(args: {
  project?: Project;
  sessionId: string;
  title: string;
}): SessionContextScope {
  const tenantId = args.project?.contextScope.tenantId ?? DEFAULT_TENANT_ID;
  const projectId = args.project?.id ?? "project-unknown";

  return {
    tenantId,
    projectId,
    sessionId: args.sessionId,
    stableSessionKey: makeSessionStableKey(tenantId, projectId, args.sessionId),
    includeProjectContext: true,
    includeSessionContext: true,
    userVisibleSummary: `${args.title} session context.`
  };
}

function makeProjectStableKey(tenantId: string, projectId: string): string {
  return `stoix:${tenantId}:project:${projectId}`;
}

function makeSessionStableKey(tenantId: string, projectId: string, sessionId: string): string {
  return `stoix:${tenantId}:project:${projectId}:session:${sessionId}`;
}

function normalizeTenantId(value: string): string {
  const tenantId = value || DEFAULT_TENANT_ID;
  return LEGACY_LOCAL_TENANT_IDS.has(tenantId) ? DEFAULT_TENANT_ID : tenantId;
}

function normalizeProjectStableKey(
  value: string | undefined,
  tenantId: string,
  projectId: string
): string {
  const stableKey = value || "";
  const isLegacyStableKey = [...LEGACY_LOCAL_TENANT_IDS].some(
    (legacyTenantId) => stableKey === makeProjectStableKey(legacyTenantId, projectId)
  );
  if (!stableKey || isLegacyStableKey) {
    return makeProjectStableKey(tenantId, projectId);
  }
  return stableKey;
}

function normalizeSessionStableKey(
  value: string | undefined,
  tenantId: string,
  projectId: string,
  sessionId: string
): string {
  const stableKey = value || "";
  const isLegacyStableKey = [...LEGACY_LOCAL_TENANT_IDS].some(
    (legacyTenantId) =>
      stableKey === makeSessionStableKey(legacyTenantId, projectId, sessionId)
  );
  if (!stableKey || isLegacyStableKey) {
    return makeSessionStableKey(tenantId, projectId, sessionId);
  }
  return stableKey;
}

function normalizeArtifactKind(value: unknown): Artifact["kind"] {
  const normalized = asString(value).trim().toLowerCase().replace(/[\s_-]+/g, "-");
  if (
    normalized === "architecture" ||
    normalized === "code" ||
    normalized === "contract" ||
    normalized === "data" ||
    normalized === "design" ||
    normalized === "document" ||
    normalized === "image" ||
    normalized === "log" ||
    normalized === "report"
  ) {
    return normalized;
  }
  return "unknown";
}

function normalizeArtifactSource(value: unknown): Artifact["source"] {
  const normalized = asString(value).trim().toLowerCase();
  if (normalized.endsWith("-memory")) {
    return "mcp";
  }
  if (
    normalized === "hermes" ||
    normalized === "ui" ||
    normalized === "local" ||
    normalized === "mock"
  ) {
    return normalized;
  }
  return "mock";
}

function normalizeArtifactStatus(value: unknown): Artifact["status"] {
  const normalized = asString(value).trim().toLowerCase();
  if (
    normalized === "available" ||
    normalized === "pending" ||
    normalized === "unavailable" ||
    normalized === "error"
  ) {
    return normalized;
  }
  return "unavailable";
}

function normalizeRunStatus(value: unknown): RunRecord["status"] {
  const normalized = asString(value).trim().toLowerCase();
  if (
    normalized === "running" ||
    normalized === "completed" ||
    normalized === "stopped" ||
    normalized === "failed" ||
    normalized === "cancelled"
  ) {
    return normalized;
  }
  return "completed";
}

function normalizeRunSourceChannel(value: unknown): RunRecord["sourceChannel"] {
  const normalized = asString(value).trim().toLowerCase().replace(/[\s_]+/g, "-");
  if (
    normalized === "web-ui" ||
    normalized === "telegram" ||
    normalized === "cli" ||
    normalized === "api" ||
    normalized === "unknown"
  ) {
    return normalized;
  }
  return "unknown";
}

function normalizeActivitySummary(value: unknown): RunActivitySummary {
  const source =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Partial<RunActivitySummary>)
      : {};
  return {
    approvalCount: normalizeCount(source.approvalCount),
    commandCount: normalizeCount(source.commandCount),
    errorCount: normalizeCount(source.errorCount),
    memoryCount: normalizeCount(source.memoryCount),
    toolCount: normalizeCount(source.toolCount)
  };
}

function normalizePersistedActivityEvents(
  value: unknown,
  runId: string
): PersistedActivityEvent[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((event) => normalizePersistedActivityEvent(event, runId))
    .filter((event): event is PersistedActivityEvent => Boolean(event))
    .slice(-40);
}

function normalizePersistedActivityEvent(
  value: unknown,
  runId: string
): PersistedActivityEvent | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const source = value as Partial<PersistedActivityEvent>;
  const id = asString(source.id);
  const title = truncateText(asString(source.title), 160);
  if (!id || !title) {
    return null;
  }

  return {
    id,
    runId: asString(source.runId) || runId,
    type: normalizePersistedActivityType(source.type),
    status: normalizePersistedActivityStatus(source.status),
    title,
    summary: truncateText(asString(source.summary), 900) || undefined,
    startedAt: normalizeTimestamp(source.startedAt),
    completedAt: normalizeTimestamp(source.completedAt),
    durationMs: normalizeOptionalCount(source.durationMs),
    collapsedByDefault: source.collapsedByDefault !== false,
    source: normalizePersistedActivitySource(source.source),
    sourceChannel: normalizeRunSourceChannel(source.sourceChannel),
    hermes: normalizeHermesReplay(source.hermes),
    memory: normalizeMemoryReplay(source.memory),
    command: normalizeCommandReplay(source.command),
    approval: normalizeApprovalReplay(source.approval),
    artifact: normalizeArtifactReplay(source.artifact),
    detailsPreview: truncateText(asString(source.detailsPreview), 1400) || undefined,
    metadata: normalizePersistedMetadata(source.metadata)
  };
}

function normalizeCount(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
}

function normalizeOptionalCount(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.round(value)) : undefined;
}

function normalizePersistedActivityType(value: unknown): PersistedActivityEvent["type"] {
  const normalized = asString(value).trim().toLowerCase();
  if (
    normalized === "narration" ||
    normalized === "reasoning" ||
    normalized === "command" ||
    normalized === "tool" ||
    normalized === "memory" ||
    normalized === "file" ||
    normalized === "approval" ||
    normalized === "error" ||
    normalized === "elapsed" ||
    normalized === "status" ||
    normalized === "stream"
  ) {
    return normalized;
  }
  return "status";
}

function normalizePersistedActivityStatus(value: unknown): PersistedActivityEvent["status"] {
  const normalized = asString(value).trim().toLowerCase();
  if (
    normalized === "queued" ||
    normalized === "running" ||
    normalized === "completed" ||
    normalized === "failed" ||
    normalized === "cancelled" ||
    normalized === "waiting_for_approval" ||
    normalized === "info"
  ) {
    return normalized;
  }
  return "info";
}

function normalizePersistedActivitySource(value: unknown): PersistedActivityEvent["source"] {
  const normalized = asString(value).trim().toLowerCase();
  if (normalized.endsWith("-memory")) {
    return "mcp";
  }
  if (
    normalized === "hermes" ||
    normalized === "ui" ||
    normalized === "mcp" ||
    normalized === "unknown"
  ) {
    return normalized;
  }
  return "unknown";
}

function normalizeHermesReplay(value: unknown): PersistedActivityEvent["hermes"] {
  const source = normalizeRecord(value);
  if (!source) {
    return undefined;
  }
  return compactRecord({
    eventType: asString(source.eventType),
    runId: asString(source.runId),
    sessionId: asString(source.sessionId),
    toolCallId: asString(source.toolCallId),
    toolName: asString(source.toolName)
  });
}

function normalizeMemoryReplay(value: unknown): PersistedActivityEvent["memory"] {
  const source = normalizeRecord(value);
  if (!source) {
    return undefined;
  }
  return compactRecord({
    memoryId: asString(source.memoryId),
    operation: asString(source.operation),
    projectKey: asString(source.projectKey),
    scopeStatus: asString(source.scopeStatus),
    sessionKey: asString(source.sessionKey)
  });
}

function normalizeCommandReplay(value: unknown): PersistedActivityEvent["command"] {
  const source = normalizeRecord(value);
  if (!source) {
    return undefined;
  }
  return compactRecord({
    commandPreview: truncateText(asString(source.commandPreview), 900),
    cwd: truncateText(asString(source.cwd), 512),
    exitCode: typeof source.exitCode === "number" && Number.isFinite(source.exitCode) ? source.exitCode : undefined,
    outputPreview: truncateText(asString(source.outputPreview), 900),
    sourceChannel: asString(source.sourceChannel) ? normalizeRunSourceChannel(source.sourceChannel) : undefined,
    stderrPreview: truncateText(asString(source.stderrPreview), 900),
    stdoutPreview: truncateText(asString(source.stdoutPreview), 900),
    truncated: source.truncated === true ? true : undefined
  });
}

function normalizeApprovalReplay(value: unknown): PersistedActivityEvent["approval"] {
  const source = normalizeRecord(value);
  if (!source) {
    return undefined;
  }
  return compactRecord({
    approvalId: asString(source.approvalId),
    decision: asString(source.decision),
    requestedAction: asString(source.requestedAction),
    riskLevel: asString(source.riskLevel)
  });
}

function normalizeArtifactReplay(value: unknown): PersistedActivityEvent["artifact"] {
  const source = normalizeRecord(value);
  if (!source) {
    return undefined;
  }
  return compactRecord({
    fileId: asString(source.fileId),
    kind: asString(source.kind),
    path: truncateText(asString(source.path), 512)
  });
}

function compactRecord<T extends Record<string, unknown>>(value: T): T | undefined {
  const entries = Object.entries(value).filter(([, child]) => child !== undefined && child !== "");
  return entries.length > 0 ? Object.fromEntries(entries) as T : undefined;
}

function normalizeStringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function normalizeRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function normalizePersistedMetadata(value: unknown): Record<string, unknown> | undefined {
  const source = normalizeRecord(value);
  if (!source) {
    return undefined;
  }
  const entries = Object.entries(source)
    .slice(0, 16)
    .map(([key, child]) => [
      key,
      SECRET_KEY_PATTERN.test(key) ? "[redacted]" : normalizePersistedMetadataValue(child)
    ] as const)
    .filter(([, child]) => child !== undefined);
  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

function normalizePersistedMetadataValue(value: unknown): unknown {
  if (typeof value === "string") {
    return truncateText(value, 900);
  }
  if (typeof value === "number" || typeof value === "boolean" || value === null) {
    return value;
  }
  if (Array.isArray(value)) {
    return value.slice(0, 12).map((item) => normalizePersistedMetadataValue(item));
  }
  if (value && typeof value === "object") {
    return truncateText(JSON.stringify(value), 900);
  }
  return undefined;
}

function normalizeTimestamp(value: unknown): string | undefined {
  const text = asString(value);
  return text && Number.isFinite(Date.parse(text)) ? text : undefined;
}

function truncateText(value: string, maxLength: number): string {
  const clean = redactText(value).trim();
  if (!clean) {
    return "";
  }
  return clean.length > maxLength
    ? `${clean.slice(0, Math.max(0, maxLength - 14))}\n... truncated`
    : clean;
}

function redactText(value: string) {
  return value.replace(BEARER_VALUE_PATTERN, "Bearer [redacted]");
}

function computeDurationMs(startedAt?: string, completedAt?: string) {
  if (!startedAt || !completedAt) {
    return undefined;
  }
  const durationMs = Date.parse(completedAt) - Date.parse(startedAt);
  return Number.isFinite(durationMs) && durationMs >= 0 ? durationMs : undefined;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
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

export function shouldGenerateSessionTitle(session: Session): boolean {
  const titleSource = session.titleSource ?? normalizeTitleSource(session);
  return (
    titleSource === "default" &&
    isDefaultSessionTitle(session.title) &&
    !session.titleGenerationRequestedAt &&
    !session.messages.some((message) => message.role === "user")
  );
}

function appendMessageToSession(
  session: Session,
  message: ChatMessage,
  now: string,
  viewed: boolean
): Session {
  const titleSource = session.titleSource ?? normalizeTitleSource(session);
  const isFirstUserMessage =
    message.role === "user" &&
    !session.messages.some((item) => item.role === "user");

  return {
    ...session,
    messages: [...session.messages, message],
    summary:
      session.messages.length === 0 && message.role === "user"
        ? summarizeMessage(message.content)
        : session.summary,
    title: session.title,
    titleSource,
    firstUserMessageAt:
      isFirstUserMessage && !session.firstUserMessageAt ? now : session.firstUserMessageAt,
    updatedAt: now,
    lastViewedAt: viewed ? now : session.lastViewedAt
  };
}

function markSessionViewed(sessions: Session[], sessionId: string, viewedAt: string): Session[] {
  return sessions.map((session) =>
    session.id === sessionId ? { ...session, lastViewedAt: viewedAt } : session
  );
}

function normalizeTitleSource(session: Session): NonNullable<Session["titleSource"]> {
  if (session.titleSource === "model") {
    return "model";
  }
  const firstUserMessage = session.messages?.find((message) => message.role === "user");
  if (firstUserMessage) {
    const generatedTitle = summarizeTitle(firstUserMessage.content);
    const legacyGeneratedTitle = summarizeLegacyTitle(firstUserMessage.content);
    const legacyOverflowTitle =
      legacyGeneratedTitle.length > 34
        ? `${legacyGeneratedTitle.slice(0, 31).trimEnd()}...`
        : legacyGeneratedTitle;
    if (
      session.title === generatedTitle ||
      session.title === legacyGeneratedTitle ||
      session.title === legacyOverflowTitle
    ) {
      return "first-message";
    }
  }

  if (session.titleSource) {
    return session.titleSource;
  }
  if (isDefaultSessionTitle(session.title)) {
    return "default";
  }

  return "manual";
}

function summarizeTitle(content: string): string {
  const clean = cleanTitleContent(content);
  const commandTitle = summarizeCommandTitle(clean);
  if (commandTitle) {
    return commandTitle;
  }

  const compact = compactTitleContent(clean);
  if (!compact) {
    return "New chat";
  }

  const inquiryTitle = summarizeInquiryTitle(clean, compact);
  if (inquiryTitle) {
    return inquiryTitle;
  }

  return shortenTitlePhrase(compact);
}

function summarizeLegacyTitle(content: string): string {
  const clean = cleanTitleContent(content);
  const commandTitle = summarizeLegacyCommandTitle(clean);
  if (commandTitle) {
    return commandTitle;
  }

  const compact = compactTitleContent(clean);
  if (!compact) {
    return "New chat";
  }

  const title = `${compact[0].toUpperCase()}${compact.slice(1)}`;
  return title.slice(0, 160).trimEnd();
}

function cleanTitleContent(content: string) {
  return content
    .replace(/^(please\s+)?(can|could|would)\s+you\s+/i, "")
    .replace(/^(please\s+)/i, "")
    .replace(/\b(in|under)\s+\d+\s+(words?|sentences?|chars?|characters?)\b/gi, "")
    .replace(/\b(done|thanks|thank you)\b[.!?:;,\s]*/gi, " ")
    .replace(/[`"'()[\]{}<>]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function compactTitleContent(content: string) {
  const firstSentence = content
    .split(/[.!?\n]/)
    .map((part) => part.trim())
    .find(Boolean) ?? content;
  return firstSentence
    .replace(/^(i\s+need\s+to|i\s+need|we\s+need\s+to|we\s+need|let'?s|please)\s+/i, "")
    .replace(/\b(the|this|that|below|following)\b\s*$/i, "")
    .replace(/[?!.,:;]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function summarizeInquiryTitle(content: string, compact: string): string | null {
  if (!/^(how|what|which|who|when|where|why|is|are|do|does|did|will|should)\b/i.test(content)) {
    return null;
  }

  if (/\b(?:conc[a-z]*rent|concurrency)\b/i.test(compact) && /\btasks?\b/i.test(compact)) {
    return "Concurrent tasks inquiry";
  }
  if (/\bmodels?\b/i.test(compact)) {
    return "Model inquiry";
  }

  const topic = compact
    .replace(/^(?:how\s+(?:many|much|does|do|did|can|could|should|would|is|are|to)|what\s+(?:is|are|was|were|does|do|did|can|could|should|would)|which|who|when|where|why|is|are|do|does|did|will|should)\s+/i, "")
    .replace(/\b(?:can|could|would|should|does|do|did|is|are|will)\b.*$/i, "")
    .trim();
  return topic ? shortenTitlePhrase(`${topic} inquiry`, 3, 36) : "General inquiry";
}

function summarizeCommandTitle(content: string): string | null {
  if (/^open\b/i.test(content) && /\btab\b/i.test(content) && /\bchrome\b/i.test(content)) {
    return "Open Chrome tab";
  }
  if (/^open\b/i.test(content) && /\btab\b/i.test(content) && /\bbrowser\b/i.test(content)) {
    return "Open browser tab";
  }
  return summarizeLegacyCommandTitle(content);
}

function summarizeLegacyCommandTitle(content: string): string | null {
  const lower = content.toLowerCase();
  if (/\b(summarise|summarize|summary)\b/.test(lower)) {
    return "Summarize text";
  }
  if (/\b(audit|review|inspect)\b/.test(lower)) {
    return "Audit request";
  }
  if (/\b(fix|repair|resolve)\b/.test(lower)) {
    return "Fix issue";
  }
  if (/\b(add|create|build|implement)\b/.test(lower)) {
    return "Add feature";
  }
  if (/\b(remove|delete)\b/.test(lower)) {
    return "Remove item";
  }
  if (/\b(explain|describe)\b/.test(lower)) {
    return "Explain topic";
  }
  return null;
}

function shortenTitlePhrase(value: string, maxWords = 4, maxCharacters = 36) {
  const words = value.split(/\s+/).filter(Boolean).slice(0, maxWords);
  while (words.length > 1 && words.join(" ").length > maxCharacters) {
    words.pop();
  }
  const title = words.join(" ").slice(0, maxCharacters).trimEnd();
  return title ? `${title[0].toUpperCase()}${title.slice(1)}` : "New chat";
}

function summarizeMessage(content: string): string {
  const clean = content.replace(/\s+/g, " ").trim();
  return clean.length > 80 ? `${clean.slice(0, 77)}...` : clean || "New chat";
}
