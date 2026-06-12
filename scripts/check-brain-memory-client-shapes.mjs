import assert from "node:assert/strict";
import {
  fetchLifecycleMetrics,
  fetchLifecycleTimeline,
  inspectBrainMemory,
  searchBrainMemory
} from "@hermes-ui/brain-memory-client";

const context = {
  project: {
    id: "brain-memory",
    title: "Brain Memory",
    stableKey: "brain-memory",
    tenantId: "local-dev",
    retrievalProfile: "balanced",
    contextPolicy: "project-and-session"
  },
  session: {
    id: "slice-08d-scope-bridge",
    title: "Slice 08D scope bridge",
    stableKey: "slice-08d-scope-bridge",
    includeProjectContext: true,
    includeSessionContext: true
  },
  ui: {
    source: "hermes-ui",
    workspaceVersion: 1
  }
};

const secretValues = ["ui-secret-for-test", "tenant-secret-for-test"];

await checkUnconfiguredInspect();
await checkHttpErrorMessages();
await checkInspectNormalizationAndNoSecretLeakage();
await checkMissingEvidenceSupersessionNormalization();
await checkSearchScopeNormalization();
await checkLifecycleDisabledAndUnconfiguredEnvelopes();
await checkLifecycleErrorEnvelopes();
await checkLifecycleSuccessNormalization();

console.log("Brain Memory client shape checks passed.");

async function checkUnconfiguredInspect() {
  const response = await inspectBrainMemory(
    {
      baseUrl: "",
      enabled: true,
      gatewayMemoryApiKey: secretValues[1],
      uiApiKey: secretValues[0]
    },
    { context, memoryId: "memory-1" }
  );

  assert.equal(response.mode, "unconfigured");
  assert.equal(response.error?.kind, "unconfigured");
  assertNoSecrets(response);
}

async function checkHttpErrorMessages() {
  const cases = [
    [401, "unauthorized", "Brain Memory UI API bearer is required or invalid."],
    [403, "forbidden", "Tenant key is not authorized for this memory scope."],
    [
      404,
      "http_error",
      "Memory is not available in the current project/session scope (HTTP 404)."
    ]
  ];

  for (const [status, kind, message] of cases) {
    const response = await inspectBrainMemory(
      {
        baseUrl: "http://brain-memory.test",
        enabled: true,
        fetchImpl: async () => jsonResponse(status, { detail: "controlled" }),
        gatewayMemoryApiKey: secretValues[1],
        uiApiKey: secretValues[0]
      },
      { context, memoryId: "00000000-0000-0000-0000-000000000001" }
    );

    assert.equal(response.mode, "error");
    assert.equal(response.error?.kind, kind);
    assert.equal(response.error?.message, message);
    assertNoSecrets(response);
  }
}

async function checkInspectNormalizationAndNoSecretLeakage() {
  const calls = [];
  const response = await inspectBrainMemory(
    {
      baseUrl: "http://brain-memory.test",
      enabled: true,
      fetchImpl: async (url, init) => {
        calls.push({ url: String(url), headers: new Headers(init?.headers) });
        if (String(url).includes("/evidence")) {
          return jsonResponse(200, {
            memoryId: "memory-1",
            evidence: [],
            status: "not_implemented"
          });
        }
        if (String(url).includes("/supersession-chain")) {
          return jsonResponse(200, {
            memoryId: "memory-1",
            chain: [],
            status: "not_implemented"
          });
        }
        return jsonResponse(200, {
          id: "memory-1",
          content: "Full scoped memory content",
          snippet: "Full scoped",
          layer: "canonical",
          source: "brain-memory",
          projectKey: "brain-memory",
          sessionKey: "slice-08d-scope-bridge",
          scopeStatus: "matching-session",
          supersessionStatus: "active",
          evidenceCount: 0,
          metadata: {
            contentJsonb: {
              projectKey: "brain-memory",
              sessionKey: "slice-08d-scope-bridge"
            }
          },
          scope: {
            tenantId: "local-dev",
            projectKey: "brain-memory",
            sessionKey: "slice-08d-scope-bridge",
            mode: "project-and-session",
            status: "enforced",
            legacyUnscopedExcluded: 2
          }
        });
      },
      gatewayMemoryApiKey: secretValues[1],
      uiApiKey: secretValues[0]
    },
    { context, memoryId: "memory-1" }
  );

  assert.equal(response.mode, "real");
  assert.equal(response.detail?.scopeStatus, "matching-session");
  assert.equal(response.detail?.supersessionStatus, "active");
  assert.equal(response.detail?.scope?.legacyUnscopedExcluded, 2);
  assert.equal(response.evidence?.status, "not_implemented");
  assert.deepEqual(response.evidence?.evidence, []);
  assert.equal(response.supersession?.status, "not_implemented");
  assert.deepEqual(response.supersession?.chain, []);
  assert.equal(calls.length, 4);
  assert(calls[0].url.includes("tenantId=local-dev"));
  assert(calls[0].url.includes("projectKey=brain-memory"));
  assert(calls[0].url.includes("sessionKey=slice-08d-scope-bridge"));
  assert(calls[3].url.includes("/v1/memory/memory-1"));
  assert(calls[3].url.includes("include_audit=true"));
  assert(calls[3].url.includes("tenant_id=local-dev"));
  assert.equal(calls[0].headers.get("Authorization"), `Bearer ${secretValues[0]}`);
  assert.equal(calls[0].headers.get("X-Gateway-Memory-Api-Key"), secretValues[1]);
  assertNoSecrets(response);
}

async function checkMissingEvidenceSupersessionNormalization() {
  const response = await inspectBrainMemory(
    {
      baseUrl: "http://brain-memory.test",
      enabled: true,
      fetchImpl: async (url) => {
        if (String(url).includes("/evidence")) {
          return jsonResponse(200, {
            memory_id: "memory-2",
            status: "not_implemented"
          });
        }
        if (String(url).includes("/supersession-chain")) {
          return jsonResponse(200, {
            memory_id: "memory-2",
            status: "not_implemented"
          });
        }
        return jsonResponse(200, {
          memory: {
            memory_id: "memory-2",
            full_content: "Nested detail content",
            layer: "semantic",
            project_key: "brain-memory",
            session_key: "slice-08d-scope-bridge",
            scope_status: "matching-session",
            supersession_status: "active",
            evidence_count: 0,
            created_at: "2026-05-31T00:00:00Z",
            updated_at: "2026-05-31T00:00:00Z"
          },
          scope: {
            tenant_id: "local-dev",
            project_key: "brain-memory",
            session_key: "slice-08d-scope-bridge",
            mode: "project-and-session",
            status: "enforced"
          }
        });
      },
      gatewayMemoryApiKey: secretValues[1],
      uiApiKey: secretValues[0]
    },
    { context, memoryId: "memory-2" }
  );

  assert.equal(response.mode, "real");
  assert.equal(response.detail?.id, "memory-2");
  assert.equal(response.detail?.layer, "semantic");
  assert.equal(response.detail?.scope?.tenantId, "local-dev");
  assert.equal(response.evidence?.status, "not_implemented");
  assert.deepEqual(response.evidence?.evidence, []);
  assert.equal(response.supersession?.status, "not_implemented");
  assert.deepEqual(response.supersession?.chain, []);
  assertNoSecrets(response);
}

async function checkSearchScopeNormalization() {
  const response = await searchBrainMemory(
    {
      baseUrl: "http://brain-memory.test",
      enabled: true,
      fetchImpl: async () =>
        jsonResponse(200, {
          results: [],
          scope: {
            tenantId: "local-dev",
            projectKey: "brain-memory",
            sessionKey: "slice-08d-scope-bridge",
            mode: "project-and-session",
            status: "enforced",
            legacyUnscopedExcluded: 3,
            mismatchedProjectExcluded: 1,
            mismatchedSessionExcluded: 2
          }
        })
    },
    { context, limit: 5, query: "scope" }
  );

  assert.equal(response.mode, "real");
  assert.equal(response.scope?.legacyUnscopedExcluded, 3);
  assert.equal(response.scope?.mismatchedProjectExcluded, 1);
  assert.equal(response.scope?.mismatchedSessionExcluded, 2);
}

async function checkLifecycleDisabledAndUnconfiguredEnvelopes() {
  const disabledMetrics = await fetchLifecycleMetrics({
    baseUrl: "http://brain-memory.test",
    enabled: false,
    gatewayMemoryApiKey: secretValues[1],
    uiApiKey: secretValues[0]
  });
  assert.equal(disabledMetrics.mode, "mock");
  assert.equal(disabledMetrics.error?.kind, "disabled");
  assert.equal(disabledMetrics.metrics, null);
  assertNoSecrets(disabledMetrics);

  const unconfiguredTimeline = await fetchLifecycleTimeline({
    baseUrl: "",
    enabled: true,
    gatewayMemoryApiKey: secretValues[1],
    uiApiKey: secretValues[0]
  });
  assert.equal(unconfiguredTimeline.mode, "unconfigured");
  assert.equal(unconfiguredTimeline.error?.kind, "unconfigured");
  assert.deepEqual(unconfiguredTimeline.events, []);
  assert.equal(unconfiguredTimeline.total, 0);
  assertNoSecrets(unconfiguredTimeline);
}

async function checkLifecycleErrorEnvelopes() {
  const metrics = await fetchLifecycleMetrics({
    baseUrl: "http://brain-memory.test",
    enabled: true,
    fetchImpl: async () => jsonResponse(401, { detail: "controlled" }),
    gatewayMemoryApiKey: secretValues[1],
    uiApiKey: secretValues[0]
  });
  assert.equal(metrics.mode, "error");
  assert.equal(metrics.error?.kind, "unauthorized");
  assert.equal(metrics.metrics, null);
  assertNoSecrets(metrics);

  const timeline = await fetchLifecycleTimeline(
    {
      baseUrl: "http://brain-memory.test",
      enabled: true,
      fetchImpl: async () => jsonResponse(503, { detail: "controlled" }),
      gatewayMemoryApiKey: secretValues[1],
      uiApiKey: secretValues[0]
    },
    { limit: 10, offset: 0 }
  );
  assert.equal(timeline.mode, "error");
  assert.equal(timeline.error?.kind, "http_error");
  assert.deepEqual(timeline.events, []);
  assertNoSecrets(timeline);
}

async function checkLifecycleSuccessNormalization() {
  const metrics = await fetchLifecycleMetrics({
    baseUrl: "http://brain-memory.test",
    enabled: true,
    fetchImpl: async () =>
      jsonResponse(200, {
        active_count: 12,
        archived_count: 3,
        superseded_count: 1,
        deleted_soft_count: 2,
        archives_24h: 1,
        archives_7d: 2,
        archives_lifetime: 3,
        restores_24h: 0,
        restores_7d: 0,
        restores_lifetime: 1,
        deletes_24h: 0,
        deletes_7d: 1,
        deletes_lifetime: 2,
        supersedes_24h: 0,
        supersedes_7d: 0,
        supersedes_lifetime: 1
      }),
    gatewayMemoryApiKey: secretValues[1],
    uiApiKey: secretValues[0]
  });
  assert.equal(metrics.mode, "real");
  assert.equal(metrics.error, null);
  assert.equal(metrics.metrics?.active_count, 12);
  assert.equal(metrics.metrics?.archived_count, 3);
  assertNoSecrets(metrics);

  const timeline = await fetchLifecycleTimeline(
    {
      baseUrl: "http://brain-memory.test",
      enabled: true,
      fetchImpl: async () =>
        jsonResponse(200, {
          events: [
            {
              audit_event_id: "evt-1",
              memory_id: "memory-1",
              tenant_id: "local-dev",
              operation: "archive",
              from_state: "active",
              to_state: "archived",
              reason: "stale",
              caller_label: "studio",
              created_at: "2026-06-01T00:00:00Z",
              lifecycle_state: "archived",
              project_key: "brain-memory",
              session_key: null
            }
          ],
          total: 1,
          limit: 20,
          offset: 0
        }),
      gatewayMemoryApiKey: secretValues[1],
      uiApiKey: secretValues[0]
    },
    { limit: 20, offset: 0 }
  );
  assert.equal(timeline.mode, "real");
  assert.equal(timeline.error, null);
  assert.equal(timeline.events.length, 1);
  assert.equal(timeline.events[0].operation, "archive");
  assert.equal(timeline.total, 1);
  assertNoSecrets(timeline);
}

function jsonResponse(status, body) {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status
  });
}

function assertNoSecrets(value) {
  const serialized = JSON.stringify(value);
  for (const secret of secretValues) {
    assert(!serialized.includes(secret), "normalized response leaked a secret value");
  }
}
