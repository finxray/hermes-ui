import type { NormalizedBrainMemoryInspectResponse } from "@hermes-ui/brain-memory-client";

export const MEMORY_DETAIL_FIXTURE_ROUTE = "/design/memory-detail-fixture";

export const memoryDetailSecretSentinels = {
  apiKey: "fixture-api-key-should-not-render",
  bearer: "Bearer fixture-bearer-should-not-render",
  token: "fixture-token-should-not-render"
};

export const fullScopedMemoryDetailFixture: NormalizedBrainMemoryInspectResponse = {
  mode: "real",
  memoryId: "fixture-memory-detail-15j",
  detail: {
    id: "fixture-memory-detail-15j",
    content: `## Fixture Memory — Scoped Gateway Detail

This deterministic memory detail fixture represents a **Gateway-backed scoped memory**. It is rendered without calling Hermes, Brain Memory Gateway, localStorage, or direct storage.

### Key properties verified

- Markdown headings render correctly (h2, h3)
- **Bold** and _italic_ inline formatting
- Inline \`code spans\` and fenced code blocks
- Tables with GFM support
- Lists (ordered and unordered)

### Code block example

\`\`\`typescript
const memoryId = "fixture-memory-detail-15j";
const response = await gateway.inspect({ memoryId, context });
console.log(response.detail?.content);
\`\`\`

### Scope table

| Field | Value |
|-------|-------|
| Tenant | local-dev |
| Project key | fixture-project |
| Session key | fixture-session |
| Scope status | matching-session |

### Notes

1. The \`detailContentScroll\` wrapper constrains height to 300px.
2. Overflow scrolls within the container.
3. Syntax highlighting applies after streaming completes.`,
    snippet: "Deterministic scoped memory detail fixture for read-only UI coverage.",
    layer: "canonical",
    source: "brain-memory-fixture",
    projectKey: "studio:local-dev:project:fixture-project",
    sessionKey: "studio:local-dev:project:fixture-project:session:fixture-session",
    scopeStatus: "matching-session",
    supersessionStatus: "active",
    evidenceCount: 0,
    createdAt: "2026-05-31T10:00:00.000Z",
    updatedAt: "2026-05-31T10:05:00.000Z",
    metadata: {
      auditPosture: "metadata-only",
      durableAuditEndpoint: "not_implemented",
      fixture: "memory-detail-15j",
      redactionSentinel: {
        api_key: memoryDetailSecretSentinels.apiKey,
        Authorization: memoryDetailSecretSentinels.bearer,
        note: `nested token=${memoryDetailSecretSentinels.token}`
      },
      source: {
        layer: "canonical",
        sourceLabel: "fixture"
      }
    },
    scope: {
      tenantId: "local-dev",
      projectKey: "studio:local-dev:project:fixture-project",
      sessionKey: "studio:local-dev:project:fixture-project:session:fixture-session",
      mode: "project-and-session",
      status: "enforced",
      legacyUnscopedExcluded: 0,
      mismatchedProjectExcluded: 0,
      mismatchedSessionExcluded: 0
    }
  },
  evidence: {
    memoryId: "fixture-memory-detail-15j",
    evidence: [],
    status: "not_implemented"
  },
  supersession: {
    memoryId: "fixture-memory-detail-15j",
    chain: [],
    status: "not_implemented"
  },
  error: null,
  checkedAt: "2026-05-31T10:06:00.000Z"
};

export const wrongScopeMemoryDetailFixture: NormalizedBrainMemoryInspectResponse = {
  mode: "error",
  memoryId: "fixture-memory-detail-15j",
  detail: null,
  evidence: null,
  supersession: null,
  error: {
    kind: "http_error",
    message: "Memory is not available in the current project/session scope (HTTP 404)."
  },
  checkedAt: "2026-05-31T10:07:00.000Z"
};
