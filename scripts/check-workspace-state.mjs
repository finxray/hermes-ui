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
const memoryScopeBridge = await import(
  pathToFileURL("apps/web/src/lib/memoryScopeBridge.ts").toString()
);
const replayHelpers = await import(
  pathToFileURL("apps/web/src/lib/persistedActivityReplay.ts").toString()
);
const {
  DEFAULT_TENANT_ID,
  createMockWorkspaceState,
  formatSessionUpdatedAt,
  getVisibleSessions,
  workspaceReducer
} = workspaceStore;
const { buildMemoryScopeBridgeInstruction } = memoryScopeBridge;
const { createSessionExportPreview } = replayHelpers;

const base = createMockWorkspaceState();

checkRenamePreservesStableKeys();
checkUniqueDefaultTitles();
checkFirstUserMessageTitleCleanup();
checkManualRenameWins();
checkUpdatedAtAndSorting();
checkDerivedTimestampFormatting();
checkActiveStateRepair();
checkDefaultTenant();
checkLegacyTenantNormalization();
checkMemoryScopeBridgeTenant();
checkNormalizationFillsMemoryScopes();
checkNormalizationFillsTitleMetadata();
checkRunRecordPersistence();
checkSessionExportPreview();
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
  assert.equal(renamedSession?.titleSource, "manual");
  assert(renamedSession?.renamedAt, "manual rename should record renamedAt");
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
  assert.equal(updated?.titleSource, "first-message");
  assert(updated?.firstUserMessageAt, "first-message auto-title should record firstUserMessageAt");
  assert.equal(updated?.memoryScope.stableSessionKey, stableSessionKey);
  assert.equal(updated?.hermesSessionId, hermesSessionId);
}

function checkManualRenameWins() {
  let state = workspaceReducer(base, { type: "createSession" });
  const session = state.sessions[0];
  const stableSessionKey = session.memoryScope.stableSessionKey;
  const hermesSessionId = session.hermesSessionId;

  state = workspaceReducer(state, {
    type: "renameSession",
    sessionId: session.id,
    title: "Manual session name"
  });
  state = workspaceReducer(state, {
    type: "appendMessage",
    sessionId: session.id,
    message: {
      id: "msg-manual-wins",
      role: "user",
      author: "Alexey",
      createdAt: "12:01",
      content: "Can you overwrite this title?",
      status: "complete"
    }
  });

  const updated = state.sessions.find((item) => item.id === session.id);
  assert.equal(updated?.title, "Manual session name");
  assert.equal(updated?.titleSource, "manual");
  assert.equal(updated?.memoryScope.stableSessionKey, stableSessionKey);
  assert.equal(updated?.hermesSessionId, hermesSessionId);
}

function checkUpdatedAtAndSorting() {
  const project = base.projects[0];
  const session = base.sessions.find((item) => item.projectId === project.id);
  assert(session, "mock workspace should include a session for updatedAt checks");
  const previousUpdatedAt = session.updatedAt;

  let state = workspaceReducer(base, {
    type: "appendMessage",
    sessionId: session.id,
    message: {
      id: "msg-updated-at",
      role: "user",
      author: "Alexey",
      createdAt: "12:02",
      content: "Touch this session ordering.",
      status: "complete"
    }
  });
  const updated = state.sessions.find((item) => item.id === session.id);
  assert(updated?.updatedAt);
  assert.notEqual(updated?.updatedAt, previousUpdatedAt);

  const older = {
    ...session,
    id: "session-order-older",
    updatedAt: "2026-05-29T08:00:00.000Z"
  };
  const newer = {
    ...session,
    id: "session-order-newer",
    updatedAt: "2026-05-29T12:00:00.000Z"
  };
  state = {
    ...base,
    sessions: [older, newer],
    activeProjectId: project.id,
    activeSessionId: older.id
  };
  const visible = getVisibleSessions(state, project.id);
  assert.equal(visible[0]?.id, newer.id);
  assert.equal(visible[1]?.id, older.id);
}

function checkDerivedTimestampFormatting() {
  const now = Date.parse("2026-05-30T12:00:00.000Z");
  assert.equal(formatSessionUpdatedAt("2026-05-30T11:59:30.000Z", now), "now");
  assert.equal(formatSessionUpdatedAt("2026-05-30T11:30:00.000Z", now), "30min");
  assert.equal(formatSessionUpdatedAt("2026-05-30T07:00:00.000Z", now), "5h");
  assert.equal(formatSessionUpdatedAt("2026-05-29T12:00:00.000Z", now), "1d");
  assert.equal(formatSessionUpdatedAt("2026-05-28T12:00:00.000Z", now), "2d");
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

function checkDefaultTenant() {
  assert.equal(DEFAULT_TENANT_ID, "local-dev");
  assert.notEqual(DEFAULT_TENANT_ID, "*");
  assert.equal(base.projects[0].memoryScope.tenantId, DEFAULT_TENANT_ID);
  assert.equal(base.sessions[0].memoryScope.tenantId, DEFAULT_TENANT_ID);
  assert(base.projects[0].memoryScope.stableProjectKey.includes("studio:local-dev:project:"));
  assert(base.sessions[0].memoryScope.stableSessionKey.includes("studio:local-dev:project:"));
}

function checkLegacyTenantNormalization() {
  const legacy = structuredClone(base);
  const project = legacy.projects[0];
  const session = legacy.sessions.find((item) => item.projectId === project.id);
  assert(session, "legacy normalization check needs a project session");

  const projectId = project.id;
  const sessionId = session.id;
  const projectTitle = project.name;
  const sessionTitle = session.title;
  const hermesSessionId = session.hermesSessionId;

  project.memoryScopeKey = `studio:tenant-local:project:${projectId}`;
  project.memoryScope.tenantId = "tenant-local";
  project.memoryScope.stableProjectKey = `studio:tenant-local:project:${projectId}`;
  session.memoryScope.tenantId = "tenant-local";
  session.memoryScope.stableSessionKey =
    `studio:tenant-local:project:${projectId}:session:${sessionId}`;

  const normalized = workspaceReducer(base, { type: "hydrate", state: legacy });
  const normalizedProject = normalized.projects.find((item) => item.id === projectId);
  const normalizedSession = normalized.sessions.find((item) => item.id === sessionId);

  assert.equal(normalizedProject?.id, projectId);
  assert.equal(normalizedProject?.name, projectTitle);
  assert.equal(normalizedProject?.memoryScope.tenantId, DEFAULT_TENANT_ID);
  assert.equal(
    normalizedProject?.memoryScope.stableProjectKey,
    `studio:local-dev:project:${projectId}`
  );
  assert.equal(normalizedProject?.memoryScopeKey, `studio:local-dev:project:${projectId}`);
  assert.equal(normalizedSession?.id, sessionId);
  assert.equal(normalizedSession?.title, sessionTitle);
  assert.equal(normalizedSession?.hermesSessionId, hermesSessionId);
  assert.equal(normalizedSession?.memoryScope.tenantId, DEFAULT_TENANT_ID);
  assert.equal(
    normalizedSession?.memoryScope.stableSessionKey,
    `studio:local-dev:project:${projectId}:session:${sessionId}`
  );
}

function checkMemoryScopeBridgeTenant() {
  const project = base.projects[0];
  const session = base.sessions.find((item) => item.projectId === project.id);
  assert(session, "memory scope bridge check needs a project session");

  const instruction = buildMemoryScopeBridgeInstruction({
    project: {
      id: project.id,
      title: project.name,
      stableKey: project.memoryScope.stableProjectKey,
      tenantId: project.memoryScope.tenantId,
      retrievalProfile: project.memoryScope.retrievalProfile,
      contextPolicy: project.memoryScope.contextPolicy,
      pinnedMemoryIds: project.memoryScope.pinnedMemoryIds
    },
    session: {
      id: session.id,
      title: session.title,
      stableKey: session.memoryScope.stableSessionKey,
      hermesSessionId: session.hermesSessionId,
      includeProjectContext: session.memoryScope.includeProjectContext,
      includeSessionContext: session.memoryScope.includeSessionContext
    },
    ui: {
      source: "hermes-ui",
      workspaceVersion: 1
    }
  });

  assert(instruction.includes("- tenantId: local-dev"));
  assert(instruction.includes(`projectKey="${project.memoryScope.stableProjectKey}"`));
  assert(instruction.includes(`sessionKey="${session.memoryScope.stableSessionKey}"`));
  assert(!instruction.includes("tenant-local"));
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
  assert.equal(
    normalized.sessions[0].memoryScope.stableSessionKey.includes(normalized.sessions[0].id),
    true
  );
}

function checkNormalizationFillsTitleMetadata() {
  const defaultLegacy = structuredClone(base);
  defaultLegacy.sessions[0].title = "New chat 7";
  delete defaultLegacy.sessions[0].titleSource;

  const defaultNormalized = workspaceReducer(base, { type: "hydrate", state: defaultLegacy });
  assert.equal(defaultNormalized.sessions[0].titleSource, "default");

  const manualLegacy = structuredClone(base);
  delete manualLegacy.sessions[0].titleSource;
  manualLegacy.sessions[0].title = "User chosen title";

  const manualNormalized = workspaceReducer(base, { type: "hydrate", state: manualLegacy });
  assert.equal(manualNormalized.sessions[0].titleSource, "manual");
}

function checkRunRecordPersistence() {
  let state = workspaceReducer(base, { type: "createSession" });
  const session = state.sessions[0];
  const stableSessionKey = session.memoryScope.stableSessionKey;
  const hermesSessionId = session.hermesSessionId;
  const stableProjectKey = state.projects.find((project) => project.id === session.projectId)
    ?.memoryScope.stableProjectKey;
  const startedAt = "2026-05-30T10:00:00.000Z";
  const completedAt = "2026-05-30T10:00:03.500Z";

  state = workspaceReducer(state, {
    type: "appendRunRecord",
    sessionId: session.id,
    run: {
      id: "run-check",
      projectId: session.projectId,
      sessionId: session.id,
      hermesSessionId,
      userMessageId: "msg-user-check",
      assistantMessageId: "msg-assistant-check",
      sourceChannel: "web-ui",
      status: "running",
      startedAt,
      modelLabel: "Hermes default",
      providerLabel: "Hermes server config",
      summary: "Check local run persistence",
      activityEventIds: [],
      activityReplay: [],
      activitySummary: {
        approvalCount: 0,
        commandCount: 0,
        errorCount: 0,
        memoryCount: 0,
        toolCount: 0
      }
    }
  });

  let updated = state.sessions.find((item) => item.id === session.id);
  assert.equal(updated?.runRecords.length, 1);
  assert.equal(updated?.runRecords[0].status, "running");
  assert.equal(updated?.runRecords[0].sourceChannel, "web-ui");

  state = workspaceReducer(state, {
    type: "updateRunRecord",
    sessionId: session.id,
    runId: "run-check",
    patch: {
      activityEventIds: ["activity-tool", "activity-memory", "activity-command"],
      activityReplay: [
        {
          id: "activity-command",
          runId: "run-check",
          type: "command",
          status: "completed",
          title: "Command completed",
          summary: "Authorization: Bearer abc123",
          collapsedByDefault: true,
          source: "mcp",
          sourceChannel: "web-ui",
          command: {
            commandPreview: "npm test",
            cwd: "C:/repo",
            exitCode: 0,
            stdoutPreview: `${"ok\n".repeat(300)}Authorization: Bearer abc123`,
            sourceChannel: "web-ui"
          },
          detailsPreview: "token=Bearer abc123",
          metadata: {
            api_key: "secret",
            source_channel: "web-ui"
          }
        }
      ],
      activitySummary: {
        approvalCount: 1,
        commandCount: 1,
        errorCount: 0,
        memoryCount: 1,
        toolCount: 1
      },
      completedAt,
      durationMs: 3500,
      hermesRunId: "hermes-run-check",
      status: "completed"
    }
  });

  updated = state.sessions.find((item) => item.id === session.id);
  assert.equal(updated?.runRecords[0].status, "completed");
  assert.equal(updated?.runRecords[0].durationMs, 3500);
  assert.equal(updated?.runRecords[0].activitySummary.memoryCount, 1);
  assert.equal(updated?.runRecords[0].activityReplay.length, 1);
  assert.equal(updated?.runRecords[0].activityReplay[0].sourceChannel, "web-ui");
  assert.equal(updated?.runRecords[0].activityReplay[0].metadata?.api_key, "[redacted]");
  assert(!JSON.stringify(updated?.runRecords[0].activityReplay).includes("abc123"));
  assert.equal(updated?.runRecords[0].hermesRunId, "hermes-run-check");
  assert.equal(updated?.memoryScope.stableSessionKey, stableSessionKey);
  assert.equal(updated?.hermesSessionId, hermesSessionId);
  assert.equal(
    state.projects.find((project) => project.id === session.projectId)?.memoryScope.stableProjectKey,
    stableProjectKey
  );

  state = workspaceReducer(state, {
    type: "updateRunRecord",
    sessionId: session.id,
    runId: "run-check",
    patch: {
      completedAt,
      status: "stopped",
      stoppedByUser: true
    }
  });
  updated = state.sessions.find((item) => item.id === session.id);
  assert.equal(updated?.runRecords[0].status, "stopped");
  assert.equal(updated?.runRecords[0].stoppedByUser, true);

  state = workspaceReducer(state, {
    type: "updateRunRecord",
    sessionId: session.id,
    runId: "run-check",
    patch: {
      status: "failed",
      summary: "Hermes stream failed."
    }
  });
  updated = state.sessions.find((item) => item.id === session.id);
  assert.equal(updated?.runRecords[0].status, "failed");
  assert.equal(updated?.runRecords[0].summary, "Hermes stream failed.");

  const legacy = structuredClone(base);
  delete legacy.sessions[0].runRecords;
  const normalizedLegacy = workspaceReducer(base, { type: "hydrate", state: legacy });
  assert.deepEqual(normalizedLegacy.sessions[0].runRecords, []);

  const malformed = structuredClone(base);
  malformed.sessions[0].runRecords = [
    {
      id: "run-malformed",
      startedAt: "bad date",
      status: "surprising",
      sourceChannel: "unsupported",
      activitySummary: {
        commandCount: 2
      },
      activityEventIds: ["activity-1"],
      activityReplay: [
        {
          id: "activity-1",
          runId: "run-malformed",
          type: "bad",
          status: "bad",
          title: "Replay with Authorization: Bearer abc123",
          collapsedByDefault: true,
          source: "bad",
          sourceChannel: "telegram",
          detailsPreview: "Authorization: Bearer abc123"
        }
      ]
    }
  ];
  const normalizedMalformed = workspaceReducer(base, { type: "hydrate", state: malformed });
  assert.equal(normalizedMalformed.sessions[0].runRecords[0].status, "completed");
  assert.equal(normalizedMalformed.sessions[0].runRecords[0].sourceChannel, "unknown");
  assert.equal(normalizedMalformed.sessions[0].runRecords[0].activitySummary.commandCount, 2);
  assert.equal(normalizedMalformed.sessions[0].runRecords[0].activityReplay[0].type, "status");
  assert.equal(normalizedMalformed.sessions[0].runRecords[0].activityReplay[0].status, "info");
  assert.equal(normalizedMalformed.sessions[0].runRecords[0].activityReplay[0].sourceChannel, "telegram");
  assert(!JSON.stringify(normalizedMalformed.sessions[0].runRecords[0].activityReplay).includes("abc123"));
}

function checkSessionExportPreview() {
  let state = workspaceReducer(base, { type: "createSession" });
  const session = state.sessions[0];
  const startedAt = "2026-05-30T11:00:00.000Z";
  const completedAt = "2026-05-30T11:00:02.000Z";

  state = workspaceReducer(state, {
    type: "appendMessage",
    sessionId: session.id,
    message: {
      id: "msg-export-secret",
      role: "user",
      author: "Alexey",
      createdAt: "11:00",
      content: "Please redact Authorization: Bearer abc123 and token=abc123 in export preview.",
      status: "complete"
    }
  });

  state = workspaceReducer(state, {
    type: "appendRunRecord",
    sessionId: session.id,
    run: {
      id: "run-export-preview",
      projectId: session.projectId,
      sessionId: session.id,
      hermesSessionId: session.hermesSessionId,
      userMessageId: "msg-export-secret",
      assistantMessageId: "msg-export-assistant",
      sourceChannel: "web-ui",
      status: "completed",
      startedAt,
      completedAt,
      durationMs: 2000,
      summary: "Export preview run",
      activityEventIds: ["activity-export-command"],
      activityReplay: [
        {
          id: "activity-export-command",
          runId: "run-export-preview",
          type: "command",
          status: "completed",
          title: "Command completed",
          summary: "Authorization: Bearer abc123",
          startedAt,
          completedAt,
          durationMs: 2000,
          collapsedByDefault: true,
          source: "mcp",
          sourceChannel: "web-ui",
          command: {
            commandPreview: "npm test --token=abc123",
            stdoutPreview: "ok",
            stderrPreview: "password=abc123",
            sourceChannel: "web-ui"
          },
          detailsPreview: "api_key=abc123",
          metadata: {
            api_key: "abc123",
            safe: "value"
          }
        }
      ],
      activitySummary: {
        approvalCount: 0,
        commandCount: 1,
        errorCount: 0,
        memoryCount: 0,
        toolCount: 0
      }
    }
  });

  const updated = state.sessions.find((item) => item.id === session.id);
  assert(updated, "export preview check should have an updated session");
  const preview = createSessionExportPreview(updated);
  const serialized = JSON.stringify(preview);
  assert.equal(preview.exportVersion, 1);
  assert.equal(preview.messages.length, 1);
  assert.equal(preview.runs.length, 1);
  assert.equal(preview.runs[0].activityReplay.length, 1);
  assert(preview.excluded.includes("api keys and credentials"));
  assert(serialized.includes("[redacted]"));
  assert(!serialized.includes("abc123"));
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
