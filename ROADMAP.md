# Roadmap — Hermes UI + Brain Memory Studio

Last updated: 2026-05-30
Target local path: `C:\Users\Alexey\.cursor\projects\hermes-ui`

## 1. Goal

Build a beautiful, local, ChatGPT-like Web UI for Hermes Agent, packaged together with Brain Memory as a complete downloadable workspace.

The finished product should let a user:

1. create and switch between projects,
2. open titled chat sessions under each project,
3. get immediate project context when switching projects,
4. chat with Hermes Agent through Hermes' API/gateway,
5. use Brain Memory for persistence across sessions,
6. inspect Brain Memory through a dedicated UI console,
7. optionally select very fast providers/models such as Cerebras-hosted Kimi K2.6 without the UI becoming the bottleneck.

## 2. Product shape

Working name: **Brain Memory Studio**.

Core promise:

> A local ChatGPT-like workspace with transparent long-term memory.

The UI should have:

- left sidebar: projects and titled sessions,
- center: polished chat interface,
- right panel: active context, tool calls, memory evidence, files/artifacts,
- memory console: search, evidence, layers, supersession, audit,
- settings: Hermes endpoint, Brain Memory endpoint, model/provider selection, project memory policy.

## 3. Current verified assumptions

Slice 0 re-checked Hermes Agent on 2026-05-29 against official docs and source at NousResearch/hermes-agent HEAD `a87f0a82a52178b05ff7405e9af7137e20a70bbf`.

- Hermes Agent is open-source/MIT and self-hosted.
- Hermes exposes an OpenAI-compatible API server for frontends.
- Hermes API server supports OpenAI-style `/v1/chat/completions` and richer `/v1/responses`, `/api/sessions`, and `/v1/runs` endpoints.
- Hermes supports session continuity with `X-Hermes-Session-Id` and memory scoping with `X-Hermes-Session-Key`.
- Hermes exposes `/v1/capabilities`, `/v1/models`, `/v1/skills`, `/v1/toolsets`, `/health`, and `/health/detailed`.
- Hermes runs expose event streaming, approvals, stop/interrupt, and pollable run status.
- Brain Memory integration should remain Gateway-controlled.
- Cerebras-hosted Kimi K2.6 is claimed by Cerebras to approach ~1,000 output tokens/sec, so the UI must batch and virtualize streaming output.

See `docs/architecture/HERMES_DISCOVERY.md` and `docs/research/SOURCES.md` for source notes.

## 4. Architecture principle

There are two separate integration paths:

```text
Agent memory path:
Browser UI -> Web UI Backend/BFF -> Hermes Agent -> Brain Memory MCP/skill -> Brain Memory Gateway -> storage layers
```

```text
Memory observability/admin path:
Browser UI -> Web UI Backend/BFF -> Brain Memory Gateway UI API -> controlled read/admin endpoints -> storage layers
```

The Web UI must never bypass the Brain Memory Gateway to mutate memory.

## Checkpoint: Slice 12A MVP baseline

Slice 12A captured an MVP launch-readiness baseline on 2026-05-30. The current
production shell, Hermes live status/streaming path, project/session state,
Brain Memory BFF mock/unconfigured behavior, route matrix, and regression check
matrix are documented in
`docs/checkpoints/MVP_CHECKPOINT_12A.md`.

## Checkpoint: Slice 12D UI interaction contract

Slice 12D captured the MVP UI interaction contract on 2026-05-30. The audit
separates working behavior, mock/local behavior, placeholders, broken controls,
and hidden/removed controls so future slices can change behavior intentionally.
The contract is documented in `docs/product/UI_INTERACTION_CONTRACT_12D.md`.

## Checkpoint: Slice 12E browser interaction smoke

Slice 12E added a lightweight Playwright browser smoke on 2026-05-30. The
`npm run smoke:ui` command verifies root load, sidebar rows, rail toggles,
settings popover, right rail tabs, composer typing, disabled placeholders, and
horizontal overflow. Details are documented in
`docs/checkpoints/UI_INTERACTION_SMOKE_12E.md`.

## Checkpoint: Slice 12F local launch runbook

Slice 12F added the MVP local launch runbook on 2026-05-30. The runbook covers
Web UI startup, Hermes live checks, optional Brain Memory Gateway checks, smoke
commands, stale dev-server recovery, browser scaling, Playwright install, and
secrets safety. See `docs/runbooks/MVP_LOCAL_LAUNCH_RUNBOOK.md`.

## Checkpoint: Slice 12G optional live composer send smoke

Slice 12G added an opt-in browser smoke gate on 2026-05-30 for live composer
send behavior. `npm run smoke:ui:send` requires real, reachable Hermes, sends
one unique message through the UI/BFF path, waits for a non-empty assistant
response, and keeps the default browser smoke non-mutating. Details are
documented in `docs/checkpoints/LIVE_SEND_SMOKE_12G.md`.

## Checkpoint: Slice 13A Hermes-native agent orchestration contract

Slice 13A re-verified current upstream Hermes API docs/source on 2026-05-30 at
HEAD `5921d667855880b0aa2083a50f001748aed52f3e` and captured the next product
contract. Hermes UI should evolve from an MVP chat shell into a
Hermes-native agent orchestration studio: ChatGPT-like sessions, Codex-like
activity, transparent Brain Memory, and capability-driven Hermes controls.

Concise roadmap:

- Hermes-native agent orchestration: use `/v1/capabilities` first, keep the
  BFF boundary, move commercial-grade activity toward `/v1/runs` and run
  events, then add real stop/cancel and approvals.
- ChatGPT-like sessions: make session storage, auto-title, history, rename,
  archive/delete, search, summaries, and project context restoration reliable.
- Codex-like activity: normalize Hermes events into stable activity blocks for
  tools, commands, reasoning, approvals, errors, elapsed time, and artifacts.
- Brain Memory transparency: keep Gateway-mediated read-only inspection, show
  scoped retrieval/store events, evidence, supersession, and audit trails before
  any future admin action.

Contract docs:

- `docs/architecture/HERMES_API_UX_CONTRACT.md`
- `docs/product/AGENT_ORCHESTRATION_UX_CONTRACT.md`
- `docs/product/AGENT_ACTIVITY_EVENT_MODEL.md`
- `docs/architecture/HERMES_EVENT_NORMALIZATION_PLAN.md`
- `docs/product/AGENT_ORCHESTRATION_SLICE_PLAN.md`

## Checkpoint: Slice 13B session title and history polish

Slice 13B tightened the local ChatGPT-like project/session history model on
2026-05-30. New sessions now carry additive title metadata, first-message
auto-title records its source, manual rename wins over later auto-title, recent
chat/history rows show derived updated-time metadata, and browser/workspace
smokes cover the new session-history contract. Stable keys, Hermes session ids,
Brain Memory scope, Hermes streaming, and BFF boundaries remain unchanged. See
`docs/product/SESSION_HISTORY_CONTRACT_13B.md`.

## Checkpoint: Slice 13C Hermes capability mapping

Slice 13C added a typed `uiCapabilities` interpretation layer to Hermes status
on 2026-05-30. The UI now distinguishes Hermes-advertised capabilities from
features that remain deferred in the Web UI, including runs, stop/cancel,
approvals, tools, files/artifacts, provider/model selection, and memory scope
headers. Hermes streaming, Brain Memory BFF logic, memory scope bridge behavior,
stable keys, and admin/mutation boundaries remain unchanged. See
`docs/architecture/HERMES_CAPABILITY_MAPPING_13C.md`.

## Checkpoint: Slice 13D AgentActivityEvent model

Slice 13D added the first runtime `AgentActivityEvent` frontend type and Hermes
stream mapping helpers on 2026-05-30. Current `tool_event`, `run_event`, and
`error` stream events can now be normalized into a stable activity model with
Brain Memory tool classification, command-like detection, run/status mapping,
elapsed-event support, and redacted raw details. The UI still projects mapped
events into the existing compact session `toolEvents` state; no persisted
workspace schema change, Hermes streaming change, Brain Memory BFF change, or
memory mutation/admin action was added. See
`docs/product/AGENT_ACTIVITY_EVENT_MODEL_13D.md`.

## Checkpoint: Slice 13E agent activity blocks

Slice 13E added collapsed Codex-like `AgentActivityBlock` rendering on
2026-05-30. Live Hermes `tool_event`, `run_event`, and `error` events now feed
non-persisted `AgentActivityEvent` blocks in the chat transcript, while
existing compact `Session.toolEvents` remain available for compatibility and
right-rail state. Brain Memory-classified events render as memory activity,
generic tools render as tool activity, command-like payloads render as command
activity, and expanded details use redacted JSON. No persisted workspace schema
change, Hermes streaming change, Brain Memory BFF change, or memory
mutation/admin action was added. See
`docs/product/AGENT_ACTIVITY_BLOCKS_13E.md`.

## 5. Recommended technical direction

Codex should validate this in Slice 0 before writing app code.

Default recommendation:

```text
hermes-ui/
  apps/
    web/                    # Next.js/React TypeScript app + BFF route handlers
  packages/
    hermes-client/           # typed Hermes API client
    brain-memory-client/     # typed Brain Memory Gateway client
    ui/                      # reusable UI primitives later, if needed
  docs/
  scripts/
  docker-compose.yml         # later packaging
```

Why this direction:

- TypeScript/React is strong for chat, layouts, streaming, and visual polish.
- A server-side BFF keeps API keys out of the browser.
- Typed clients prevent Hermes/Brain Memory contracts from leaking into UI components.
- The monorepo remains easy to package with Brain Memory later.

Codex may challenge this in Slice 0, but any alternative must preserve the boundary rules and explain the tradeoff in an ADR.

## 6. Data model concept

Minimum conceptual entities:

```text
Workspace
  Project
    ChatSession
      Message/Event cache
    ProjectContextPolicy
    MemoryScope
    ModelPreference
```

Draft fields:

```text
Project:
  id
  name
  description
  icon
  tenant_id
  memory_scope_key
  default_model
  created_at
  updated_at

ChatSession:
  id
  project_id
  hermes_session_id
  title
  summary
  model
  created_at
  updated_at
  archived_at

Message/Event:
  id
  session_id
  role
  content
  event_type
  created_at
  hermes_response_id
  run_id
```

Important: the UI may cache message previews and titles, but Hermes/Brain Memory should remain authoritative for agent behavior and memory.

## 7. Slice plan

### Slice 0 — Discovery, repo setup, and architecture decision

Reasoning: **high**.

Do not write application code yet.

Deliver:

- `git init` if not already initialized,
- `docs/architecture/HERMES_DISCOVERY.md`,
- `docs/architecture/BRAIN_MEMORY_UI_ENDPOINTS_PROPOSAL.md`,
- `docs/architecture/ADR-0001-stack-and-integration.md`,
- `docs/design/OPENAI_DARK_UI_BRIEF.md`,
- `docs/process/CODEX_WORKFLOW.md`,
- updated roadmap notes if Codex finds better current Hermes endpoints,
- first commit with docs only.

Acceptance:

- Codex has reviewed Hermes docs/source.
- Codex has documented exactly which Hermes endpoints the UI should use.
- Codex has selected stack and justified it.
- Codex has not scaffolded the UI yet.

### Slice 1 — App scaffold + OpenAI-inspired dark design shell

Reasoning: **medium**.

Goal: beautiful static shell with mocked data only.

Deliver:

- TypeScript app scaffold,
- design tokens,
- left project/session sidebar,
- central chat surface,
- right context/memory/tool panel,
- settings drawer or page,
- responsive layout,
- no real Hermes or Brain Memory calls.

Acceptance:

- app runs locally,
- mock projects and sessions visible,
- dark theme is polished and original, not a direct brand copy,
- components are cleanly separated,
- no backend business logic.

### Slice 2 — Projects and sessions UX with local mock persistence

Reasoning: **medium**.

Goal: make the UI feel like a real ChatGPT-like workspace before integration.

Deliver:

- create/rename/delete/archive projects,
- create/rename/delete/archive sessions,
- auto-title placeholder flow,
- local mock persistence using a small storage adapter,
- empty states and loading states.

Acceptance:

- switching projects updates visible sessions,
- switching sessions updates the active chat,
- no Hermes calls yet,
- storage adapter can later be replaced with Hermes/Brain Memory-backed persistence.

### Slice 3 — Hermes connection layer and health/status

Reasoning: **high for first pass**, then medium.

Goal: typed Hermes client through a server-side BFF/proxy.

Deliver:

- environment config for Hermes endpoint and API key,
- server-side proxy route/client,
- `/health`, `/health/detailed`, `/v1/models`, `/v1/capabilities` support,
- connection status UI,
- safe error handling.

Acceptance:

- API keys are not exposed to browser JS,
- UI can show Hermes online/offline/capabilities,
- failure states are clear,
- no chat streaming yet.

### Slice 4 — Real Hermes chat streaming and run events

Reasoning: **high**.

Goal: send messages to Hermes and stream responses safely.

Deliver:

- session-specific chat send,
- SSE/stream parser,
- incremental assistant message rendering,
- tool progress display,
- run status/events if available,
- stop/interrupt support if Hermes endpoint supports it,
- approval/clarification UI only if the API contract is clear.

Acceptance:

- one active session can stream a response,
- the UI does not lose messages on disconnect,
- stream rendering is batched and efficient,
- tool events are visually separated from assistant prose.

### Slice 5 — Project-aware context and Brain Memory integration contract

Reasoning: **high**.

Goal: wire project/session metadata so Brain Memory can provide continuity.

Deliver:

- project-to-memory-scope mapping,
- session-to-Hermes-session mapping,
- draft use of `X-Hermes-Session-Id` and `X-Hermes-Session-Key` or equivalent current API,
- Brain Memory Gateway UI API client skeleton,
- read-only project context preview.

Acceptance:

- switching projects changes the memory scope/context policy,
- no direct storage access,
- all Brain Memory calls go through Gateway endpoints,
- UI visibly shows active context source and scope.

### Slice 6 — Brain Memory read-only console

Reasoning: **high**.

Goal: make memory inspectable.

Deliver:

- memory search panel,
- evidence viewer,
- layer/source labels: canonical, semantic, hot, curated, RAGLight if available,
- supersession chain view,
- audit trail view,
- tenant/project/session filters.

Acceptance:

- console is read-only,
- results include source/layer/timestamp/scope metadata,
- retrieval evidence is understandable,
- no admin mutations yet.

### Slice 7 — Controlled Brain Memory admin actions

Reasoning: **high**.

Goal: Gateway-approved admin controls only.

Deliver:

- mark stale,
- supersede memory,
- pin/unpin or change importance if supported,
- delete only if Gateway policy allows,
- audit log for all admin actions,
- confirmation UX.

Acceptance:

- all mutations call Brain Memory Gateway endpoints,
- all actions are auditable,
- dangerous/destructive actions require explicit confirmation,
- no direct database writes.

### Slice 8 — Model/provider selector and Cerebras/Kimi fast-streaming mode

Reasoning: **medium-high**.

Goal: support fast models without UI lag.

Deliver:

- model/provider selector,
- Hermes model switch integration if available,
- fast-stream rendering mode,
- token batching via requestAnimationFrame or equivalent,
- virtualized long messages/transcripts,
- throughput metrics in dev mode.

Acceptance:

- UI does not call `setState` per token,
- 1,000 token/sec streams do not freeze the page,
- fast mode remains optional and provider-agnostic.

### Slice 9 — Packaging Brain Memory + Web UI

Reasoning: **medium-high**.

Goal: downloadable GitHub package.

Deliver:

- Docker Compose draft,
- `.env.example`,
- local setup scripts,
- health checks,
- docs for Windows/WSL2/macOS/Linux,
- backup/export/import plan.

Acceptance:

- a new user can clone and run locally,
- secrets are not committed,
- services have clear health status,
- package layout is understandable.

### Slice 10 — Polish, accessibility, QA, and release hardening

Reasoning: **medium for QA**, **low for small styling changes**.

Deliver:

- keyboard shortcuts,
- mobile layout,
- accessibility checks,
- loading/empty/error states,
- test coverage,
- visual regression or screenshot review if available,
- release checklist.

Acceptance:

- no obvious UI jank,
- accessible navigation,
- tests pass,
- release notes are clear.

## 8. Codex workflow rule

Use this pattern:

```text
Roadmap in repo -> Codex Slice prompt -> Codex proposes brief plan -> user approves/steers -> Codex implements only that slice -> tests -> commit -> review -> next slice
```

Do not ask Codex to build the whole product in one pass.

## 9. First prompt

Use:

```text
docs/codex/PROMPT_SLICE_00_DISCOVERY.md
```
