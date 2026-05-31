import assert from "node:assert/strict";
import { inspectBrainMemory, searchBrainMemory } from "@hermes-ui/brain-memory-client";

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
  assert.equal(calls.length, 3);
  assert(calls[0].url.includes("tenantId=local-dev"));
  assert(calls[0].url.includes("projectKey=brain-memory"));
  assert(calls[0].url.includes("sessionKey=slice-08d-scope-bridge"));
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
