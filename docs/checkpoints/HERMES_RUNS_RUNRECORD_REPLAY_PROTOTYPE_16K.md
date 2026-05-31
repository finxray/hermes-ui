# Hermes Runs RunRecord Replay Prototype 16K

Date: 2026-05-31

Base commit before this slice: `bd87e73 docs: reconcile Hermes Runs with replay model`

## Purpose

Slice 16K adds a disabled-by-default prototype shape for reconciling
experimental Hermes Runs execution with the existing Web UI `RunRecord` and
bounded persisted replay model.

This is a data-shape prototype only. It does not switch production chat to
Runs and does not wire Runs into the production composer as the default.

## Files Changed

- `apps/web/src/lib/hermesRunsReplayPreview.ts`
- `apps/web/src/app/api/hermes/runs/experimental-chat/route.ts`
- `scripts/hermes-runs-experimental-chat.mjs`
- `scripts/check-ui-structure.mjs`
- `docs/checkpoints/HERMES_RUNS_RUNRECORD_REPLAY_PROTOTYPE_16K.md`
- `docs/architecture/HERMES_RUNS_REPLAY_RECONCILIATION_16J.md`
- `docs/product/RUN_HISTORY_SESSION_REPLAY_13M.md`
- `docs/product/PERSISTED_ACTIVITY_REPLAY_13N.md`
- `docs/product/AGENT_ORCHESTRATION_SLICE_PLAN.md`
- `ROADMAP.md`

## Prototype Shape

The experimental BFF route now adds these preview fields to successful
`POST /api/hermes/runs/experimental-chat` responses:

- `runRecordPreview`
- `activityReplayPreview`
- `activitySummary`
- `replayExcludedFields`

`runRecordPreview` is Web UI-compatible:

- `id` is a local `run-preview-*` id and is not the Hermes `run_id`;
- `hermesRunId` stores the Hermes `run_id`;
- `projectId`, `sessionId`, and `hermesSessionId` come from structured request
  context;
- `sourceChannel` is `web-ui`;
- `status` maps from the Hermes final status;
- `startedAt`, `completedAt`, and `durationMs` are bounded safe timestamps;
- `activitySummary` is derived from normalized activity events;
- `activityReplay` is the same bounded/redacted list as
  `activityReplayPreview`;
- `metadata.rawRunsPayloadPersisted` is `false`.

The preview is returned by the experimental BFF route only. The BFF does not
write to localStorage.

## Activity Replay Mapping

The prototype maps observed Runs probe event summaries into the existing model:

```text
Hermes Runs observed event summary
  -> createActivityEventFromHermesRunsEvent
  -> createPersistedActivityEvent
  -> limitPersistedActivityEvents
  -> activityReplayPreview / runRecordPreview.activityReplay
```

Mapping rules:

- `message.delta` remains assistant transcript/output buffer data and does not
  become a replay row.
- `reasoning.available` becomes a safe public `reasoning` signal with hidden
  reasoning text omitted.
- `run.completed`, `run.failed`, cancellation, tool, memory, command, approval,
  status, and error events can become compact replay rows.
- Replay source channel is `web-ui`.
- Replay is bounded by the existing persisted replay limit.

## Excluded Fields

`replayExcludedFields` documents what the prototype intentionally excludes:

- per-token `message.delta` replay rows;
- full raw Hermes Runs event payloads;
- full stdout/stderr/output streams;
- binary/blob data;
- API keys, bearer tokens, credentials, and secrets;
- direct service URLs with secrets;
- command execution handles and rerun instructions;
- approval action handles;
- hidden/private reasoning text.

The preview metadata records `excludedMessageDeltaEvents` and
`runsNonDeltaEventTypes`, but it does not persist `message.delta` as replay
activity or raw event payload data.

## Smoke Result

A temporary Web UI child process was started on `http://127.0.0.1:3002` with:

```text
HERMES_UI_EXPERIMENTAL_RUNS_MODE=true
```

Command:

```text
npm run smoke:hermes:runs:experimental-chat -- --base-url http://127.0.0.1:3002 --require-hermes
```

Result: passed.

Observed:

| Field | Result |
| --- | --- |
| Mode | `success` |
| Run id | `run_ee9bbd2f82a94c289fc0c0290a7d993d` |
| Hermes session id | `hermes-session-session-runs-experimental-16g` |
| Final status | `completed` |
| Event types | `message.delta`, `reasoning.available`, `run.completed` |
| Event count | 15 |
| Message delta events | 13 |
| Activity replay preview rows | 2 |
| Tool events | 0 |
| Brain Memory tool events | 0 |
| Approval events | 0 |
| Assistant/output preview | `HERMES_RUNS_EXPERIMENTAL_CHAT_OK` |
| Local run record id | `run-preview-session-runs-experimental-16g-mptuh3wq` |

Smoke validations:

- `runRecordPreview` exists;
- `runRecordPreview.id` is distinct from the Hermes run id;
- `runRecordPreview.hermesRunId` matches `runId`;
- `status` is `completed`;
- `sourceChannel` is `web-ui`;
- `activityReplayPreview` is bounded;
- `message.delta` is not persisted as replay rows;
- hidden/private reasoning text is not persisted;
- unredacted bearer values are rejected by the smoke.

## Production Path Unchanged

Production chat still uses `/api/hermes/chat/stream`.

Experimental Runs remains flag-gated behind
`HERMES_UI_EXPERIMENTAL_RUNS_MODE=true`.

No default composer path was switched to Runs.

## Limitations

- The preview is based on the experimental route's observed event summaries,
  not a durable Hermes event ledger.
- The prototype does not write to workspace/localStorage.
- Reconnect/resume is not implemented.
- Server-side stop is not wired into the production composer.
- Approval actions remain display-only; no approval buttons were added.
- Provider/model switching remains deferred.
- The composer Agent access selector was not implemented.

## Boundaries Confirmed

- Production chat still uses `/api/hermes/chat/stream`.
- No direct browser-to-Hermes path was added.
- No direct browser-to-Brain Memory Gateway path was added.
- No direct browser-to-storage path was added.
- No Brain Memory BFF logic was changed.
- No Brain Memory mutation/admin UI was added.
- No project/session stable keys were changed.
- No provider/model switching was implemented.
- No Hermes source or Brain Memory source was modified.
- No secrets were printed or committed.

## Next Recommended Slice

Slice 16L: gated Runs replay UI hydration experiment.

Reason: 16K proves the experimental BFF can produce a Web UI-compatible
`RunRecord` and bounded replay preview. The next safe step is a disabled
experimental UI hydration path that can insert this preview into local
workspace state for inspection without replacing the session stream default.
