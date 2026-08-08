import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import { registerHooks } from "node:module";

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (
      specifier === "../data/initialWorkspace" &&
      context.parentURL?.endsWith("/apps/web/src/lib/workspaceStore.ts")
    ) {
      return nextResolve("../data/initialWorkspace.ts", context);
    }
    return nextResolve(specifier, context);
  }
});

const workspaceStore = await import(
  pathToFileURL("apps/web/src/lib/workspaceStore.ts").toString()
);
const replayHelpers = await import(
  pathToFileURL("apps/web/src/lib/persistedActivityReplay.ts").toString()
);
const {
  DEFAULT_TENANT_ID,
  DEFAULT_USER_DISPLAY_NAME,
  createInitialWorkspaceState,
  formatSessionUpdatedAt,
  getVisibleSessions,
  workspaceReducer
} = workspaceStore;
const { createSessionExportPreview } = replayHelpers;

const base = createInitialWorkspaceState();

checkRenamePreservesStableKeys();
checkProjectActions();
checkUniqueDefaultTitles();
checkFirstUserMessageTitleCleanup();
checkManualRenameWins();
checkUpdatedAtAndSorting();
checkDerivedTimestampFormatting();
checkActiveStateRepair();
checkDefaultTenant();
checkLegacyTenantNormalization();
checkNormalizationFillsContextScopes();
checkNormalizationFillsTitleMetadata();
checkRunRecordPersistence();
checkMessageUsageMetadataPersistence();
checkRunsReplayPreviewHydrationPersistence();
checkSessionExportPreview();
checkSessionModelPreferencePersistence();
checkArchiveRepairsActiveSession();
checkChannelSessionImportPersistence();
checkResetReturnsValidState();
checkDefaultUserDisplayName();

console.log("Workspace state checks passed.");

function checkRenamePreservesStableKeys() {
  const project = base.projects[0];
  const session = base.sessions.find((item) => item.projectId === project.id);
  assert(session, "mock workspace should include a session for the first project");

  let state = workspaceReducer(base, {
    type: "renameProject",
    projectId: project.id,
    name: "Renamed project"
  });
  state = workspaceReducer(state, {
    type: "renameSession",
    sessionId: session.id,
    title: "Renamed Session"
  });

  const renamedProject = state.projects.find((item) => item.id === project.id);
  const renamedSession = state.sessions.find((item) => item.id === session.id);
  assert.equal(renamedProject?.contextScope.stableProjectKey, project.contextScope.stableProjectKey);
  assert.equal(renamedProject?.contextScopeKey, project.contextScopeKey);
  assert.equal(renamedSession?.contextScope.stableSessionKey, session.contextScope.stableSessionKey);
  assert.equal(renamedSession?.hermesSessionId, session.hermesSessionId);
  assert.equal(renamedSession?.titleSource, "manual");
  assert(renamedSession?.renamedAt, "manual rename should record renamedAt");
}

function checkProjectActions() {
  const project = base.projects[0];
  const archived = workspaceReducer(
    { ...base, activeProjectId: project.id },
    { type: "archiveProjectSessions", projectId: project.id }
  );
  assert.equal(
    archived.sessions.filter((session) => session.projectId === project.id && !session.archivedAt).length,
    0,
    "archiveProjectSessions archives every visible chat in the project"
  );
  assert.equal(archived.activeSessionId, null);

  const withRemovableProject = workspaceReducer(base, {
    type: "createProject",
    name: "Removable project"
  });
  const removableProject = withRemovableProject.projects[0];
  const removed = workspaceReducer(withRemovableProject, {
    type: "removeProject",
    projectId: removableProject.id
  });
  assert.equal(removed.projects.some((item) => item.id === removableProject.id), false);
  assert.equal(removed.sessions.some((session) => session.projectId === removableProject.id), false);
  assert(removed.projects.some((item) => item.id === removed.activeProjectId));

  const onlyProject = {
    ...base,
    activeProjectId: project.id,
    projects: [project],
    sessions: base.sessions.filter((session) => session.projectId === project.id)
  };
  assert.deepEqual(
    workspaceReducer(onlyProject, { type: "removeProject", projectId: project.id }),
    onlyProject,
    "the last project cannot be removed"
  );
}

function checkUniqueDefaultTitles() {
  let state = workspaceReducer(base, { type: "createProject" });
  const firstProject = state.projects[0];
  state = workspaceReducer(state, { type: "createProject" });
  const secondProject = state.projects[0];
  assert.equal(firstProject.name, "Untitled project 2");
  assert.equal(secondProject.name, "Untitled project 3");
  assert.notEqual(
    firstProject.contextScope.stableProjectKey,
    secondProject.contextScope.stableProjectKey
  );

  state = workspaceReducer(state, { type: "switchProject", projectId: secondProject.id });
  state = workspaceReducer(state, { type: "createSession" });
  const firstSession = state.sessions[0];
  state = workspaceReducer(state, { type: "createSession" });
  const secondSession = state.sessions[0];
  assert.equal(firstSession.title, "New chat");
  assert.equal(secondSession.title, "New chat 2");
  assert.notEqual(
    firstSession.contextScope.stableSessionKey,
    secondSession.contextScope.stableSessionKey
  );
}

function checkFirstUserMessageTitleCleanup() {
  let state = workspaceReducer(base, { type: "createSession" });
  const session = state.sessions[0];
  const stableSessionKey = session.contextScope.stableSessionKey;
  const hermesSessionId = session.hermesSessionId;

  state = workspaceReducer(state, {
    type: "appendMessage",
    sessionId: session.id,
    message: {
      id: "msg-check-title",
      role: "user",
      author: "User",
      createdAt: "12:00",
      content: "Can you verify project context?",
      status: "complete"
    }
  });

  const updated = state.sessions.find((item) => item.id === session.id);
  assert.equal(updated?.title, "Verify project context");
  assert.equal(updated?.titleSource, "first-message");
  assert(updated?.firstUserMessageAt, "first-message auto-title should record firstUserMessageAt");
  assert.equal(updated?.contextScope.stableSessionKey, stableSessionKey);
  assert.equal(updated?.hermesSessionId, hermesSessionId);

  state = workspaceReducer(state, { type: "createSession" });
  const longTitleSession = state.sessions[0];
  const longPrompt =
    "Open new tab on my chrome existing window and keep the current workspace visible while the page loads";
  state = workspaceReducer(state, {
    type: "appendMessage",
    sessionId: longTitleSession.id,
    message: {
      id: "msg-check-long-title",
      role: "user",
      author: "User",
      createdAt: "12:01",
      content: longPrompt,
      status: "complete"
    }
  });

  const longTitle = state.sessions.find((item) => item.id === longTitleSession.id)?.title;
  assert.equal(longTitle, "Open Chrome tab");
  assert.equal(longTitle?.includes("..."), false, "auto-titles must rely on UI fading");

  state = workspaceReducer(state, { type: "createSession" });
  const modelInquirySession = state.sessions[0];
  state = workspaceReducer(state, {
    type: "appendMessage",
    sessionId: modelInquirySession.id,
    message: {
      id: "msg-check-model-title",
      role: "user",
      author: "User",
      createdAt: "12:02",
      content: "What model are you currently using?",
      status: "complete"
    }
  });
  assert.equal(
    state.sessions.find((item) => item.id === modelInquirySession.id)?.title,
    "Model inquiry"
  );
}

function checkManualRenameWins() {
  let state = workspaceReducer(base, { type: "createSession" });
  const session = state.sessions[0];
  const stableSessionKey = session.contextScope.stableSessionKey;
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
      author: "User",
      createdAt: "12:01",
      content: "Can you overwrite this title?",
      status: "complete"
    }
  });

  const updated = state.sessions.find((item) => item.id === session.id);
  assert.equal(updated?.title, "Manual session name");
  assert.equal(updated?.titleSource, "manual");
  assert.equal(updated?.contextScope.stableSessionKey, stableSessionKey);
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
      author: "User",
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
  assert.equal(formatSessionUpdatedAt("2026-05-30T11:30:00.000Z", now), "30m");
  assert.equal(formatSessionUpdatedAt("2026-05-30T07:00:00.000Z", now), "5h");
  assert.equal(formatSessionUpdatedAt("2026-05-29T12:00:00.000Z", now), "1d");
  assert.equal(formatSessionUpdatedAt("2026-05-28T12:00:00.000Z", now), "2d");
  assert.equal(formatSessionUpdatedAt("2026-05-16T12:00:00.000Z", now), "2w");
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
  assert.equal(DEFAULT_TENANT_ID, "local");
  assert.notEqual(DEFAULT_TENANT_ID, "*");
  assert.equal(base.projects[0].contextScope.tenantId, DEFAULT_TENANT_ID);
  assert.equal(base.sessions[0].contextScope.tenantId, DEFAULT_TENANT_ID);
  assert(base.projects[0].contextScope.stableProjectKey.includes("stoix:local:project:"));
  assert(base.sessions[0].contextScope.stableSessionKey.includes("stoix:local:project:"));
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

  project.contextScopeKey = `stoix:tenant-local:project:${projectId}`;
  project.contextScope.tenantId = "tenant-local";
  project.contextScope.stableProjectKey = `stoix:tenant-local:project:${projectId}`;
  session.contextScope.tenantId = "tenant-local";
  session.contextScope.stableSessionKey =
    `stoix:tenant-local:project:${projectId}:session:${sessionId}`;

  const normalized = workspaceReducer(base, { type: "hydrate", state: legacy });
  const normalizedProject = normalized.projects.find((item) => item.id === projectId);
  const normalizedSession = normalized.sessions.find((item) => item.id === sessionId);

  assert.equal(normalizedProject?.id, projectId);
  assert.equal(normalizedProject?.name, projectTitle);
  assert.equal(normalizedProject?.contextScope.tenantId, DEFAULT_TENANT_ID);
  assert.equal(
    normalizedProject?.contextScope.stableProjectKey,
    `stoix:local:project:${projectId}`
  );
  assert.equal(normalizedProject?.contextScopeKey, `stoix:local:project:${projectId}`);
  assert.equal(normalizedSession?.id, sessionId);
  assert.equal(normalizedSession?.title, sessionTitle);
  assert.equal(normalizedSession?.hermesSessionId, hermesSessionId);
  assert.equal(normalizedSession?.contextScope.tenantId, DEFAULT_TENANT_ID);
  assert.equal(
    normalizedSession?.contextScope.stableSessionKey,
    `stoix:local:project:${projectId}:session:${sessionId}`
  );
}

function checkNormalizationFillsContextScopes() {
  const legacy = structuredClone(base);
  delete legacy.projects[0].contextScope;
  legacy.projects[0].contextScopeKey = "";
  delete legacy.sessions[0].contextScope;
  legacy.sessions[0].hermesSessionId = "";

  const normalized = workspaceReducer(base, { type: "hydrate", state: legacy });
  assert(normalized.projects[0].contextScope.stableProjectKey);
  assert(normalized.projects[0].contextScopeKey);
  assert(normalized.sessions[0].contextScope.stableSessionKey);
  assert(normalized.sessions[0].hermesSessionId);
  assert.equal(
    normalized.sessions[0].contextScope.stableSessionKey.includes(normalized.sessions[0].id),
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

  let generatedState = workspaceReducer(base, { type: "createSession" });
  const generatedSession = generatedState.sessions[0];
  const originalPrompt =
    "How many concurrent tasks can run while the existing workspace remains responsive";
  generatedState = workspaceReducer(generatedState, {
    type: "appendMessage",
    sessionId: generatedSession.id,
    message: {
      id: "msg-legacy-title",
      role: "user",
      author: "User",
      createdAt: "12:02",
      content: originalPrompt,
      status: "complete"
    }
  });
  const legacyGenerated = structuredClone(generatedState);
  const legacySession = legacyGenerated.sessions.find((item) => item.id === generatedSession.id);
  legacySession.title = `${originalPrompt.slice(0, 31).trimEnd()}...`;
  legacySession.titleSource = "manual";

  const migrated = workspaceReducer(base, { type: "hydrate", state: legacyGenerated });
  const migratedSession = migrated.sessions.find((item) => item.id === generatedSession.id);
  assert.equal(migratedSession?.titleSource, "first-message");
  assert.equal(migratedSession?.title, "Concurrent tasks inquiry");
}

function checkRunRecordPersistence() {
  let state = workspaceReducer(base, { type: "createSession" });
  const session = state.sessions[0];
  const stableSessionKey = session.contextScope.stableSessionKey;
  const hermesSessionId = session.hermesSessionId;
  const stableProjectKey = state.projects.find((project) => project.id === session.projectId)
    ?.contextScope.stableProjectKey;
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
  assert.equal(updated?.contextScope.stableSessionKey, stableSessionKey);
  assert.equal(updated?.hermesSessionId, hermesSessionId);
  assert.equal(
    state.projects.find((project) => project.id === session.projectId)?.contextScope.stableProjectKey,
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

function checkMessageUsageMetadataPersistence() {
  let state = workspaceReducer(base, { type: "createSession" });
  const session = state.sessions[0];

  state = workspaceReducer(state, {
    type: "appendMessage",
    sessionId: session.id,
    message: {
      id: "msg-usage-check",
      role: "assistant",
      author: "Hermes",
      createdAt: "12:05",
      content: "",
      status: "streaming"
    }
  });

  state = workspaceReducer(state, {
    type: "updateMessage",
    sessionId: session.id,
    messageId: "msg-usage-check",
    content: "Usage metadata is available.",
    status: "complete",
    usage: {
      promptTokens: 123,
      completionTokens: 456,
      totalTokens: 579,
      cachedTokens: 12,
      reasoningTokens: 3,
      costUsd: 0.0012,
      provider: "OpenRouter",
      model: "deepseek-v4-flash",
      upstreamModel: "deepseek/deepseek-v4-flash",
      generationId: "gen-usage-check",
      finishReason: "stop",
      latencyMs: 1200,
      requestId: "req-usage-check",
      source: "provider"
    }
  });

  let updated = state.sessions
    .find((item) => item.id === session.id)
    ?.messages.find((message) => message.id === "msg-usage-check");
  assert.equal(updated?.usage?.totalTokens, 579);
  assert.equal(updated?.usage?.costUsd, 0.0012);
  assert.equal(updated?.usage?.generationId, "gen-usage-check");

  state = workspaceReducer(state, {
    type: "updateMessage",
    sessionId: session.id,
    messageId: "msg-usage-check",
    content: "Usage metadata remains available.",
    status: "complete"
  });

  updated = state.sessions
    .find((item) => item.id === session.id)
    ?.messages.find((message) => message.id === "msg-usage-check");
  assert.equal(updated?.usage?.totalTokens, 579);
  assert.equal(updated?.usage?.generationId, "gen-usage-check");
}

function checkRunsReplayPreviewHydrationPersistence() {
  let state = workspaceReducer(base, { type: "createSession" });
  const session = state.sessions[0];
  const project = state.projects.find((item) => item.id === session.projectId);
  assert(project, "Runs preview hydration check needs an active project");
  const stableProjectKey = project.contextScope.stableProjectKey;
  const stableSessionKey = session.contextScope.stableSessionKey;
  const hermesSessionId = session.hermesSessionId;

  state = workspaceReducer(state, {
    type: "appendRunRecord",
    sessionId: session.id,
    run: {
      id: "run-preview-check",
      projectId: session.projectId,
      sessionId: session.id,
      hermesSessionId,
      hermesRunId: "run_hermes_preview_check",
      sourceChannel: "web-ui",
      status: "completed",
      startedAt: "2026-05-31T10:00:00.000Z",
      completedAt: "2026-05-31T10:00:01.000Z",
      durationMs: 1000,
      summary: "Runs-backed replay preview",
      metadata: {
        rawRunsPayloadPersisted: false,
        replayGeneratedFrom: "normalized-run-probe-events",
        runsNonDeltaEventTypes: ["reasoning.available", "run.completed"]
      },
      activityEventIds: ["runs-preview-reasoning", "runs-preview-completed"],
      activitySummary: {
        approvalCount: 0,
        commandCount: 0,
        errorCount: 0,
        memoryCount: 0,
        toolCount: 0
      },
      activityReplay: [
        {
          id: "runs-preview-reasoning",
          runId: "run-preview-check",
          type: "reasoning",
          status: "info",
          title: "Thinking signal received",
          summary: "[omitted: reasoning text not rendered]",
          collapsedByDefault: true,
          source: "hermes",
          sourceChannel: "web-ui",
          hermes: {
            eventType: "reasoning.available",
            runId: "run_hermes_preview_check",
            sessionId: hermesSessionId
          },
          metadata: {
            rawReasoningTextRendered: false
          }
        },
        {
          id: "runs-preview-completed",
          runId: "run-preview-check",
          type: "status",
          status: "completed",
          title: "Run completed",
          collapsedByDefault: true,
          source: "hermes",
          sourceChannel: "web-ui",
          hermes: {
            eventType: "run.completed",
            runId: "run_hermes_preview_check",
            sessionId: hermesSessionId
          }
        }
      ]
    }
  });

  const updated = state.sessions.find((item) => item.id === session.id);
  const record = updated?.runRecords[0];
  assert.equal(record?.id, "run-preview-check");
  assert.equal(record?.hermesRunId, "run_hermes_preview_check");
  assert.equal(record?.sourceChannel, "web-ui");
  assert.equal(record?.status, "completed");
  assert.equal(record?.metadata?.rawRunsPayloadPersisted, false);
  assert.equal(record?.activityReplay.length, 2);
  assert(record?.activityReplay.every((event) => event.sourceChannel === "web-ui"));
  assert(!JSON.stringify(record).includes("message.delta"));
  assert(!JSON.stringify(record).includes("Authorization: Bearer"));
  assert.equal(project.contextScope.stableProjectKey, stableProjectKey);
  assert.equal(updated?.contextScope.stableSessionKey, stableSessionKey);
  assert.equal(updated?.hermesSessionId, hermesSessionId);
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
      author: "User",
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

function checkSessionModelPreferencePersistence() {
  let state = workspaceReducer(base, { type: "createSession" });
  const session = state.sessions[0];
  const previousUpdatedAt = session.updatedAt;

  state = workspaceReducer(state, {
    type: "setSessionModelPreference",
    sessionId: session.id,
    preference: {
      catalogModelId: "moonshotai/kimi-k2.6",
      catalogSource: "ui-openrouter",
      label: "Kimi K2.6",
      provider: "OpenRouter",
      selectedAt: "2026-06-06T14:00:00.000Z",
      selectionScope: "turn",
      selectModelId: "moonshotai/kimi-k2.6"
    }
  });

  const updated = state.sessions.find((item) => item.id === session.id);
  assert.equal(updated?.modelPreference?.catalogModelId, "moonshotai/kimi-k2.6");
  assert.equal(updated?.modelPreference?.catalogSource, "ui-openrouter");
  assert.equal(updated?.modelPreference?.provider, "OpenRouter");
  assert.equal(updated?.modelPreference?.selectionScope, "turn");
  assert(Date.parse(updated?.updatedAt ?? "") >= Date.parse(previousUpdatedAt));

  const legacy = structuredClone(state);
  legacy.sessions[0].modelPreference = {
    catalogModelId: "bad-model",
    selectModelId: ""
  };
  const normalized = workspaceReducer(base, { type: "hydrate", state: legacy });
  assert.equal(normalized.sessions[0].modelPreference, undefined);
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

function checkChannelSessionImportPersistence() {
  const project = base.projects[0];
  const message = {
    id: "telegram-message-1",
    role: "user",
    author: "You",
    content: "Continue this conversation in Stoix.",
    createdAt: "09:41 AM",
    status: "complete"
  };
  const createdAt = "2026-08-06T05:40:00.000Z";
  const updatedAt = "2026-08-06T05:41:00.000Z";
  const imported = workspaceReducer(base, {
    type: "createSession",
    activate: true,
    channel: {
      source: "telegram",
      label: "Telegram",
      external: true,
      lastActiveAt: updatedAt
    },
    createdAt,
    hermesSessionId: "telegram-canonical-session",
    messages: [message],
    projectId: project.id,
    sessionId: "session-telegram-import",
    title: "Launch planning",
    updatedAt
  });

  const session = imported.sessions.find((item) => item.id === "session-telegram-import");
  assert.equal(imported.activeSessionId, "session-telegram-import");
  assert.equal(session?.projectId, project.id);
  assert.equal(session?.hermesSessionId, "telegram-canonical-session");
  assert.equal(session?.channel?.source, "telegram");
  assert.equal(session?.channel?.external, true);
  assert.equal(session?.createdAt, createdAt);
  assert.equal(session?.updatedAt, updatedAt);
  assert.deepEqual(session?.messages, [message]);

  const hydrated = workspaceReducer(base, { type: "hydrate", state: structuredClone(imported) });
  const restored = hydrated.sessions.find((item) => item.id === "session-telegram-import");
  assert.equal(restored?.hermesSessionId, "telegram-canonical-session");
  assert.equal(restored?.channel?.label, "Telegram");
  assert.equal(restored?.channel?.lastActiveAt, updatedAt);
  assert.deepEqual(restored?.messages, [message]);
}

function checkResetReturnsValidState() {
  const state = workspaceReducer(base, { type: "reset" });
  assert(state.projects.some((project) => project.id === state.activeProjectId));
  assert(
    state.activeSessionId === null ||
      state.sessions.some((session) => session.id === state.activeSessionId && !session.archivedAt)
  );
}

function checkDefaultUserDisplayName() {
  assert.equal(typeof DEFAULT_USER_DISPLAY_NAME, "string", "DEFAULT_USER_DISPLAY_NAME must be a string");
  assert(DEFAULT_USER_DISPLAY_NAME.length > 0, "DEFAULT_USER_DISPLAY_NAME must not be empty");
  const state = workspaceReducer(base, { type: "createSession" });
  const session = state.sessions[0];
  const newMessage = {
    id: "check-display-name",
    role: "user",
    author: DEFAULT_USER_DISPLAY_NAME,
    content: "check display name",
    createdAt: "12:00",
    status: "complete"
  };
  const next = workspaceReducer(state, { type: "appendMessage", sessionId: session.id, message: newMessage });
  const addedMessage = next.sessions.find((s) => s.id === session.id)?.messages.find((m) => m.id === "check-display-name");
  assert.equal(addedMessage?.author, DEFAULT_USER_DISPLAY_NAME, "appended user message should carry DEFAULT_USER_DISPLAY_NAME");
}
