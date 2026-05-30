# Roadmap — Hermes UI + Brain Memory Studio

Last updated: 2026-05-31
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

## Checkpoint: Slice 13F thinking and elapsed activity UX

Slice 13F refined live progress affordances on 2026-05-30. The generic
`Thinking...` row now yields to the latest specific active public activity
event, run/status events can derive safer durations, real Hermes sends append a
display-only elapsed marker such as `Worked for 3s`, and regression checks cover
duration formatting plus no private chain-of-thought labels. Hermes streaming,
Brain Memory BFF logic, memory scope bridge behavior, stable keys, and
mutation/admin boundaries remain unchanged. See
`docs/product/THINKING_ELAPSED_UX_13F.md`.

## Checkpoint: Slice 13G stop/cancel streaming

Slice 13G enabled an honest stop control on 2026-05-30 for the current
session-stream chat path. The UI now aborts the active browser-to-BFF stream,
the BFF propagates the abort signal to the upstream Hermes session-stream fetch,
and the transcript records a `Stopped` cancelled activity row without claiming
server-side `/v1/runs/{run_id}/stop`. A new opt-in `npm run smoke:ui:stop`
browser smoke covers the behavior. Brain Memory logic, memory scope bridge
behavior, stable keys, and memory mutation/admin boundaries remain unchanged.
See `docs/product/STOP_CANCEL_STREAMING_13G.md`.

## Checkpoint: Slice 13H approvals UX

Slice 13H added safe, display-only Hermes approval activity UX on 2026-05-30.
The BFF now preserves `approval.*` stream frames as normalized approval events,
the frontend activity model carries approval metadata, and the transcript can
render waiting/responded/denied approval rows with redacted details. No approval
action route or approve/deny controls were added because the current production
chat path is session-stream based while Hermes approval responses are scoped to
active `/v1/runs` records. Browser-to-Hermes, Brain Memory mutation/admin, and
direct storage boundaries remain unchanged. See
`docs/product/APPROVALS_UX_13H.md`.

## Checkpoint: Slice 13I files/artifacts panel foundation

Slice 13I added the first read-only Files/Artifacts panel foundation on
2026-05-30. The UI now has a typed `StudioArtifact` model, normalizes legacy
local artifact metadata, maps artifact-shaped activity payloads when present,
and clearly labels the Files tab as local/mock only while Hermes lacks verified
artifact upload, list, preview, or download endpoints. No BFF artifact route,
direct storage access, browser-to-Hermes call, Brain Memory mutation/admin
action, or Hermes streaming change was added. See
`docs/product/FILES_ARTIFACTS_PANEL_13I.md`.

## Checkpoint: Slice 13J provider/model selector foundation

Slice 13J added an honest provider/model selector foundation on 2026-05-31.
Hermes currently advertises `hermes-agent` through `/v1/models`, but the Studio
keeps runtime switching disabled because the reviewed API server resolves the
actual model from server-side Gateway config and does not verify
`X-Hermes-Model` for the session-stream path. The composer and Hermes status
panel now distinguish server-configured model state from future
client-selectable model state, and the chat request no longer sends a fake
placeholder model unless Hermes capabilities report verified client selection.
Fast-stream constraints for future Cerebras/Kimi-like providers are documented
without adding provider calls or credentials. See
`docs/product/PROVIDER_MODEL_SELECTOR_13J.md`.

## Checkpoint: Slice 13K Brain Memory event timeline

Slice 13K added the first read-only Brain Memory event timeline on 2026-05-31.
The app now shares live normalized `AgentActivityEvent` state between the chat
transcript and right rail, derives compact `MemoryTimelineItem` rows for
store/search/retrieve/health_check/update/delete/unknown operations, and shows
the timeline in the Memory tab with collapsed redacted details and honest empty
state behavior. Gateway status/search/detail remain separate and
Gateway-mediated; optional memory detail click-through only uses the existing
read-only BFF inspect route when Gateway is real/reachable. No memory
mutation/admin actions, direct Gateway/storage paths, provider calls, or Hermes
streaming changes were added. See
`docs/product/BRAIN_MEMORY_EVENT_TIMELINE_13K.md`.

## Checkpoint: Slice 13L command execution details

Slice 13L added first-class command execution detail rendering on 2026-05-31.
Command-like Hermes/MCP tool events now extract structured command metadata
including command text, args, cwd, exit code, duration, stdout/stderr/output
previews, and future source/channel labels such as web-ui, telegram, cli, and
api. The chat transcript renders command details collapsed by default with
redacted/truncated previews, and the Tools tab now includes a read-only Recent
commands summary with an honest empty state. No browser command execution,
direct browser-to-Hermes/Gateway/storage path, Hermes streaming change, Brain
Memory logic change, Telegram integration, or provider integration was added.
See `docs/product/COMMAND_EXECUTION_DETAILS_13L.md`.

## Checkpoint: Slice 13M run history and session replay foundation

Slice 13M added a local Web UI run-history foundation on 2026-05-31. Sessions
now persist compact `RunRecord` metadata for Web UI-created sends, including
status, source channel, message ids, Hermes session id, optional Hermes run id,
timestamps, provider/model labels, linked live activity event ids, and activity
counts. The Context rail shows recent runs with an inspectable detail summary,
and workspace/UI smokes cover empty, completed, stopped, failed, and legacy
normalization states. Full activity event persistence, backend run history,
cross-channel discovery, retry/rerun controls, and export remain deferred. See
`docs/product/RUN_HISTORY_SESSION_REPLAY_13M.md`.

## Checkpoint: Slice 13N persisted activity replay

Slice 13N added bounded, redacted `PersistedActivityEvent` snapshots to
`RunRecord.activityReplay[]` on 2026-05-31. Web UI-created runs now keep compact
display metadata for activity replay after refresh, including source/channel,
status, timing, Hermes ids, Brain Memory scope labels, command previews,
approval metadata, artifact hints, and redacted details previews. The Context
rail shows persisted replay for selected runs. Full raw payloads, full
stdout/stderr/output, secrets, binaries, command rerun handles, backend
persistence, cross-channel discovery, and Telegram integration remain excluded.
See `docs/product/PERSISTED_ACTIVITY_REPLAY_13N.md`.

## Checkpoint: Slice 13O reload replay and export preview

Slice 13O added an opt-in `npm run smoke:ui:replay` browser smoke on
2026-05-31 that requires live Hermes, sends through the existing composer/BFF
path, reloads the page, and verifies selected-session replay survives
hydration. The Context rail now exposes a collapsed local-only export preview
for the active session, including transcript, run records, memory scope, and
bounded persisted replay counts while excluding or redacting raw payloads,
full output, credentials, binaries, and secret service URLs. No copy/download,
backend export, import, command rerun, direct browser-to-service call, storage
access, or memory mutation/admin action was added. See
`docs/product/RELOAD_REPLAY_EXPORT_PREVIEW_13O.md`.

## Checkpoint: Slice 14A local studio launcher

Slice 14A added a lightweight local launcher foundation on 2026-05-31.
`npm run studio:launch` now provides a safe daily checklist for env, Node/npm,
Web UI reachability, Next static chunk freshness, Hermes direct/BFF status,
Brain Memory mock/live state, optional smoke commands, browser open flow, and
clear next commands. `npm run studio:launch:smoke` runs the launcher plus the
route/BFF and browser smoke checks. The launcher does not install or start
Hermes/Brain Memory, modify `~/.hermes`, manage Docker/systemd, kill stale
servers, delete `.next`, change UI/backend behavior, or implement
export/import. See `docs/packaging/STUDIO_LAUNCHER_14A.md`.

## Checkpoint: Slice 14B launcher port diagnostics

Slice 14B hardened launcher diagnostics on 2026-05-31. The launcher now scans
local Web UI ports `3000` through `3007`, classifies likely/stale/unrelated
servers, reports exact failing Next static chunks, prints Windows/Linux/WSL
process hints, probes common Brain Memory Gateway URLs `8080` and `8765`, and
adds browser root/zoom guidance plus structured JSON diagnostics. It remains
non-destructive: no service install/start/stop, stale-server kill, `.next`
delete, backend logic change, or export/import was added. See
`docs/packaging/STUDIO_LAUNCHER_14B_PORT_DIAGNOSTICS.md`.

## Checkpoint: Slice 14C launcher guided recovery

Slice 14C added print-only guided recovery and explicit server selection on
2026-05-31. `npm run studio:launch` now supports `--base-url`,
`--no-port-scan`, and `--recovery`, passes the selected base URL through to the
existing MVP/UI smoke scripts, recommends canonical healthy Studio targets,
prints stale-server/static-chunk recovery commands without executing them, and
expands JSON diagnostics with selected URL, healthy/broken ports, static chunk
failures, recommended actions, recovery commands, and warning/failure summaries.
No process kill, `.next` deletion, service management, env mutation, backend
logic change, or export/import was added. See
`docs/packaging/STUDIO_LAUNCHER_14C_GUIDED_RECOVERY.md`.

## Checkpoint: Slice 14D rich response renderer

Slice 14D upgraded assistant message rendering on 2026-05-31. Assistant
responses now use safe `react-markdown` plus `remark-gfm`, skip raw HTML, avoid
`dangerouslySetInnerHTML`, render polished headings/lists/quotes/links/tables,
show dark themed fenced code blocks with lightweight React token coloring, add
code-copy and full-message copy actions, and avoid eager syntax highlighting
while messages are streaming. User messages remain simple and right-aligned.
No Hermes streaming, Brain Memory BFF, memory scope, backend, storage,
mutation/admin, or export/import behavior changed. See
`docs/design/RICH_RESPONSE_RENDERER_14D.md`.

## Checkpoint: Slice 14E markdown fixture smoke

Slice 14E added deterministic rich-response fixture coverage on 2026-05-31.
`/design/markdown-fixture` renders a complete assistant markdown fixture plus a
partial streaming fixture without calling Hermes, Brain Memory, localStorage,
or external services. `npm run smoke:markdown` verifies headings, paragraphs,
lists, task lists, blockquotes, tables, inline code, fenced code blocks, safe
links, copy buttons, raw HTML safety, partial markdown handling, dark code
styling, and horizontal overflow. Source checks now assert the fixture and smoke
contracts. No backend, Hermes, Brain Memory, memory mutation/admin, direct
service, storage, or export/import behavior changed. See
`docs/design/MARKDOWN_FIXTURE_SMOKE_14E.md`.

## Checkpoint: Slice 14F message renderer performance budget

Slice 14F hardened the rich assistant renderer on 2026-05-31 for longer
transcripts and high-throughput streams. It added
`docs/design/MESSAGE_RENDERER_PERFORMANCE_BUDGET_14F.md`,
`/design/markdown-long-fixture`, and `npm run smoke:markdown:long`; memoized
unchanged markdown/message/activity rendering paths; bounded long code blocks
with internal scroll; protected wide tables, long links, copy feedback, and raw
HTML safety. No backend, Hermes, Brain Memory, memory mutation/admin, direct
service, storage, auth, provider, or export/import behavior changed.

## Checkpoint: Slice 14G smoke base URL hygiene

Slice 14G hardened stale-server recovery and smoke base URL diagnostics on
2026-05-31. Smoke scripts now print the selected base URL, browser smokes run a
bounded Next static chunk preflight before deep interaction, markdown smokes no
longer silently switch ports, and `studio:launch:smoke` passes the selected
base URL through MVP, UI, markdown, and long markdown smokes. The launcher now
fails when the selected server is stale/broken while keeping stale non-selected
servers as warnings with print-only recovery guidance. No process kill, `.next`
deletion, service start/stop, backend logic change, Hermes/Brain Memory change,
or export/import was added. See
`docs/packaging/STUDIO_SMOKE_BASE_URL_HYGIENE_14G.md`.

## Checkpoint: Slice 14H launcher contract tests and help output

Slice 14H added `npm run studio:launch -- --help` and
`npm run check:studio-launch` on 2026-05-31. The contract check verifies help
coverage, selected base URL handling, JSON report fields, secret redaction
shape, print-only recovery guidance, package script wiring, and the
non-destructive launcher safety boundary. It does not start/stop services,
delete `.next`, modify env files, change backend/Hermes/Brain Memory logic, or
implement export/import. See
`docs/packaging/STUDIO_LAUNCHER_14H_CONTRACT_TESTS.md`.

## Checkpoint: Slice 14I healthy Studio server recovery

Slice 14I added a manual healthy-server recovery workflow on 2026-05-31 for
the case where all detected Studio servers are stale/broken. The launcher now
prints explicit no-healthy-server guidance, supports the print-only
`--print-recovery-plan` alias, points to
`docs/runbooks/HEALTHY_STUDIO_SERVER_RECOVERY.md`, and tells users to verify a
fresh selected base URL before browser smokes. `npm run check:studio-launch`
now covers the recovery runbook and no-healthy-server contract. No process
kill, `.next` deletion, service start/stop, env mutation, backend logic change,
Hermes/Brain Memory change, direct browser-to-service path, or export/import
was added. See
`docs/packaging/STUDIO_LAUNCHER_14I_HEALTHY_SERVER_RECOVERY.md`.

## Checkpoint: Slice 14J optional Web UI dev-server wrapper

Slice 14J added an explicit optional wrapper for starting only the Web UI dev
server on 2026-05-31. `npm run studio:web` checks the selected port, refuses
stale/broken or occupied targets, starts the root Next.js dev command only when
safe, supports `--port`, `--host`, `--open`, `--smoke`, `--ui-smoke`,
`--dry-run`, and forwards Ctrl+C only to the child process it started.
`npm run studio:web:3002` provides the common recovery-port shortcut. The
wrapper does not kill existing processes, delete `.next`, modify env files,
manage Hermes/Brain Memory/Docker/systemd, change backend/Hermes/Brain Memory
logic, or implement export/import. See `docs/packaging/STUDIO_WEB_DEV_14J.md`.

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
