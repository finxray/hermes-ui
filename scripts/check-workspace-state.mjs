import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import { registerHooks } from "node:module";

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (
      specifier === "../data/mockWorkspace" &&
      context.parentURL?.endsWith("/apps/web/src/lib/workspaceStore.ts")
    ) {
      return nextResolve("../data/mockWorkspace.ts", context);
    }
    return nextResolve(specifier, context);
  }
});

const workspaceStore = await import(
  pathToFileURL("apps/web/src/lib/workspaceStore.ts").toString()
);
const { createMockWorkspaceState, getVisibleSessions, workspaceReducer } = workspaceStore;

const base = createMockWorkspaceState();

checkRenamePreservesStableKeys();
checkUniqueDefaultTitles();
checkFirstUserMessageTitleCleanup();
checkActiveStateRepair();
checkNormalizationFillsMemoryScopes();
checkArchiveRepairsActiveSession();
checkResetReturnsValidState();

console.log("Workspace state checks passed.");

function checkRenamePreservesStableKeys() {
  const project = base.projects[0];
  const session = base.sessions.find((item) => item.projectId === project.id);
  assert(session, "mock workspace should include a session for the first project");

  let state = workspaceReducer(base, {
    type: "renameProject",
    projectId: project.id,
    name: "Renamed Brain Memory"
  });
  state = workspaceReducer(state, {
    type: "renameSession",
    sessionId: session.id,
    title: "Renamed Session"
  });

  const renamedProject = state.projects.find((item) => item.id === project.id);
  const renamedSession = state.sessions.find((item) => item.id === session.id);
  assert.equal(renamedProject?.memoryScope.stableProjectKey, project.memoryScope.stableProjectKey);
  assert.equal(renamedProject?.memoryScopeKey, project.memoryScopeKey);
  assert.equal(renamedSession?.memoryScope.stableSessionKey, session.memoryScope.stableSessionKey);
  assert.equal(renamedSession?.hermesSessionId, session.hermesSessionId);
}

function checkUniqueDefaultTitles() {
  let state = workspaceReducer(base, { type: "createProject" });
  const firstProject = state.projects[0];
  state = workspaceReducer(state, { type: "createProject" });
  const secondProject = state.projects[0];
  assert.equal(firstProject.name, "Untitled project");
  assert.equal(secondProject.name, "Untitled project 2");
  assert.notEqual(
    firstProject.memoryScope.stableProjectKey,
    secondProject.memoryScope.stableProjectKey
  );

  state = workspaceReducer(state, { type: "switchProject", projectId: secondProject.id });
  state = workspaceReducer(state, { type: "createSession" });
  const firstSession = state.sessions[0];
  state = workspaceReducer(state, { type: "createSession" });
  const secondSession = state.sessions[0];
  assert.equal(firstSession.title, "New chat");
  assert.equal(secondSession.title, "New chat 2");
  assert.notEqual(
    firstSession.memoryScope.stableSessionKey,
    secondSession.memoryScope.stableSessionKey
  );
}

function checkFirstUserMessageTitleCleanup() {
  let state = workspaceReducer(base, { type: "createSession" });
  const session = state.sessions[0];
  const stableSessionKey = session.memoryScope.stableSessionKey;
  const hermesSessionId = session.hermesSessionId;

  state = workspaceReducer(state, {
    type: "appendMessage",
    sessionId: session.id,
    message: {
      id: "msg-check-title",
      role: "user",
      author: "Alexey",
      createdAt: "12:00",
      content: "Can you verify memory scope?",
      status: "complete"
    }
  });

  const updated = state.sessions.find((item) => item.id === session.id);
  assert.equal(updated?.title, "Verify memory scope");
  assert.equal(updated?.memoryScope.stableSessionKey, stableSessionKey);
  assert.equal(updated?.hermesSessionId, hermesSessionId);
}

function checkActiveStateRepair() {
  const broken = {
    ...base,
    activeProjectId: "missing-project",
    activeSessionId: "missing-session"
  };
  const normalized = workspaceReducer(base, { type: "hydrate", state: broken });
  assert(normalized.projects.some((project) => project.id === normalized.activeProjectId));
  if (normalized.activeSessionId) {
    assert(
      normalized.sessions.some(
        (session) => session.id === normalized.activeSessionId && !session.archivedAt
      )
    );
  }
}

function checkNormalizationFillsMemoryScopes() {
  const legacy = structuredClone(base);
  delete legacy.projects[0].memoryScope;
  legacy.projects[0].memoryScopeKey = "";
  delete legacy.sessions[0].memoryScope;
  legacy.sessions[0].hermesSessionId = "";

  const normalized = workspaceReducer(base, { type: "hydrate", state: legacy });
  assert(normalized.projects[0].memoryScope.stableProjectKey);
  assert(normalized.projects[0].memoryScopeKey);
  assert(normalized.sessions[0].memoryScope.stableSessionKey);
  assert(normalized.sessions[0].hermesSessionId);
}

function checkArchiveRepairsActiveSession() {
  const project = base.projects[0];
  const visible = getVisibleSessions(base, project.id);
  assert(visible.length > 0);
  const active = visible[0];
  const state = workspaceReducer(
    { ...base, activeProjectId: project.id, activeSessionId: active.id },
    { type: "archiveSession", sessionId: active.id }
  );

  assert.notEqual(state.activeSessionId, active.id);
  if (state.activeSessionId) {
    const next = state.sessions.find((session) => session.id === state.activeSessionId);
    assert.equal(next?.projectId, project.id);
    assert.equal(Boolean(next?.archivedAt), false);
  }
}

function checkResetReturnsValidState() {
  const state = workspaceReducer(base, { type: "reset" });
  assert(state.projects.some((project) => project.id === state.activeProjectId));
  assert(
    state.activeSessionId === null ||
      state.sessions.some((session) => session.id === state.activeSessionId && !session.archivedAt)
  );
}
