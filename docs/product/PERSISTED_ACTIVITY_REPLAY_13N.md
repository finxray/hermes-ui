# Persisted Activity Replay 13N

Date: 2026-05-31

## Purpose

Slice 13N adds a compact, redacted, local activity replay shape for Web
UI-created runs. Slice 13M made run records durable; this slice lets selected
runs show bounded replay activity after refresh without re-running the agent,
executing commands, calling Hermes, calling Brain Memory Gateway, or adding
backend persistence.

The architecture remains:

```text
Browser UI -> Next.js BFF -> Hermes API server / Brain Memory Gateway UI API
```

## Files Changed

- `apps/web/src/data/types.ts`
- `apps/web/src/lib/persistedActivityReplay.ts`
- `apps/web/src/lib/workspaceStore.ts`
- `apps/web/src/components/chat/ChatView.tsx`
- `apps/web/src/components/shell/ContextRail.tsx`
- `apps/web/src/components/shell/ContextRail.module.css`
- `scripts/check-workspace-state.mjs`
- `scripts/check-agent-activity-events.mjs`
- `scripts/check-agent-activity-rendering.mjs`
- `scripts/ui-interaction-smoke.mjs`
- `docs/product/PERSISTED_ACTIVITY_REPLAY_13N.md`
- `docs/product/AGENT_ACTIVITY_EVENT_MODEL.md`
- `docs/product/RUN_HISTORY_SESSION_REPLAY_13M.md`
- `docs/product/AGENT_ORCHESTRATION_SLICE_PLAN.md`
- `ROADMAP.md`

## Persisted Replay Model

`RunRecord.activityReplay[]` stores bounded `PersistedActivityEvent` snapshots:

```ts
type PersistedActivityEvent = {
  id: string;
  runId: string;
  type: "reasoning" | "command" | "tool" | "memory" | "file" |
    "approval" | "error" | "elapsed" | "status" | "stream";
  status: "queued" | "running" | "completed" | "failed" |
    "cancelled" | "waiting_for_approval" | "info";
  title: string;
  summary?: string;
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
  collapsedByDefault: boolean;
  source: "hermes" | "brain-memory" | "ui" | "mcp" | "unknown";
  sourceChannel: "web-ui" | "telegram" | "cli" | "api" | "unknown";
  hermes?: { sessionId?: string; runId?: string; eventType?: string; toolName?: string; toolCallId?: string };
  memory?: { memoryId?: string; operation?: string; projectKey?: string; sessionKey?: string; scopeStatus?: string };
  command?: {
    commandPreview?: string;
    cwd?: string;
    exitCode?: number;
    stdoutPreview?: string;
    stderrPreview?: string;
    outputPreview?: string;
    truncated?: boolean;
    sourceChannel?: "web-ui" | "telegram" | "cli" | "api" | "unknown";
  };
  approval?: { approvalId?: string; decision?: string; requestedAction?: string; riskLevel?: string };
  artifact?: { fileId?: string; path?: string; kind?: string };
  detailsPreview?: string;
  metadata?: Record<string, unknown>;
};
```

## What Is Persisted

- Compact activity identity, type, status, title, source, source channel, and
  timestamps.
- Hermes correlation ids when present.
- Brain Memory operation/scope metadata when present.
- Command display metadata: command preview, cwd, exit code, stdout/stderr/output
  previews, truncation flag, source channel.
- Approval display metadata: id, decision, requested action, risk.
- Artifact display metadata: file id, path, kind.
- Redacted `detailsPreview` and bounded metadata.

## What Is Not Persisted

- Full raw Hermes payloads.
- Full stdout/stderr/output streams.
- Binary/blob data.
- API keys, bearer tokens, credentials, secrets.
- Browser-to-service URLs or credentials.
- Command execution handles or rerun instructions.
- Full cross-channel history from Telegram, CLI, API, Hermes, or Brain Memory.

## Compaction And Redaction

`apps/web/src/lib/persistedActivityReplay.ts` owns the replay helpers:

- `createPersistedActivityEvent(event, runId)`
- `compactActivityDetails(event)`
- `redactPersistedActivityEvent(event)`
- `limitPersistedActivityEvents(events, maxPerRun)`
- `restoreActivityEventFromPersisted(event)`
- `createRunReplaySummary(run, persistedEvents)`
- `createSessionExportPreview(session)`

Rules:

- persisted replay is redacted before it is attached to the run record;
- bearer-like values become `Bearer [redacted]`;
- secret-like keys become `[redacted]`;
- command/stdout/stderr/output previews are capped;
- details previews are capped and JSON-safe;
- nested metadata is flattened into bounded preview strings when needed.

## LocalStorage Bounding Strategy

The existing localStorage key and version remain unchanged:

```text
hermes-ui.workspace.v1
version: 1
```

Bounds:

- max 24 run records per session, inherited from Slice 13M;
- max 40 persisted replay events per run;
- max 900 characters for command/summary/output previews;
- max 1400 characters for details previews;
- max 16 metadata keys per persisted activity event.

Legacy sessions normalize safely:

- missing `activityReplay` becomes `[]`;
- malformed event type/status/source becomes safe defaults;
- malformed or oversized preview data is truncated;
- secret-like metadata is redacted;
- project/session stable keys and Hermes session ids are not changed.

## Replay UI Behavior

The Context rail run detail now shows `Persisted replay` for the selected run.

Behavior:

- shows compact persisted activity rows with title, status, type, source
  channel, duration, exit code, and preview text when available;
- shows `No persisted activity replay for this run` when a legacy or
  activity-less run has only transcript/run metadata;
- replay is display-only;
- selecting a run does not call Hermes or Brain Memory;
- no command is executed;
- no prompt is resent;
- no rerun/retry button is added.

## Export Shape

The helper `createSessionExportPreview(session)` defines a local export preview
shape. Slice 13O exposes this shape as a collapsed, local-only Context rail
preview without adding copy/download, filesystem writes, backend export, cloud
backup, or import. As of Slice 15P, the Context rail constructs the large JSON
preview only when the user opens the `Preview JSON` disclosure; the visible
summary counts remain immediate and local:

```ts
type SessionExportPreview = {
  exportVersion: 1;
  exportedAt: string;
  session: {
    id: string;
    projectId: string;
    hermesSessionId: string;
    title: string;
    summary: string;
    createdAt: string;
    updatedAt: string;
  };
  memoryScope: SessionMemoryScope;
  messages: ChatMessage[];
  runs: Array<{
    record: RunRecord;
    activityReplay: PersistedActivityEvent[];
  }>;
  excluded: string[];
};
```

Excluded:

- API keys and credentials;
- full raw Hermes payloads;
- full command stdout/stderr/output beyond previews;
- binary/blob data;
- service URLs with secrets.

## Cross-Channel Readiness

Persisted replay carries explicit source channel values:

- `web-ui`
- `telegram`
- `cli`
- `api`
- `unknown`

Current behavior only stores local Web UI activity replay. Future
cross-channel display needs safe read-only BFF APIs for Hermes run/session
listing, run event replay, Brain Memory thread/session listing, and normalized
channel/source metadata. Telegram discovery is not implemented in this slice.

## Regression Coverage

Added coverage:

- persisted activity event redacts secrets;
- command previews truncate;
- replay snapshots are bounded to 40 events;
- stopped runs persist cancelled/stopped replay activity;
- completed runs persist replay summary metadata;
- legacy/malformed sessions normalize without `activityReplay`;
- restored persisted replay is display-only;
- source channel is preserved;
- stable keys are unchanged;
- UI smoke verifies replay appears after live send/stop.

## Checks Run

Full check results are recorded in the final Slice 13N response.

## Limitations

- Replay ordering is append order within each Web UI run, not a server
  authoritative event ledger.
- Full activity event payloads are intentionally not stored.
- Existing pre-13N runs show run metadata but no persisted replay.
- Export remains a local preview shape only; no copy/download/import behavior is
  added.

## Slice 16J Runs Reconciliation Update

Slice 16J confirms that Hermes Runs events can use the existing persisted
replay shape after they are normalized into `AgentActivityEvent`.

Rules for future Runs replay:

- `message.delta` belongs in the assistant transcript buffer, not one persisted
  replay row per delta.
- `reasoning.available` may persist only as a generic public signal with raw
  reasoning-like text omitted.
- tool, memory, command, approval, run status, and error events may persist as
  compact redacted replay entries.
- raw Runs event payloads, full stdout/stderr/output, secrets, and action
  handles must not be persisted.

See `docs/architecture/HERMES_RUNS_REPLAY_RECONCILIATION_16J.md`.

## Slice 16K Runs Prototype Update

Slice 16K uses the existing persisted replay helpers for the experimental Runs
preview:

```text
Runs observed event summary -> AgentActivityEvent -> PersistedActivityEvent
```

The experimental response includes `activityReplayPreview` and
`replayExcludedFields`. The preview persists safe public activity rows such as
`reasoning.available` and `run.completed`, but it excludes per-token
`message.delta` replay rows, raw Runs payloads, full outputs, secrets, action
handles, and hidden reasoning text.

The replay preview is display-only response data. No backend persistence,
localStorage write, export/import, rerun, or approval action behavior was
added.

## Next Recommended Slice

Slice 13P - Local Export Download And Import Validation Contract.

Reason: Slice 13O added reload replay smoke coverage and a collapsed local
export preview surface. The next useful step is defining a safe local
download/import validation contract before durable backup or cloud sync.
