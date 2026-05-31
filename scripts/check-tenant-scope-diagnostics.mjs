import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { pathToFileURL } from "node:url";

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
const tenantDiagnostics = await import(
  pathToFileURL("apps/web/src/lib/tenantScopeDiagnostics.ts").toString()
);
const memoryScopeBridge = await import(
  pathToFileURL("apps/web/src/lib/memoryScopeBridge.ts").toString()
);

const {
  DEFAULT_TENANT_ID,
  createMockWorkspaceState,
  workspaceReducer
} = workspaceStore;
const {
  buildTenantScopeDiagnostics,
  redactTenantScopePosture
} = tenantDiagnostics;
const { buildMemoryScopeBridgeInstruction } = memoryScopeBridge;

const source = {
  contextRail: readFile("apps/web/src/components/shell/ContextRail.tsx"),
  diagnostics: readFile("apps/web/src/lib/tenantScopeDiagnostics.ts"),
  diagnosticsRoute: readFile("apps/web/src/app/api/tenant-scope/diagnostics/route.ts"),
  memoryConsole: readFile("apps/web/src/components/memory/BrainMemoryConsole.tsx"),
  scopeContract: readFile("docs/architecture/PROJECT_SESSION_MEMORY_SCOPE.md"),
  uiSmoke: readFile("scripts/ui-interaction-smoke.mjs"),
  workspaceStore: readFile("apps/web/src/lib/workspaceStore.ts")
};

const state = createMockWorkspaceState();
const activeProject = state.projects.find((project) => project.id === state.activeProjectId) ?? state.projects[0];
const activeSession = state.sessions.find((session) => session.id === state.activeSessionId) ?? null;

checkDefaultTenant();
checkLegacyTenantNormalization();
checkCustomTenantPreservation();
checkDiagnosticsModel();
checkBridgeUsesContextTenant();
checkRedactedPosture();
checkSourceBoundaries();
checkLivePostureIfObservable();

console.log("Tenant scope diagnostics checks passed.");

function checkDefaultTenant() {
  assert.equal(DEFAULT_TENANT_ID, "local-dev");
  assert.equal(activeProject.memoryScope.tenantId, "local-dev");
  assert(activeProject.memoryScope.stableProjectKey.includes(":local-dev:"));
  assert(activeSession?.memoryScope.stableSessionKey.includes(":local-dev:"));
}

function checkLegacyTenantNormalization() {
  const legacy = structuredClone(state);
  const project = legacy.projects[0];
  const session = legacy.sessions.find((item) => item.projectId === project.id);
  assert(session);

  project.memoryScope.tenantId = "tenant-local";
  project.memoryScope.stableProjectKey = `studio:tenant-local:project:${project.id}`;
  project.memoryScopeKey = project.memoryScope.stableProjectKey;
  session.memoryScope.tenantId = "tenant-local";
  session.memoryScope.stableSessionKey =
    `studio:tenant-local:project:${project.id}:session:${session.id}`;

  const normalized = workspaceReducer(state, { type: "hydrate", state: legacy });
  const normalizedProject = normalized.projects.find((item) => item.id === project.id);
  const normalizedSession = normalized.sessions.find((item) => item.id === session.id);

  assert.equal(normalizedProject?.memoryScope.tenantId, "local-dev");
  assert.equal(normalizedProject?.memoryScope.stableProjectKey, `studio:local-dev:project:${project.id}`);
  assert.equal(
    normalizedSession?.memoryScope.stableSessionKey,
    `studio:local-dev:project:${project.id}:session:${session.id}`
  );
}

function checkCustomTenantPreservation() {
  const custom = structuredClone(state);
  const project = custom.projects[0];
  const session = custom.sessions.find((item) => item.projectId === project.id);
  assert(session);

  project.memoryScope.tenantId = "customer-alpha";
  project.memoryScope.stableProjectKey = `studio:customer-alpha:project:${project.id}`;
  project.memoryScopeKey = project.memoryScope.stableProjectKey;
  session.memoryScope.tenantId = "customer-alpha";
  session.memoryScope.stableSessionKey =
    `studio:customer-alpha:project:${project.id}:session:${session.id}`;

  const normalized = workspaceReducer(state, { type: "hydrate", state: custom });
  const normalizedProject = normalized.projects.find((item) => item.id === project.id);
  const normalizedSession = normalized.sessions.find((item) => item.id === session.id);

  assert.equal(normalizedProject?.memoryScope.tenantId, "customer-alpha");
  assert.equal(normalizedProject?.memoryScope.stableProjectKey, project.memoryScope.stableProjectKey);
  assert.equal(normalizedSession?.memoryScope.stableSessionKey, session.memoryScope.stableSessionKey);
}

function checkDiagnosticsModel() {
  const diagnostics = buildTenantScopeDiagnostics({
    activeProject,
    activeSession,
    brainMemoryStatus: {
      baseUrl: "http://127.0.0.1:8080",
      capabilities: null,
      checkedAt: "2026-05-31T00:00:00.000Z",
      configured: true,
      error: null,
      health: null,
      mode: "real",
      reachable: true
    },
    hermesStatus: {
      baseUrl: "http://127.0.0.1:8642",
      capabilities: null,
      checkedAt: "2026-05-31T00:00:00.000Z",
      configured: true,
      error: null,
      health: null,
      mode: "real",
      models: null,
      reachable: true,
      uiCapabilities: {
        memory: {
          instructionBridgeActive: true,
          memoryWriteApi: false,
          metadataContextPropagation: "unknown",
          sessionContinuityHeader: "X-Hermes-Session-Id",
          sessionKeyHeader: "X-Hermes-Session-Key"
        }
      }
    },
    redactedPosture: {
      allowedTenantsSummary: "wildcard",
      gatewayMemoryKeySet: true,
      mcpApiKeySet: true,
      uiApiKeySet: false
    }
  });

  assert.equal(diagnostics.ui.tenantId, "local-dev");
  assert.equal(diagnostics.checks.uiTenantIsLocalDev, true);
  assert.equal(diagnostics.checks.projectKeyContainsTenant, true);
  assert.equal(diagnostics.checks.sessionKeyContainsTenant, true);
  assert.deepEqual(diagnostics.checks.errors, []);
  assert.equal(diagnostics.redactedPosture.gatewayMemoryKeySet, true);
  assert.equal(diagnostics.redactedPosture.allowedTenantsSummary, "wildcard");
}

function checkBridgeUsesContextTenant() {
  assert(activeSession);
  const instruction = buildMemoryScopeBridgeInstruction({
    project: {
      contextPolicy: activeProject.memoryScope.contextPolicy,
      id: activeProject.id,
      pinnedMemoryIds: activeProject.memoryScope.pinnedMemoryIds,
      retrievalProfile: activeProject.memoryScope.retrievalProfile,
      stableKey: activeProject.memoryScope.stableProjectKey,
      tenantId: activeProject.memoryScope.tenantId,
      title: activeProject.name
    },
    session: {
      hermesSessionId: activeSession.hermesSessionId,
      id: activeSession.id,
      includeProjectContext: activeSession.memoryScope.includeProjectContext,
      includeSessionContext: activeSession.memoryScope.includeSessionContext,
      stableKey: activeSession.memoryScope.stableSessionKey,
      title: activeSession.title
    },
    ui: {
      source: "hermes-ui",
      workspaceVersion: 1
    }
  });
  assert(instruction.includes("- tenantId: local-dev"));
  assert(instruction.includes(activeProject.memoryScope.stableProjectKey));
  assert(instruction.includes(activeSession.memoryScope.stableSessionKey));
}

function checkRedactedPosture() {
  const posture = redactTenantScopePosture({
    allowedTenants: ["*", "local-dev"],
    gatewayMemoryKey: "gateway-secret",
    mcpApiKey: "mcp-secret",
    uiApiKey: ""
  });
  const serialized = JSON.stringify(posture);

  assert.equal(posture.gatewayMemoryKeySet, true);
  assert.equal(posture.mcpApiKeySet, true);
  assert.equal(posture.uiApiKeySet, false);
  assert.equal(posture.allowedTenantsSummary, "wildcard");
  assert(!serialized.includes("gateway-secret"));
  assert(!serialized.includes("mcp-secret"));
}

function checkSourceBoundaries() {
  assert(source.contextRail.includes("Tenant / scope diagnostics"));
  assert(source.contextRail.includes("Read-only drift check"));
  assert(source.contextRail.includes("buildTenantScopeDiagnostics"));
  assert(source.diagnosticsRoute.includes("redactTenantScopePosture"));
  assert(!source.diagnosticsRoute.includes("GATEWAY_MEMORY_API_KEYS"));
  assert(!source.diagnostics.includes("fetch("));
  assert(source.uiSmoke.includes("memory-live-bff-search-tenant"));
  assert(source.uiSmoke.includes("memory-live-bff-result-scope"));
  assert(source.uiSmoke.includes("--memory-scope-test"));
  assert(source.uiSmoke.includes("memory-scope-same-session"));
  assert(source.uiSmoke.includes("memory-scope-different-session"));
  assert(source.uiSmoke.includes("memory-scope-different-project"));
  assert(source.uiSmoke.includes("memory-scope-project-only-query"));
  assert(source.uiSmoke.includes("memory-scope-project-only-original-session-key"));
  assert(source.uiSmoke.includes("memory-scope-project-only-scope-status"));
  assert(!source.uiSmoke.includes("Hermes MCP stored it under local-dev"));
  assert(source.scopeContract.includes("Session-scoped write"));
  assert(source.scopeContract.includes("Project-only read"));
  assert(source.scopeContract.includes("Future project-level write"));
  assert(source.scopeContract.includes("project-broad"));
  assert(source.scopeContract.includes("This is not a"));
  assert(source.scopeContract.includes("project-level write"));
  assert(!source.memoryConsole.includes("Delete memory"));
  assert(!source.memoryConsole.includes("Mark stale"));
  assert(!source.memoryConsole.includes("Supersede memory"));
  assert(source.workspaceStore.includes('const LEGACY_LOCAL_TENANT_ID = "tenant-local"'));
}

function checkLivePostureIfObservable() {
  const mcp = readHermesMcpPosture();
  if (mcp.tenantId) {
    assert.equal(mcp.tenantId, "local-dev");
  }

  const gateway = readGatewayKeyPosture();
  if (gateway.entries.length > 0) {
    const localEntry = gateway.entries.find((entry) => entry.caller === "local-dev");
    assert(localEntry, "Gateway key posture should include a local-dev caller when env is available");
    assert.equal(localEntry.keySet, true);
    assert(localEntry.operations.includes("read"));
  }
}

function readHermesMcpPosture() {
  const script = [
    "import glob,os,json",
    "out={}",
    "for p in glob.glob('/proc/[0-9]*'):",
    "    try: cmd=open(os.path.join(p,'cmdline'),'rb').read().replace(b'\\0',b' ')",
    "    except Exception: continue",
    "    if b'brain_memory_mcp' not in cmd: continue",
    "    try: raw=open(os.path.join(p,'environ'),'rb').read().split(b'\\0')",
    "    except Exception: raw=[]",
    "    env={}",
    "    for x in raw:",
    "        if b'=' in x:",
    "            k,v=x.split(b'=',1); env[k.decode(errors='ignore')]=v.decode(errors='ignore')",
    "    out={'tenantId': env.get('BRAIN_MEMORY_DEFAULT_TENANT_ID'), 'callerLabel': env.get('BRAIN_MEMORY_CALLER_LABEL'), 'gatewayUrl': env.get('BRAIN_MEMORY_GATEWAY_URL'), 'apiKeySet': bool(env.get('BRAIN_MEMORY_API_KEY'))}",
    "    break",
    "print(json.dumps(out))"
  ].join("\n");

  try {
    const stdout = execFileSync("wsl", ["-d", "Ubuntu", "--", "python3", "-c", script], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 5000
    });
    return JSON.parse(stdout || "{}");
  } catch {
    return {};
  }
}

function readGatewayKeyPosture() {
  const envPath = "C:/Users/Alexey/.cursor/projects/brain-memory/.env";
  if (!existsSync(envPath)) {
    return { entries: [] };
  }
  const line = readFileSync(envPath, "utf8")
    .split(/\r?\n/)
    .find((item) => item.startsWith("GATEWAY_MEMORY_API_KEYS="));
  if (!line) {
    return { entries: [] };
  }
  const raw = line.slice(line.indexOf("=") + 1).trim().replace(/^['"]|['"]$/g, "");
  try {
    const parsed = JSON.parse(raw);
    const entries = (Array.isArray(parsed) ? parsed : [parsed]).map((item) => ({
      caller: String(item.caller_id ?? item.callerId ?? ""),
      keySet: Boolean(item.key),
      operations: Array.isArray(item.operations) ? item.operations.map(String) : [],
      tenants: Array.isArray(item.tenants) ? item.tenants.map(String) : []
    }));
    return { entries };
  } catch {
    return { entries: [{ caller: "", keySet: true, operations: [], tenants: [] }] };
  }
}

function readFile(path) {
  return readFileSync(path, "utf8");
}
