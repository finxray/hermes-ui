# Run History And Session Replay 13M

Date: 2026-05-31

## Purpose

Slice 13M adds the first production-grade foundation for local Web UI run
history and session replay. It persists compact run metadata inside the local
workspace session model so a user can revisit recent Web UI sends, inspect
status/source/activity counts, and correlate a run with the transcript and
live activity events that were emitted during that send.

This slice does not add backend persistence, cross-channel discovery, Hermes
run control, memory mutation, Telegram integration, auth, or direct browser
calls to Hermes, Brain Memory Gateway, or storage.

## Files Changed

- `apps/web/src/data/types.ts`
- `apps/web/src/data/mockWorkspace.ts`
- `apps/web/src/lib/workspaceStore.ts`
- `apps/web/src/hooks/useWorkspaceState.ts`
- `apps/web/src/components/chat/ChatView.tsx`
- `apps/web/src/components/shell/ContextRail.tsx`
- `apps/web/src/components/shell/ContextRail.module.css`
- `scripts/check-workspace-state.mjs`
- `scripts/ui-interaction-smoke.mjs`
- `docs/product/RUN_HISTORY_SESSION_REPLAY_13M.md`
- `docs/product/AGENT_ACTIVITY_EVENT_MODEL.md`
- `docs/product/SESSION_HISTORY_CONTRACT_13B.md`
- `docs/product/AGENT_ORCHESTRATION_SLICE_PLAN.md`
- `ROADMAP.md`

## Runtime Model

`Session.runRecords[]` is additive local metadata stored under the existing
localStorage key and version:

```text
hermes-ui.workspace.v1
version: 1
```

Each `RunRecord` represents one Web UI-created send/generation attempt:

```ts
type RunRecord = {
  id: string;
  projectId: string;
  sessionId: string;
  hermesSessionId: string;
  hermesRunId?: string;
  userMessageId?: string;
  assistantMessageId?: string;
  sourceChannel: "web-ui" | "telegram" | "cli" | "api" | "unknown";
  status: "running" | "completed" | "stopped" | "failed" | "cancelled";
  startedAt: string;
  completedAt?: string;
  durationMs?: number;
  stoppedByUser?: boolean;
  modelLabel?: string;
  providerLabel?: string;
  summary?: string;
  metadata?: Record<string, unknown>;
  activityEventIds: string[];
  activitySummary: {
    toolCount: number;
    memoryCount: number;
    commandCount: number;
    approvalCount: number;
    errorCount: number;
  };
  activityReplay: PersistedActivityEvent[]; // added in Slice 13N
};
```

## Current Behavior

- A run record is created when the Web UI composer sends a user message.
- The record preserves local project/session ids, Hermes session id, message
  ids, model/provider labels, source channel, timestamps, and status.
- Hermes stream activity events are linked by id while the current page is
  alive.
- Activity counts are summarized for tools, memory, commands, approvals, and
  errors.
- If Hermes emits a run id on the current session stream, the record stores it
  as `hermesRunId`.
- If Hermes is unavailable and the UI uses the local fallback message, the run
  is marked `failed` with an honest summary saying no real agent call was made.
- If the user stops generation, the run is marked `stopped` and
  `stoppedByUser: true`.

## Replay Scope

Replay is local and frontend-scoped in this slice:

- transcript messages are already persisted in `Session.messages[]`;
- compact run metadata is persisted in `Session.runRecords[]`;
- compact historical tool projections remain in `Session.toolEvents[]`;
- full `AgentActivityEvent[]` remains live React state and is not persisted
  after refresh.

This gives enough structure for recent run inspection without pretending to
reconstruct full Hermes history or discover runs created outside the Web UI.

## Right Rail UI

The Context tab now includes a compact `Run history` section:

- empty state: `No runs in this session yet`;
- recent Web UI-created runs, newest first;
- selected run detail with status, source, duration, provider/model, Hermes
  session id, optional Hermes run id, activity counts, and stopped-by-user note.

There are no rerun, retry, stop, approval, export, mutation, or admin controls
in this slice.

## Source And Channel Rules

`sourceChannel` is explicit. The current Web UI only creates `web-ui` records.
Other values are reserved for future reconciliation and display:

- `telegram`
- `cli`
- `api`
- `unknown`

The UI does not query Telegram, Hermes run lists, or external channel history.
Those integrations need future safe APIs and reconciliation rules.

Future cross-channel discovery needs explicit read-only BFF APIs backed by
verified service contracts, such as:

- Hermes session/run listing with stable run ids and source/channel metadata;
- Hermes run event listing or replay by run id;
- Brain Memory thread/session listing when Gateway exposes it safely;
- channel/source metadata for Telegram, CLI, API, and Web UI origins;
- a BFF import/discovery endpoint that normalizes these records without
  exposing secrets or direct service URLs to the browser.

## Stable Scope Rules

Run records must not change:

- `project.memoryScope.stableProjectKey`;
- `session.memoryScope.stableSessionKey`;
- `session.hermesSessionId`;
- the UI -> BFF -> Hermes -> Brain Memory MCP/Gateway memory path;
- the UI -> BFF -> Brain Memory Gateway read-only observability path.

Workspace normalization fills missing legacy `runRecords` as `[]` and repairs
malformed run record status/source/counts without changing stable keys.

## Regression Coverage

`scripts/check-workspace-state.mjs` now covers:

- new sessions start with `runRecords: []`;
- `appendRunRecord` persists a local Web UI run;
- `updateRunRecord` stores completed, stopped, and failed states;
- activity summaries and Hermes run ids survive updates;
- run updates do not change stable project/session keys or Hermes session id;
- legacy sessions missing `runRecords` normalize to `[]`;
- malformed run status/source/counts normalize safely.

`scripts/ui-interaction-smoke.mjs` now covers:

- Run history appears in the Context tab;
- empty state is visible before a send;
- opt-in live send smoke expects a completed local run;
- opt-in stop smoke expects a stopped local run.

## Checks Run

- `npm run check:workspace-state` - passed.
- `npm run check:agent-activity` - passed.
- `npm run check:agent-activity-rendering` - passed.
- `npm run smoke:mvp` - passed with Brain Memory live-mode warning because
  Gateway is intentionally disabled/mock.
- `npm run smoke:ui` - passed after restarting the local production server to
  clear stale Next static chunks from the prior build.
- `npm run smoke:ui:send` - passed against live Hermes.
- `npm run smoke:ui:stop` - passed against live Hermes.
- `npm run check:brain-memory-client` - passed.
- `npm run studio:doctor` - passed with Brain Memory Gateway disabled warnings.
- `npm run check:ui-structure` - passed.
- `npm run typecheck` - passed after `npm run build` regenerated `.next/types`.
- `npm run build` - passed.
- `npm audit --audit-level=moderate` - passed, 0 vulnerabilities.

## Deferred

- Backend durable run persistence.
- Persisted full activity-event replay.
- Cross-channel reconciliation for Telegram, CLI, API, or Hermes-created runs.
- Run-backed retry/rerun controls.
- Real server-side stop/cancel against `/v1/runs` when the chat path moves to a
  run control plane.
- Export/import of transcript plus activity plus run metadata.
- Auth/classification and per-user run visibility.

## Next Recommended Slice

Slice 13N - Persisted Activity Event Replay And Export Shape.

Reason: Slice 13M stores compact run metadata and links to live activity event
ids, but full replay still cannot survive refresh. The next safe step is a
bounded, redacted, local `AgentActivityEvent` persistence/export contract that
does not change Hermes streaming or backend storage.

## Slice 13N Update

Slice 13N adds `RunRecord.activityReplay[]`, a bounded redacted
`PersistedActivityEvent` snapshot list for Web UI-created runs. This preserves
enough compact activity metadata to inspect a selected run after refresh while
still excluding full raw payloads, full stdout/stderr/output, secrets, binary
data, command execution handles, rerun behavior, and backend persistence.

## Slice 16J Runs Reconciliation Update

Slice 16J defines how future Hermes Runs execution should map into this model.
The compatibility decision is to keep `RunRecord.id` as a Web UI-generated
local id and store Hermes Runs `run_id` only in `RunRecord.hermesRunId`.

This keeps existing session-stream records compatible, avoids id collisions
with future cross-channel records, and preserves rollback to
`/api/hermes/chat/stream`. Runs-derived activity should flow through
`AgentActivityEvent` and then into bounded `activityReplay[]`; raw Runs event
payloads and per-token `message.delta` rows should not be persisted.

See `docs/architecture/HERMES_RUNS_REPLAY_RECONCILIATION_16J.md`.

## Slice 16K Runs Prototype Update

Slice 16K adds a `runRecordPreview` to the experimental Runs BFF response
without writing it to local workspace state. The preview uses a local
`run-preview-*` id, stores Hermes `run_id` in `hermesRunId`, preserves
structured project/session/Hermes session context, sets `sourceChannel:
"web-ui"`, maps the final Hermes status to `RunRecord.status`, and attaches a
bounded redacted `activityReplay[]` preview.

This proves the existing `RunRecord` shape can carry a Runs-backed prototype,
but production chat still uses `/api/hermes/chat/stream` and the production
composer does not hydrate this preview yet.

## Slice 16L Runs Replay UI Hydration Update

Slice 16L adds a test-only Playwright hydration smoke for the Slice 16K preview
shape. The smoke calls the feature-flagged experimental Runs BFF route, injects
the returned `runRecordPreview` into an isolated local workspace state, reloads
the normal production root, and verifies the existing Run history displays the
Runs-backed record with visible `hermesRunId`, `completed` status, activity
summary metrics, and persisted replay rows.

This does not change the production composer. Production chat still uses
`/api/hermes/chat/stream`, and experimental Runs remains flag-gated.
