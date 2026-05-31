# Agent Orchestration Slice Plan

Date: 2026-05-30

## Purpose

This plan turns the Slice 13A UX/API contracts into implementation slices. The
sequence keeps the current MVP stable while moving Hermes UI toward a
commercial-grade Hermes-native orchestration studio.

## Future Slices

### 13B - Session Title And History Polish

Goal: make session history trustworthy and pleasant before deeper agent
orchestration work.

Status: completed in Slice 13B. See
`docs/product/SESSION_HISTORY_CONTRACT_13B.md`.

Deliver:

- auto session title from first user message;
- clearer recent-chat/session history behavior;
- rename/archive/delete contract review;
- local/Hermes title reconciliation plan;
- regression checks for title/history behavior.

### 13C - Hermes API Capabilities-Driven UI Mapping

Goal: make UI controls derive from Hermes capabilities instead of hardcoded
assumptions.

Status: completed in Slice 13C. See
`docs/architecture/HERMES_CAPABILITY_MAPPING_13C.md`.

Deliver:

- typed capability interpretation layer;
- UI capability matrix;
- disabled/hidden rules for runs, stop, approvals, sessions, skills/toolsets;
- tests for mock/unconfigured/partial capability states.

### 13D - AgentActivityEvent Frontend Type/Model

Goal: introduce the stable activity model without changing production behavior.

Status: completed in Slice 13D. See
`docs/product/AGENT_ACTIVITY_EVENT_MODEL_13D.md`.

Deliver:

- runtime TypeScript type;
- mapping helpers;
- fixture events;
- unit-style shape checks;
- no visual redesign.

### 13E - Render Hermes Tool/Memory Events As Codex-Like Activity Blocks

Goal: convert real Hermes tool/memory events into useful activity rows.

Status: completed in Slice 13E. See
`docs/product/AGENT_ACTIVITY_BLOCKS_13E.md`.

Deliver:

- `tool.progress`, `tool.started`, `tool.completed`, `tool.failed` mapping;
- memory event detection for Brain Memory tool names/payloads;
- compact timeline rows;
- right-rail details;
- regression smoke for existing stream behavior.

### 13F - Thinking/Reasoning Shimmer And Elapsed-Time Separators

Goal: make long-running work feel alive without fake decoration.

Status: completed in Slice 13F. See
`docs/product/THINKING_ELAPSED_UX_13F.md`.

Deliver:

- thinking row from real `message.started` or reasoning/progress events;
- elapsed time separators derived from timestamps;
- collapsed reasoning details;
- no per-token React state updates.

### 13G - Real Stop/Cancel Stream Support

Goal: replace the placeholder stop button with verified Hermes interruption.

Status: completed in Slice 13G. See
`docs/product/STOP_CANCEL_STREAMING_13G.md`.

Deliver:

- run-backed BFF stop route or verified cancellable session-stream strategy;
- UI stop state: stopping, cancelled, failed, completed;
- safeguards distinguishing client stream close from Hermes interrupt;
- smoke coverage.

### 13H - Approvals UX

Goal: represent Hermes approval requests safely.

Status: completed in Slice 13H. See
`docs/product/APPROVALS_UX_13H.md`.

Deliver:

- discovered run-scoped Hermes approval surface;
- display-only approval request/response activity rows;
- choices documented: once, session, always, deny;
- waiting state and post-response state mapping;
- audit-friendly redacted details;
- BFF approval response route deferred until chat uses a run-backed control
  plane.

### 13I - Files/Artifacts Panel

Goal: turn the files rail into a real artifact surface when a safe source
exists.

Status: completed in Slice 13I. See
`docs/product/FILES_ARTIFACTS_PANEL_13I.md`.

Deliver:

- artifact event contract;
- tool-generated file detection where payloads support it;
- file preview/download safety plan;
- no direct storage access.

### 13J - Provider/Model Selector And Cerebras/Kimi Fast-Stream UX

Goal: expose provider/model behavior honestly and keep fast streams smooth.

Status: completed in Slice 13J. See
`docs/product/PROVIDER_MODEL_SELECTOR_13J.md`.

Deliver:

- live verification of Hermes model/provider behavior;
- capability-driven selector state;
- high-rate stream stress test;
- virtualized transcript plan if needed;
- clear UI copy for runtime vs cosmetic model selection.

### 13K - Brain Memory Event Timeline

Goal: make memory activity transparent.

Status: completed in Slice 13K. See
`docs/product/BRAIN_MEMORY_EVENT_TIMELINE_13K.md`.

Deliver:

- memory retrieval/store event rows from Hermes Brain Memory tool events;
- read-only Gateway evidence linking;
- project/session scope status in timeline;
- no memory mutation/admin actions.

### 13L - Command Execution Details/stdout/stderr UI

Goal: render command/tool output in a Codex-like, inspectable way.

Status: completed in Slice 13L. See
`docs/product/COMMAND_EXECUTION_DETAILS_13L.md`.

Deliver:

- command event detection;
- stdout/stderr preview and expansion;
- exit code and duration;
- truncation handling;
- raw payload redaction rules.

### 13M - Production-Grade Run History/Session Replay

Goal: let users revisit what happened in a run/session.

Status: completed in Slice 13M. See
`docs/product/RUN_HISTORY_SESSION_REPLAY_13M.md`.

Deliver:

- local persisted `RunRecord` metadata for Web UI-created sends;
- replay foundation for session transcript plus compact run status/activity;
- run summary with source channel, timestamps, optional Hermes run id, and
  activity counts;
- completed/stopped/failed status history for local Web UI runs;
- export shape documented as deferred until persisted activity events exist.

### 13N - Persisted Activity Event Replay And Export Shape

Goal: preserve enough redacted activity detail to replay recent runs after
refresh and export a trustworthy local session bundle.

Status: completed in Slice 13N. See
`docs/product/PERSISTED_ACTIVITY_REPLAY_13N.md`.

Deliver:

- bounded persisted activity-event cache;
- redaction/truncation normalization before persistence;
- transcript plus run plus activity export shape;
- refresh/reload replay smoke;
- no backend persistence or cross-channel discovery.

### 13O - Reload Replay Smoke And Local Export Preview Surface

Goal: make persisted replay survivability and export shape visible without
adding backend persistence.

Status: completed in Slice 13O. See
`docs/product/RELOAD_REPLAY_EXPORT_PREVIEW_13O.md`.

Deliver:

- browser smoke that sends a run, reloads, and verifies persisted replay;
- local export preview helper/view if still low-risk;
- no command rerun or agent re-execution behavior;
- no direct service/storage calls.

### 13P - Local Export Download And Import Validation Contract

Goal: define a safe local file export/import contract before adding durable
backup, cloud sync, or backend persistence.

Deliver:

- validate the JSON export shape with clear versioning;
- add a safe local download/copy path only if redaction and size limits remain
  enforced;
- define import validation without merging imported data automatically;
- keep all behavior local, explicit, and display-only until the contract is
  proven.

### Future - Session Context Compaction

Goal: preserve long-session continuity with user-visible, Brain Memory-backed
summaries without exposing hidden chain-of-thought.

Status: deferred. See
`docs/product/SESSION_CONTEXT_COMPACTION_ROADMAP.md`.

Deliver later:

- manual compaction first;
- automatic compaction threshold later;
- compacted summaries stored through approved Brain Memory paths with
  project/session scope;
- transparent `Context compacted` UI and summary inspection;
- include/exclude compacted context controls;
- redaction and audit metadata;
- no silent fact changes or hidden reasoning exposure.

### Future - Scalable UI Loading Contract

Goal: define how long transcripts and large operational panels load without
rendering huge lists or creating scroll jank.

Status: measured and deferred for MVP. See
`docs/product/SCALABLE_UI_LOADING_ROADMAP.md` and
`docs/performance/SCALABLE_LOADING_DECISION_15S.md`.

Deliver later:

- docs-only scalable-loading contract;
- current transcript/list performance measurements;
- sidebar session/project pagination and `Show more`;
- activity and memory timeline pagination;
- chat transcript virtualization if measurement shows it is needed;
- cross-channel session discovery pagination when cross-channel sessions exist;
- keyboard and accessibility preservation for all progressive loading.

### 16C - Runs Event Normalization Parity With AgentActivityEvent

Goal: map raw Hermes Runs event payloads into the existing
`AgentActivityEvent` model before any experimental Runs UI execution mode.

Status: completed in Slice 16C. See
`docs/checkpoints/HERMES_RUNS_EVENT_NORMALIZATION_16C.md`.

Deliver:

- `message.delta` documented as assistant text buffer data, not activity rows;
- `reasoning.available` mapped as a safe public signal without raw reasoning
  text;
- `run.completed`, failure, cancellation, tool, approval, and unknown event
  parity checks;
- probe reporting that summarizes observed event normalization policy;
- no production chat switch, run stop, approval action, or Agent access
  selector.

### 16D - Brain Memory MCP Parity Test In Runs Flow

Goal: prove whether Hermes Runs can invoke Brain Memory MCP with the same
project/session scope as the current session-stream path.

Status: completed in Slice 16D. See
`docs/checkpoints/HERMES_RUNS_BRAIN_MEMORY_PARITY_16D.md`.

Deliver:

- opt-in BFF-only Runs Brain Memory probe;
- harmless scoped marker write through Hermes MCP;
- BFF search/inspect readback;
- different-project and different-session isolation checks;
- Runs memory/tool event normalization parity;
- no production chat switch, run stop, approval action, or Agent access
  selector.

### 16E - Server-Side Run Stop Experiment

Goal: prove Hermes `/v1/runs/{run_id}/stop` through a BFF-only experiment
without changing the production composer.

Status: completed in Slice 16E. See
`docs/checkpoints/HERMES_RUNS_STOP_EXPERIMENT_16E.md`.

Deliver:

- diagnostic `POST /api/hermes/runs/stop-probe` route;
- `npm run smoke:hermes:runs:stop`;
- harmless long counting prompt with no tools, memory, commands, files,
  browsing, external resources, or approvals;
- server-side stop request through the Hermes client;
- event/status reconciliation for stopped/cancelled/interrupted outcomes;
- no production chat switch, composer stop behavior change, approval action,
  or Agent access selector.

### 16F - Approvals Action Probe

Goal: prove Hermes `/v1/runs/{run_id}/approval` through a BFF-only experiment
without changing the production composer.

Status: completed in Slice 16F. See
`docs/checkpoints/HERMES_RUNS_APPROVAL_PROBE_16F.md`.

Deliver:

- diagnostic `POST /api/hermes/runs/approval-probe` route;
- `npm run smoke:hermes:runs:approval`;
- controlled terminal approval prompt with default `deny` response;
- event/status reconciliation for `approval.request` and `approval.responded`;
- approval redaction coverage for bearer values and token-like URL query
  values;
- no production chat switch, composer approval buttons, approval selector, or
  Agent access selector.

### 16G - Experimental Runs Mode Feature Flag

Goal: add a disabled-by-default Runs execution gate without changing the
production composer default.

Status: completed in Slice 16G. See
`docs/checkpoints/HERMES_RUNS_EXPERIMENTAL_MODE_16G.md`.

Deliver:

- feature flag `HERMES_UI_EXPERIMENTAL_RUNS_MODE=true`, default off;
- BFF-only `POST /api/hermes/runs/experimental-chat` route;
- `npm run smoke:hermes:runs:experimental-chat`;
- disabled-state HTTP 403 check when the flag is off;
- enabled basic live run check with `HERMES_RUNS_EXPERIMENTAL_CHAT_OK`;
- project/session stable key and memory-scope bridge preservation;
- no production chat switch, composer Agent access selector, approval buttons,
  provider/model switching, direct browser-to-Hermes path, or memory admin UI.

### 16H - Runs Default Migration Decision

Goal: decide whether the Studio should switch production chat to Hermes Runs
after the 16B-16G evidence.

Status: completed in Slice 16H. See
`docs/checkpoints/HERMES_RUNS_DEFAULT_DECISION_16H.md`.

Decision:

- keep session stream as the production default;
- keep Runs behind `HERMES_UI_EXPERIMENTAL_RUNS_MODE=true`;
- treat the 16G Brain Memory readback failure as an env/runbook gap after the
  16H full-env memory probe passed;
- do not add a composer Agent access selector yet.

### 16I - Runs Brain Memory Live Env/Runbook Hardening

Goal: make Runs + Brain Memory smoke failures identify the env or runtime
blocker instead of returning a generic unauthorized readback.

Status: completed in Slice 16I. See
`docs/checkpoints/HERMES_RUNS_BRAIN_MEMORY_ENV_HARDENING_16I.md`.

Deliver:

- redacted Web UI BFF env posture in the Runs memory probe;
- normalized blocker categories for Gateway config/auth, marker readback,
  scope mismatch, and Runs/MCP failure;
- runbook/env template documentation for `BRAIN_MEMORY_GATEWAY_MEMORY_API_KEY`
  versus optional `BRAIN_MEMORY_UI_API_KEY`;
- no production chat switch, composer Agent access selector, approval buttons,
  provider/model switching, direct browser-to-Hermes path, or memory admin UI.

### 16J - Runs Replay/History Reconciliation Plan

Goal: define how future Hermes Runs execution maps into existing Web UI
`RunRecord` and persisted activity replay without implementing production Runs
replay yet.

Status: completed in Slice 16J. See
`docs/architecture/HERMES_RUNS_REPLAY_RECONCILIATION_16J.md`.

Deliver:

- Runs-to-RunRecord mapping;
- Runs-to-AgentActivityEvent mapping;
- Runs-to-persisted replay mapping;
- backward compatibility and migration blocker list;
- future Agent access selector contract;
- no production chat switch, composer Agent access selector, approval buttons,
  provider/model switching, direct browser-to-Hermes path, or memory admin UI.

### 16K - Experimental Runs RunRecord/Replay Prototype

Goal: produce a Web UI-compatible `RunRecord` and bounded replay preview from
the existing experimental Runs BFF route without switching production chat to
Runs.

Status: completed in Slice 16K. See
`docs/checkpoints/HERMES_RUNS_RUNRECORD_REPLAY_PROTOTYPE_16K.md`.

Deliver:

- `runRecordPreview` on the feature-flagged experimental Runs response;
- `activityReplayPreview` from normalized Runs activity;
- `activitySummary` and `replayExcludedFields`;
- smoke validation that `message.delta` is not persisted as replay rows;
- no production chat switch, composer Agent access selector, approval buttons,
  provider/model switching, direct browser-to-Hermes path, or memory admin UI.

### 16L - Gated Runs Replay UI Hydration Experiment

Goal: prove the experimental Runs preview can hydrate the existing Run history
and Persisted replay UI through a test-only path.

Status: completed in Slice 16L. See
`docs/checkpoints/HERMES_RUNS_REPLAY_UI_HYDRATION_16L.md`.

Deliver:

- `npm run smoke:hermes:runs:replay-ui`;
- disabled-state check for flag-off behavior with no run and no hydration;
- enabled live smoke that calls `/api/hermes/runs/experimental-chat`;
- isolated Playwright `localStorage` hydration of `runRecordPreview` and
  `activityReplayPreview`;
- Run history verification for visible `hermesRunId`, `completed` status,
  activity summary, and persisted replay rows;
- no production chat switch, composer Agent access selector, approval buttons,
  provider/model switching, direct browser-to-Hermes path, or memory admin UI.

### 16M - Gated Production Runs Execution State Machine Contract

Goal: define the production Runs state machine and migration gates before any
composer switch.

Status: completed in Slice 16M. See
`docs/architecture/HERMES_RUNS_EXECUTION_STATE_MACHINE_16M.md`.

Deliver:

- state machine for `idle`, `preparing_context`, `creating_run`,
  `streaming_events`, `waiting_for_approval`, `stopping`, `stopped`,
  `completed`, `failed`, `reconnecting`, `replaying`, and `cancelled`;
- Browser/BFF/Hermes/Brain Memory responsibility split;
- future server-side Runs stop contract;
- future Runs approval action contract;
- future Agent access selector policy mapping;
- migration gates and rollback plan;
- no production chat switch, production Runs composer selector, approval
  buttons, direct browser-to-Hermes path, or memory admin UI.

### 16N - BFF Production Runs Route Contract And Event Envelope

Goal: define the future production Runs BFF route and browser-facing event
envelope before any route implementation or composer switch.

Status: completed in Slice 16N. See
`docs/architecture/HERMES_RUNS_BFF_EVENT_CONTRACT_16N.md`.

Deliver:

- future `POST /api/hermes/runs/chat/stream` request contract;
- `HermesRunsBffEvent` envelope for assistant deltas, activity, approvals,
  stop, terminal status, errors, replay snapshots, and reconnect;
- mapping into assistant text, `AgentActivityEvent`, `RunRecord`, and
  `activityReplay`;
- future stop and approval request/response envelopes;
- error taxonomy and replay/reconnect semantics;
- source checks that keep production session stream as the default and prevent
  accidental direct browser-to-Hermes paths.

Boundaries:

- no production chat switch;
- no production Runs route implementation;
- no composer Agent access selector;
- no approval buttons;
- no Brain Memory BFF, memory bridge, stable-key, or tenant-check change.

### 16O - Typed Runs BFF Event Envelope Fixtures And Reducer Checks

Goal: encode the future Runs BFF event envelope as typed browser fixtures and
pure reducer checks without implementing runtime execution.

Status: completed in Slice 16O. See
`docs/checkpoints/HERMES_RUNS_BFF_EVENT_FIXTURES_16O.md`.

Deliver:

- `HermesRunsBffEvent` TypeScript types;
- deterministic success, activity/tool, approval, stop, error,
  reconnect/replay, and `done` fixture sequences;
- pure local reducer helper for assistant text, `AgentActivityEvent`,
  `RunRecord`, `activityReplay`, approvals, errors, replay snapshot, and done
  state;
- `npm run check:hermes-runs-bff-events`;
- source checks proving the session stream remains present and the production
  Runs chat route is disabled-by-default after Slice 16P.

Boundaries:

- no production Runs route implementation;
- no production composer switch;
- no composer Agent access selector;
- no approval buttons;
- no direct browser-to-Hermes/Gateway/storage path.

### 16P - Disabled Production-Shaped Runs BFF Route Skeleton

Goal: add the final production-shaped Runs chat route path while keeping it
disabled by default and source-guarded against runtime execution.

Status: completed in Slice 16P. See
`docs/checkpoints/HERMES_RUNS_DISABLED_ROUTE_GUARD_16P.md`.

Deliver:

- `POST /api/hermes/runs/chat/stream` route skeleton;
- HTTP 501 JSON disabled response with
  `reason: "production_runs_route_not_enabled"`;
- explicit response flags for no Hermes run creation, no Hermes call, no Brain
  Memory call, no event stream, and session stream still default;
- `npm run smoke:hermes:runs:route-guard`;
- `npm run check:hermes-runs-bff-events` updated to expect a disabled
  skeleton instead of an absent route;
- `npm run check:ui-structure` source guard for the skeleton and guard script.

Boundaries:

- no production Runs execution runtime;
- no change to `/api/hermes/chat/stream`;
- no production composer switch;
- no composer Agent access selector;
- no approval buttons;
- no direct browser-to-Hermes/Gateway/storage path;
- no Hermes, Brain Memory, memory bridge, stable-key, or tenant-check change.

### 16Q - Disabled Runs BFF Request Validation Contract

Goal: define and source-check the future request validation contract for the
disabled production-shaped Runs route without changing route behavior.

Status: completed in Slice 16Q. See
`docs/checkpoints/HERMES_RUNS_REQUEST_VALIDATION_16Q.md`.

Deliver:

- `HermesRunsBffRequest` TypeScript request schema;
- memory scope request shape with tenant id, stable project key, stable session
  key, and explicit include-context booleans;
- future metadata fields for Agent access mode, provider, model, and options;
- pure `validateHermesRunsBffRequest` helper;
- deterministic valid and invalid request fixtures;
- `npm run check:hermes-runs-bff-request`;
- route guard update that posts a valid future request body while still
  expecting disabled HTTP 501 JSON.

Boundaries:

- no production Runs execution runtime;
- no route-level validation echo yet;
- no change to `/api/hermes/chat/stream`;
- no production composer switch;
- no composer Agent access selector;
- no approval buttons;
- no direct browser-to-Hermes/Gateway/storage path;
- no Hermes, Brain Memory, memory bridge, stable-key, or tenant-check change.

### 16R - Disabled Runs Validation Echo And Agent Access Policy

Goal: let the disabled production-shaped Runs route report safe validation
posture while documenting the future Agent access approval mode contract.

Status: completed in Slice 16R. See
`docs/checkpoints/HERMES_RUNS_DISABLED_ROUTE_VALIDATION_AND_AGENT_ACCESS_16R.md`
and `docs/architecture/AGENT_ACCESS_APPROVAL_POLICY_16R.md`.

Deliver:

- route-level validation echo using the pure `validateHermesRunsBffRequest`
  helper;
- HTTP 501 remains the response for valid and invalid request bodies;
- redacted `requestValidation` posture with `attempted: true`, `ok`,
  `errorKinds`, safe error paths, inert future-field labels, and
  `rawRequestEchoed: false`;
- explicit `execution` posture proving no Hermes run creation, no Hermes call,
  no Brain Memory Gateway call, no approval/stop call, no event stream, and no
  storage access;
- future Agent access policy modes for `chat_only`, `read_only_tools`,
  `ask_before_tools`, `full_access`, and `custom`;
- route guard and source checks for valid, invalid, and credential-like
  disabled requests.

Boundaries:

- no production Runs execution runtime;
- no change to `/api/hermes/chat/stream`;
- no production composer switch;
- no composer Agent access selector UI;
- no approval buttons;
- no direct browser-to-Hermes/Gateway/storage path;
- no Hermes, Brain Memory, memory bridge, stable-key, or tenant-check change.

### 16S - Disabled Runs Policy Fixture Matrix And Source-Only Agent Access Rendering Guard

Goal: add deterministic policy fixtures and source-only guards so Agent access
UI cannot appear enabled before BFF/Hermes enforcement exists.

Status: completed in Slice 16S. See
`docs/checkpoints/AGENT_ACCESS_POLICY_MATRIX_16S.md`.

Deliver:

- `agentAccessPolicyFixtures` for `chat_only`, `read_only_tools`,
  `ask_before_tools`, `full_access`, and `custom`;
- every mode marked `productionUiEnabled: false` and
  `enforcementAvailable: false`;
- explicit `full_access` warning that it is configured policy access, not
  unrestricted OS/system access;
- `npm run check:agent-access-policy`;
- source-only guard that Composer has no Agent access selector UI;
- source-only guard that production UI has no enabled `Full access` selector
  copy;
- disabled route guard cases for `chat_only`, `full_access`, and invalid
  `agentAccessMode`.

Boundaries:

- no production Runs execution runtime;
- no change to `/api/hermes/chat/stream`;
- no production composer switch;
- no composer Agent access selector UI;
- no approval buttons;
- no direct browser-to-Hermes/Gateway/storage path;
- no Hermes, Brain Memory, memory bridge, stable-key, or tenant-check change.

### 16T - Production Runs BFF Lifecycle Dry-Run Contract And No-Runtime Source Guard

Goal: define the full future production Runs BFF lifecycle as a no-runtime
dry-run contract while keeping the production route disabled.

Status: completed in Slice 16T. See
`docs/checkpoints/HERMES_RUNS_BFF_LIFECYCLE_DRY_RUN_16T.md`.

Deliver:

- `HermesRunsBffLifecycleStage` for validation, scope, Agent access policy,
  context, run creation, event streaming/polling, normalization, RunRecord,
  replay, approvals, stop, finalization, done, and error handling;
- pure `createHermesRunsBffLifecycleDryRun` helper;
- lifecycle dry-run fixtures for valid chat-only, valid ask-before-tools,
  missing scope, invalid Agent access, stop, approval, and error cases;
- disabled-route `lifecycleDryRun` response posture;
- `npm run check:hermes-runs-lifecycle`;
- route guard coverage that `lifecycleDryRun` stays disabled and runtime
  stages remain not executed.

Boundaries:

- no production Runs execution runtime;
- no Hermes run creation;
- no Hermes or Brain Memory Gateway call from the disabled route;
- no memory scope bridge import from the disabled route;
- no service env secret read from the disabled route;
- no change to `/api/hermes/chat/stream`;
- no production composer switch;
- no composer Agent access selector UI;
- no approval buttons;
- no direct browser-to-Hermes/Gateway/storage path.

### 16U - Disabled Runs Lifecycle Route-Response Fixture And Migration Gate Checklist

Goal: pin representative disabled route responses and the migration checklist
before any production Runs runtime implementation.

Status: completed in Slice 16U. See
`docs/architecture/HERMES_RUNS_PRODUCTION_MIGRATION_GATE_16U.md`.

Deliver:

- `hermesRunsDisabledRouteResponseFixtures` for valid minimal, valid full
  future, missing memory scope, credential-like field, and oversized message
  cases;
- pure `validateHermesRunsDisabledRouteResponse` helper;
- route guard live checks for valid minimal/full, invalid missing scope,
  credential-like, and oversized request bodies;
- migration gates for production route implementation and default migration;
- source checks proving the disabled route still returns HTTP 501 and does not
  call Hermes, Brain Memory Gateway, storage, service env, or the memory scope
  bridge.

Boundaries:

- no production Runs execution runtime;
- no Hermes run creation;
- no Hermes or Brain Memory Gateway call from the disabled route;
- no memory scope bridge import from the disabled route;
- no service env secret read from the disabled route;
- no change to `/api/hermes/chat/stream`;
- no production composer switch;
- no composer Agent access selector UI;
- no approval buttons;
- no direct browser-to-Hermes/Gateway/storage path.

## Recommended Next Slice

Slice 16V - production Runs implementation ADR and feature-flag contract.

Reason:

- Slice 16U pins the disabled route response contract and production migration
  gates.
- The next safe step is a docs/check-only ADR that names the exact production
  Runs feature flag, rollback posture, live smoke gates, and implementation
  acceptance criteria before any runtime code is added.
