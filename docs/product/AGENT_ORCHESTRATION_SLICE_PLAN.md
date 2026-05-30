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

Deliver:

- live verification of Hermes model/provider behavior;
- capability-driven selector state;
- high-rate stream stress test;
- virtualized transcript plan if needed;
- clear UI copy for runtime vs cosmetic model selection.

### 13K - Brain Memory Event Timeline

Goal: make memory activity transparent.

Deliver:

- memory retrieval/store event rows from Hermes Brain Memory tool events;
- read-only Gateway evidence linking;
- project/session scope status in timeline;
- no memory mutation/admin actions.

### 13L - Command Execution Details/stdout/stderr UI

Goal: render command/tool output in a Codex-like, inspectable way.

Deliver:

- command event detection;
- stdout/stderr preview and expansion;
- exit code and duration;
- truncation handling;
- raw payload redaction rules.

### 13M - Production-Grade Run History/Session Replay

Goal: let users revisit what happened in a run/session.

Deliver:

- persisted normalized activity events where appropriate;
- replay model for session transcript plus activity;
- run summary;
- failure/retry history;
- export shape.

## Recommended Next Slice

Slice 13J - Provider/Model Selector And Cerebras/Kimi Fast-Stream UX.

Reason:

- Slice 13I established artifact metadata and disabled preview/download until
  a verified artifact service exists.
- Provider/model selection is the next visible deferred control, and it needs
  live Hermes behavior verification before the UI should expose more than the
  current placeholder.
