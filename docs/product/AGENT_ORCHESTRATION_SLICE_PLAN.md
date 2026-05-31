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

## Recommended Next Slice

Slice 16E - Server-Side Run Stop Experiment.

Reason:

- Slice 16D proved Runs can store a Brain Memory marker through Hermes MCP,
  expose Brain Memory tool events, and preserve BFF search/inspect scope.
- The next safe control-plane gap is proving Hermes `/v1/runs/{run_id}/stop`
  through a BFF-only experiment without changing the production chat default.
