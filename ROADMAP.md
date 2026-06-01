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

## Future / Deferred: Session Context Compaction

Session Context Compaction is a future Brain Memory Studio capability, not an
implemented feature. The intended path is manual compaction first, automatic
compaction later, Brain Memory-backed summaries, explicit project/session
scope, transparent and auditable UI, and no hidden chain-of-thought. Future
summaries should preserve durable decisions, constraints, files touched, tool
activity, memory links, and open tasks without silently changing facts. See
`docs/product/SESSION_CONTEXT_COMPACTION_ROADMAP.md`.

## Future / Deferred: Scalable UI Loading

Scalable UI loading is a future capability, not an implemented feature. The
intended path is to measure long transcripts and large lists, add list limits
and `Show more` first, then add run/memory timeline pagination, chat transcript
virtualization only if needed, and cross-channel session pagination later. It
must preserve smooth scrolling, accessibility, visible "more available" states,
and no silent event dropping. See
`docs/product/SCALABLE_UI_LOADING_ROADMAP.md`.

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
stale/broken or occupied targets, starts only the Web UI dev command when safe,
supports `--port`, `--host`, `--open`, `--smoke`, `--ui-smoke`, `--dry-run`,
and forwards Ctrl+C only to the child process it started.
`npm run studio:web:3002` provides the common recovery-port shortcut. The
wrapper does not kill existing processes, delete `.next`, modify env files,
manage Hermes/Brain Memory/Docker/systemd, change backend/Hermes/Brain Memory
logic, or implement export/import. See `docs/packaging/STUDIO_WEB_DEV_14J.md`.

## Checkpoint: Slice 14K packaging readiness release gate

Slice 14K added a packaging readiness manifest and safe release gate on
2026-05-31. `docs/packaging/PACKAGING_READINESS_14K.md` now defines what is
ready, partially ready, not ready, deferred, release-gated, and not claimable
yet across Web UI standalone, Web UI + Hermes, attach-later Brain Memory,
future bundle mode, Brain Memory standalone, and future one-command packaging.
`npm run check:packaging` verifies the packaging docs/scripts contract, and
`npm run release:check` runs only safe source/build/audit checks without
requiring browser smokes or live services. No production installer, final
one-command distribution, service automation, backend/Hermes/Brain Memory
logic change, or export/import was added.

## Checkpoint: Slice 14L release notes and manual RC checklist

Slice 14L added release-candidate documentation on 2026-05-31:
`docs/release/RELEASE_NOTES_TEMPLATE.md`, `docs/release/MVP_RC_NOTES.md`,
`docs/release/MANUAL_RC_CHECKLIST.md`, and
`docs/release/RELEASE_DECISION_RECORD.md`. The checkpoint records the current
MVP RC posture, manual browser/live-service gates, release decision template,
and deferred/not-claimable items. No production installer, final one-command
distribution, service automation, backend/Hermes/Brain Memory logic, UI
behavior, memory mutation/admin action, or export/import was added.

## Checkpoint: Slice 14M manual RC dry run

Slice 14M recorded a concrete manual RC dry run on 2026-05-31 in
`docs/release/RELEASE_DECISION_14M.md`. The run established a healthy selected
Web UI server at `http://127.0.0.1:3002`, passed the safe release gate, browser
smokes, markdown fixture smokes, live Hermes send/stop checks, and manual
in-app browser evidence. The decision is pass with known limitations because
Brain Memory Gateway live mode was mock/unconfigured, stale non-selected
servers remained on `3000` and `3005`, and production installer,
one-command distribution, service automation, export/import, and memory
admin/mutation features remain deferred.

## Checkpoint: Slice 14N Windows/WSL Web UI dev wrapper hardening

Slice 14N hardened the optional `studio:web` wrapper on 2026-05-31. The wrapper
now starts the Web UI workspace Next CLI from `apps/web` with Node, avoids the
reproduced direct `spawn("npm.cmd", ...)` `EINVAL` for the long-running child,
keeps `npm.cmd`/`npm` selection for optional one-shot smoke commands, avoids
inherited stdio handles, pipes child logs to the console, handles child spawn
errors explicitly, stops only the Windows process tree rooted at its own child
PID, and reports root/static chunk health wait details. Dry-run and JSON output
now show the exact command. Root npm workspace argument forwarding was a
separate portability caveat. Contract checks and docs now cover these
behaviors. No product runtime logic, Hermes logic, Brain Memory BFF logic,
unrelated process killing, service management, `.next` deletion, env mutation,
Docker/systemd automation, or export/import was added. See
`docs/packaging/STUDIO_WEB_DEV_WINDOWS_HARDENING_14N.md`.

## Checkpoint: Slice 14O local bundle checklist consolidation

Slice 14O consolidated the current local MVP / RC packaging path on
2026-05-31. `docs/packaging/LOCAL_BUNDLE_CHECKLIST_14O.md` is now the first
operator checklist for supported modes, the `3002` Web UI recovery path,
Hermes live verification, attach-later Brain Memory, stale-server recovery,
release gates, safety boundaries, and deferred/not-claimable features.
`docs/packaging/README.md` indexes packaging, launcher, startup, recovery, and
release docs. README now links to the checklist instead of duplicating long
runbook steps. No installer, one-command bundle, export/import, service
automation, backend/Hermes/Brain Memory logic change, UI behavior change, env
mutation, or direct browser-to-service path was added.

## Checkpoint: Slice 14P final RC decision refresh

Slice 14P refreshed the manual RC decision on 2026-05-31 after the 14N
Windows/WSL launcher hardening and 14O local bundle checklist consolidation.
`docs/release/RELEASE_DECISION_14P.md` records a pass-with-known-limitations
decision for the current local Web UI + Hermes MVP path. Safe release checks,
launcher contract checks, help output, build, typecheck, audit, and the
`studio:web -- --port 3002 --dry-run` recovery check passed. The live launcher
diagnostic found no currently reachable Web UI server and did not claim live
Hermes or live Brain Memory Gateway availability. No installer, final
one-command bundle, export/import, service automation, backend/Hermes/Brain
Memory logic change, UI behavior change, env mutation, or direct
browser-to-service path was added. The next recommended functional slice is
Slice 15A: live Brain Memory full E2E reconnect.

## Checkpoint: Slice 15A live Brain Memory reconnect status

Slice 15A attempted the live Brain Memory full E2E reconnect on 2026-05-31 and
recorded the result in `docs/checkpoints/LIVE_BRAIN_MEMORY_E2E_15A.md`. The Web
UI route and browser smokes passed on the selected recovery server
`http://127.0.0.1:3002`, but live E2E remained blocked because Hermes was
unreachable, Brain Memory Gateway was not configured/reachable, and no
tenant-bound read key was available. The BFF correctly reported mock/disabled
Brain Memory state and no live marker was created. No Brain Memory
mutation/admin UI, direct browser-to-Gateway/storage path, Hermes streaming
logic change, or Brain Memory BFF logic change was added. The next recommended
slice is Slice 15B: bring up Brain Memory Gateway and a tenant-bound read key,
then rerun live E2E reconnect.

## Checkpoint: Slice 15B live Brain Memory prerequisite recovery

Slice 15B restored the live Brain Memory Gateway prerequisite on 2026-05-31 and
recorded the result in `docs/checkpoints/LIVE_BRAIN_MEMORY_E2E_15B.md`.
Brain Memory Gateway was started through its documented sibling-repo script on
`http://127.0.0.1:8080`, a tenant-bound key was located and used only as a
redacted temporary Web UI process env, and the Web UI BFF reported
`mode=real`, `reachable=true` for status/search/inspect. Full Hermes -> Brain
Memory marker E2E remains blocked because Hermes is not reachable at
`http://127.0.0.1:8642` and no `hermes` command is available in PATH. No
Brain Memory mutation/admin UI, direct browser-to-Gateway/storage path, Hermes
streaming logic change, Brain Memory BFF logic change, or env secret commit was
added. The next recommended slice is Slice 15C: start or attach Hermes Agent
API, then rerun the full marker E2E.

## Checkpoint: Slice 15C live Hermes to Brain Memory E2E

Slice 15C passed the full live Hermes to Brain Memory marker E2E on 2026-05-31
and recorded the result in
`docs/checkpoints/LIVE_BRAIN_MEMORY_E2E_15C.md`. Hermes was live at
`http://127.0.0.1:8642`, Brain Memory Gateway was live at
`http://127.0.0.1:8080`, the Hermes `brain_memory_mcp` child pointed at the
Gateway with a redacted key set, and the Web UI BFF reported real/reachable for
both Hermes and Brain Memory. A unique marker sent through
`/api/hermes/chat/stream` emitted `mcp_brain_memory_memory_store` events,
returned `BM_LIVE_E2E_STORED`, was found through BFF search, inspected with
matching project/session scope, and was absent from different project/session
searches. No Brain Memory mutation/admin UI, direct browser-to-Gateway/storage
path, Hermes streaming logic change, Brain Memory BFF change, or env secret
commit was added. The next recommended slice is Slice 15D: add an opt-in
UI-driven Brain Memory timeline smoke for live store/search events.

## Checkpoint: Slice 15D UI live Brain Memory timeline smoke

Slice 15D passed an opt-in UI-driven live Brain Memory timeline smoke on
2026-05-31 and recorded the result in
`docs/checkpoints/UI_MEMORY_TIMELINE_LIVE_SMOKE_15D.md`. The smoke runs through
the visible Web UI composer, verifies a Brain Memory activity block in chat,
verifies the right-rail Memory timeline, and confirms the live marker through
Gateway-mediated BFF search/inspect. The smoke recorded a tenant alignment
warning that was resolved in Slice 15E. No Brain Memory mutation/admin UI,
direct browser-to-Gateway/storage path, direct browser-to-Hermes path, Hermes
streaming logic change, Brain Memory BFF change, or env secret commit was
added.

## Checkpoint: Slice 15E Brain Memory tenant alignment

Slice 15E aligned the local Web UI tenant/scope contract with Hermes MCP and
Brain Memory Gateway on 2026-05-31 and recorded the result in
`docs/checkpoints/BRAIN_MEMORY_TENANT_ALIGNMENT_15E.md`. `local-dev` is now the
canonical local MVP tenant. New local/mock workspace state uses `local-dev`,
legacy `tenant-local` localStorage scopes normalize to `local-dev` only for the
old default stable-key pattern, and project ids, session ids, display titles,
title metadata, and Hermes session ids are preserved. The live memory timeline
smoke is now strict same-tenant and passed with 78 checks, 0 warnings, and 0
failures. No tenant checks were loosened, no Brain Memory mutation/admin UI,
direct browser-to-Gateway/storage path, direct browser-to-Hermes path, Hermes
streaming logic change, Brain Memory BFF change, or env secret commit was
added. The next recommended slice is Slice 15F: add tenant/scope diagnostics
that compare Web UI, Hermes MCP, and Gateway key posture without printing
secrets.

## Checkpoint: Slice 15F tenant/scope diagnostics

Slice 15F added a read-only tenant/scope diagnostics readout and developer
check on 2026-05-31 and recorded the result in
`docs/checkpoints/TENANT_SCOPE_DIAGNOSTICS_15F.md`. The Context rail now shows
collapsed diagnostics for the active UI tenant, project/session stable keys,
Hermes status, Brain Memory BFF status, scope bridge state, and redacted key
posture. `npm run check:tenant-scope` verifies local-dev scope, legacy
tenant-local normalization, custom tenant preservation, redaction, and source
boundaries. Live Hermes, Brain Memory Gateway, strict UI memory smoke, MVP
smoke, typecheck, build, and audit passed. No tenant checks were loosened, no
Brain Memory mutation/admin UI, direct browser-to-Gateway/storage path, direct
browser-to-Hermes path, or secret commit was added. The next recommended slice
is Slice 15G: broaden read-only multi-session scope-isolation regression.

## Checkpoint: Slice 15G Brain Memory scope isolation regression

Slice 15G added an opt-in live multi-session scope isolation smoke on
2026-05-31 and recorded the result in
`docs/checkpoints/BRAIN_MEMORY_SCOPE_ISOLATION_15G.md`.
`npm run smoke:ui:memory-scope` seeds Project A/A1/A2 and Project B/B1 in an
isolated browser context, stores a marker through the real composer in A1, then
verifies through BFF search/inspect that A1 finds it, A2 does not, and Project
B does not. Inspect detail reported `scope=matching-session` with tenant
`local-dev`. Project-only no-session search is documented as current
project-broad read behavior, not a Web UI project-level write path. No tenant
checks were loosened, no Brain Memory mutation/admin UI, direct
browser-to-Gateway/storage path, direct browser-to-Hermes path, or secret commit
was added. The next recommended slice is Slice 15H: document and contract-test
project-only read semantics separately from future project-level writes.

## Checkpoint: Slice 15H project-only read semantics

Slice 15H documented and contract-tested the MVP distinction between
session-scoped writes, project-only reads, and future project-level writes on
2026-05-31. The opt-in live memory-scope smoke now requires project-only
no-session reads to find the Project A / Session A1 marker while preserving the
original A1 session key and reporting `scopeStatus=matching-project`. This is
explicitly project-broad read behavior, not a project-level write path. No
tenant checks were loosened, no Brain Memory mutation/admin UI, direct
browser-to-Gateway/storage path, direct browser-to-Hermes path, or secret commit
was added. See
`docs/checkpoints/PROJECT_ONLY_READ_SEMANTICS_15H.md`. The next recommended
slice is Slice 15I: define the read-only Memory detail/evidence/supersession/audit
contract for Gateway-backed results, keeping mutation/admin controls deferred.

## Checkpoint: Slice 15I read-only memory detail contract

Slice 15I defined the Gateway-backed read-only Memory detail contract on
2026-05-31. Detail is implemented through the existing BFF inspect route and is
labelled as read-only/scoped in the UI. Evidence and supersession-chain remain
honest `not_implemented` Gateway states with empty arrays, and audit is
metadata-only because there is no durable audit endpoint in the current UI read
contract. Regression coverage now checks normalized not_implemented payloads,
missing evidence/supersession arrays, wrong-scope safe detail errors, live
detail UI wording, and absence of mutation/admin labels. No Brain Memory
mutation/admin UI, direct browser-to-Gateway/storage path, direct
browser-to-Hermes path, tenant loosening, Hermes streaming change, Brain
Memory BFF logic change, or secret commit was added. See
`docs/product/MEMORY_DETAIL_CONTRACT_15I.md`. The next recommended slice is
Slice 15J: add a read-only Memory detail fixture and non-live browser smoke for
detail/evidence/supersession/audit UI states.

## Checkpoint: Slice 15J memory detail fixture smoke

Slice 15J added deterministic non-live Memory detail fixture coverage on
2026-05-31. `/design/memory-detail-fixture` renders the existing read-only
detail panel with static full-detail, not_implemented evidence,
not_implemented supersession-chain, metadata-only audit, wrong-scope error, and
metadata redaction sentinel cases. `npm run smoke:memory-detail` verifies the
fixture route, honest copy, no mutation/admin controls, no raw secret sentinel
text, no service calls, and no overflow without requiring live Hermes or Brain
Memory Gateway. No Brain Memory mutation/admin UI, direct
browser-to-Gateway/storage path, direct browser-to-Hermes path, Hermes
streaming change, Brain Memory BFF logic change, memory-scope bridge change, or
secret commit was added. See
`docs/product/MEMORY_DETAIL_FIXTURE_SMOKE_15J.md`. The next recommended slice is
Slice 15K: add an MVP read-only memory search/detail regression index.

## Checkpoint: Slice 15K Brain Memory regression index

Slice 15K added the MVP read-only Brain Memory regression index on 2026-05-31.
`docs/product/BRAIN_MEMORY_REGRESSION_INDEX_15K.md` maps each current
Gateway-mediated Brain Memory read surface to source checks, browser smokes,
opt-in live smokes, fixture coverage, deferred production capabilities, and
known limitations. `npm run check:brain-memory-regression-index` guards the
index itself. No Brain Memory mutation/admin UI, direct browser-to-Gateway
path, direct browser-to-Hermes path, direct storage access, Hermes streaming
change, Brain Memory BFF change, memory-scope bridge change, or secret commit
was added. The next recommended slice is Slice 15L: create a launch-gate README
for Brain Memory MVP read-only QA modes.

## Checkpoint: Slice 15L Brain Memory read-only QA gate

Slice 15L added the Brain Memory MVP read-only QA gate and future Session
Context Compaction roadmap note on 2026-05-31. The QA gate in
`docs/product/BRAIN_MEMORY_READ_ONLY_QA_GATE_15L.md` separates required default
checks, optional browser/fixture checks, and optional live Hermes/Brain Memory
checks before making read-only MVP claims. The compaction roadmap in
`docs/product/SESSION_CONTEXT_COMPACTION_ROADMAP.md` documents manual-first and
automatic-later compaction as deferred, Brain Memory-backed, project/session
scoped, transparent, auditable, and free of hidden chain-of-thought. No
compaction runtime, memory mutation/admin UI, direct browser-to-Gateway path,
direct browser-to-Hermes path, direct storage access, Hermes streaming change,
Brain Memory BFF change, memory-scope bridge change, or secret commit was
added. The next recommended slice is Slice 15M: refresh release/RC notes to
point at the read-only QA gate.

## Checkpoint: Slice 15M RC notes and scalable UI loading roadmap

Slice 15M refreshed release/RC notes on 2026-05-31 so default local MVP,
browser smoke, live Hermes, and live Brain Memory claims are separated. Live
Brain Memory claims now point at
`docs/product/BRAIN_MEMORY_READ_ONLY_QA_GATE_15L.md`. The deferred scalable UI
loading roadmap in `docs/product/SCALABLE_UI_LOADING_ROADMAP.md` documents
future `Show more`, scroll-loading, pagination, virtualization/windowing,
bounded rendering, and accessibility requirements for long transcripts and
large panels. Context compaction runtime, scalable loading runtime,
export/import, memory mutation/admin UI, production installer, durable
evidence/supersession/audit, and auth/classification remain deferred. No UI
runtime behavior, pagination, infinite scroll, compaction runtime, direct
browser-to-Gateway path, direct browser-to-Hermes path, direct storage access,
Hermes streaming change, Brain Memory BFF change, or secret commit was added.
The next recommended slice is Slice 15N: create a long-session performance
measurement plan before implementing scalable loading.

## Checkpoint: Slice 15N long-session performance measurement baseline

Slice 15N added a non-runtime long-session measurement baseline on 2026-05-31.
`docs/performance/LONG_SESSION_PERFORMANCE_PLAN_15N.md` audits current
transcript, sidebar, run history, replay, memory, tool, files, and export
preview rendering posture. The static `/design/long-session-fixture` route and
`npm run smoke:long-session` exercise 120 transcript messages, 100 sidebar
sessions, 80 activity events, 24 run records, memory evidence, tool events, and
artifacts without calling Hermes, Brain Memory, BFF routes, localStorage, or
storage backends. No infinite scroll, virtualization, runtime pagination,
context compaction runtime, direct browser-to-service path, Hermes streaming
change, Brain Memory BFF change, or secret commit was added. The next
recommended slice is Slice 15O: add non-invasive long-session measurement
reporting, then choose the first scalable-loading runtime slice.

## Checkpoint: Slice 15O long-session measurement report

Slice 15O added stable measurement reporting for the long-session fixture on
2026-05-31. `npm run smoke:long-session` now supports `--json`, `--verbose`,
and optional `--budget-strict`, and reports route load, navigation timings,
rendered transcript/sidebar/detail counts, transcript scroll dimensions,
scroll down/up timing, right-rail tab switch timing, horizontal overflow,
service-call count, browser/network error counts, and total duration. The
measurement report in `docs/performance/LONG_SESSION_MEASUREMENT_15O.md`
recorded 120 transcript messages, 100 sidebar sessions, 0 px overflow, 0
service calls, and acceptable scroll/tab timing, but also found the collapsed
export preview builds about 494 KB of JSON on the default Context tab. No
runtime infinite scroll, virtualization, pagination, context compaction,
backend export/import, Hermes streaming change, Brain Memory BFF change, or
secret commit was added. The next recommended slice is Slice 15P: lazily
construct local export preview JSON only when the Preview JSON detail is
opened.

## Checkpoint: Slice 15P lazy export preview construction

Slice 15P lazily constructs the Context rail local export preview JSON only
after the user opens the `Preview JSON` disclosure. The visible summary counts
remain immediate, while the long-session fixture now verifies 0 hidden export
JSON characters before open and the same 494,133-character redacted preview
after open. The smoke also records open-triggered preview build timing and
continues to require 0 service calls and 0 px horizontal overflow. No export
download/import, backend export, runtime pagination, infinite scroll,
virtualization, context compaction, Hermes streaming change, Brain Memory BFF
change, memory-scope bridge change, direct storage access, or memory
mutation/admin action was added. See
`docs/performance/LAZY_EXPORT_PREVIEW_15P.md`. The next recommended slice is
Slice 15Q: add a larger sidebar/session-list measurement variant and decide
whether sidebar `Show more` is needed before transcript virtualization.

## Checkpoint: Slice 15Q large sidebar measurement

Slice 15Q added a deterministic large-sidebar fixture on 2026-05-31. The
`/design/sidebar-large-fixture` route renders the real production Sidebar with
25 projects and 1,000 visible sessions, plus a local-only measurement panel.
`npm run smoke:sidebar:large` measures route load, rendered project/session row
counts, sidebar scroll dimensions and timing, active row selection timing,
horizontal overflow, service-call count, and browser/network errors. The local
measurement recorded 1,027 project/session/recent rows, 0 px overflow, 0
service calls, 1 ms / 7 ms sidebar scroll timing, and 73 ms active row
selection. Based on this evidence, Sidebar Show More and transcript
virtualization are both deferred for now. No runtime Show More, pagination,
infinite scroll, virtualization, context compaction, production sidebar/chat
behavior change, Hermes streaming change, Brain Memory BFF change, direct
storage access, export/import, or memory mutation/admin action was added. See
`docs/performance/SIDEBAR_LARGE_MEASUREMENT_15Q.md`. The next recommended
slice is Slice 15R: measure large Files/artifacts and legacy tool-event panels
before choosing the next scalable-loading runtime implementation.

## Checkpoint: Slice 15R large artifacts/tools measurement

Slice 15R added a deterministic large Files/artifacts and legacy tool-event
fixture on 2026-05-31. The `/design/artifacts-tools-large-fixture` route renders
the real Context rail with 500 local artifacts and 500 legacy tool-event rows,
plus the production `AgentActivityBlock` with 500 collapsed activity detail
groups. `npm run smoke:artifacts-tools:large` measures route load, rendered
artifact/tool/command/detail counts, Files and Tools tab switch timing,
right-rail scroll timing, horizontal overflow, service-call count, and
browser/network errors. The local measurement recorded 500 artifact rows, 500
legacy tool rows, 8 recent command rows, 500 collapsed activity details, 0 open
details by default, 280 ms Files tab switch, 288 ms Tools tab switch, 6 ms /
13 ms right-rail scroll, 0 px overflow, and 0 service calls. Based on this
evidence, Files/artifacts Show More, legacy tool-event pagination, and
command-detail lazy rendering are deferred for now. No runtime Show More,
pagination, infinite scroll, virtualization, context compaction, production
Files/Tools behavior change, Hermes streaming change, Brain Memory BFF change,
direct storage access, export/import, or memory mutation/admin action was
added. See `docs/performance/ARTIFACTS_TOOLS_LARGE_MEASUREMENT_15R.md`. The
next recommended slice is Slice 15S: create a scalable-loading decision
checkpoint that consolidates 15N through 15R measurements and chooses the first
runtime implementation only if the evidence now justifies one.

## Checkpoint: Slice 15S scalable-loading decision

Slice 15S consolidated the scalable-loading measurement track on 2026-05-31.
The decision record in `docs/performance/SCALABLE_LOADING_DECISION_15S.md`
summarizes long-session, large-sidebar, lazy export-preview, large
Files/artifacts, legacy tool-row, activity-detail, memory timeline, and command
preview measurements. Based on the current MVP-scale fixtures, runtime Show
More, pagination, infinite scroll, and virtualization remain deferred. The
existing bounded/collapsed design is acceptable for now, measurement smokes stay
in place, and scalable loading should be revisited only when real user data or
smoke warnings cross the documented thresholds. No context compaction runtime,
backend feature, Hermes streaming change, Brain Memory BFF change, direct
browser-to-service path, direct storage access, or memory mutation/admin action
was added. The next recommended slice is Slice 16A: Hermes Runs API migration
assessment.

## Checkpoint: Slice 16A Hermes Runs API migration assessment

Slice 16A assessed whether Brain Memory Studio should migrate from the current
Hermes session chat stream path to the Hermes Runs API. Current upstream Hermes
source was inspected at HEAD `1fc7bdc5e64e052bc61d3ddb9e6f96cf6c7461dc`, live
Hermes health/capability probes were checked without creating a run, and the
assessment in `docs/architecture/HERMES_RUNS_MIGRATION_ASSESSMENT_16A.md`
compares session stream with Runs across streaming UX, event richness, Brain
Memory scope, approvals, stop, reconnect, run history, replay, provider/model
handling, files/artifacts, BFF complexity, test complexity, migration risk, and
backwards compatibility. Recommendation: keep session stream as the production
default, then add a BFF-only experimental Runs path later after parity is
proven. No production runtime path, Hermes BFF streaming logic, Brain Memory
BFF logic, memory scope bridge, stable project/session keys, direct
browser-to-service path, storage path, or memory mutation/admin behavior was
changed. The next recommended slice is Slice 16B: Runs API harmless probe via
BFF, no UI execution switch.

## Checkpoint: Slice 16B Hermes Runs harmless probe

Slice 16B added a BFF-only diagnostic Runs probe on 2026-05-31. The new
`POST /api/hermes/runs/probe` route and `npm run smoke:hermes:runs` command
create one short chat-only Hermes run with prompt
`Reply exactly: HERMES_RUNS_PROBE_OK`, stream `/v1/runs/{run_id}/events`, poll
`/v1/runs/{run_id}`, and return a redacted normalized summary. The live probe
against `http://127.0.0.1:3002` succeeded with run
`run_a3743ab56e10437fb2a722edd8ecbc76`, final status `completed`, event types
`message.delta`, `reasoning.available`, and `run.completed`, and 0 tool,
Brain Memory tool, or approval events. Production chat still uses session
streaming; no server-side run stop, approval action, composer Agent access
selector, direct browser-to-Hermes path, Brain Memory BFF change, memory scope
bridge change, stable-key change, storage path, or memory mutation/admin UI was
added. See `docs/checkpoints/HERMES_RUNS_PROBE_16B.md`. The next recommended
slice is Slice 16C: Runs event normalization parity with AgentActivityEvent.

## Checkpoint: Slice 16C Hermes Runs event normalization parity

Slice 16C added a dedicated frontend normalizer for raw Hermes Runs event
payloads on 2026-05-31. `message.delta` is intentionally treated as assistant
text buffer data rather than an activity row, `reasoning.available` maps to a
generic public `Thinking signal received` event with raw reasoning-like text
omitted, `run.completed` maps to a completed status event, and tool/approval
events reuse the existing `AgentActivityEvent` parity mappings. The Runs probe
script now prints an observed normalization-policy summary, but production chat
still uses `/api/hermes/chat/stream`. No production Runs stream route,
server-side run stop, approval action route, composer Agent access selector,
direct browser-to-Hermes path, Brain Memory BFF change, memory scope bridge
change, stable-key change, storage path, or memory mutation/admin UI was
added. See `docs/checkpoints/HERMES_RUNS_EVENT_NORMALIZATION_16C.md`. The next
recommended slice is Slice 16D: Brain Memory MCP parity test in Runs flow.

## Checkpoint: Slice 16D Hermes Runs Brain Memory parity

Slice 16D added an opt-in BFF-only Runs Brain Memory parity probe on
2026-05-31. `POST /api/hermes/runs/memory-probe` and
`npm run smoke:hermes:runs:memory` send a harmless scoped marker through Hermes
Runs with the existing memory-scope bridge, verify Brain Memory MCP tool events,
then read the marker through the existing Brain Memory BFF search/inspect
routes. The live probe passed with marker
`BM_RUNS_MEMORY_16D_20260531120408_50ZNHG`, run
`run_9598780e01984716b2676e4c11f7ef2c`, event types `message.delta`,
`reasoning.available`, `tool.started`, `tool.completed`, and `run.completed`,
2 Brain Memory tool events, matching-session inspect detail, and absent
different-project/different-session searches. Production chat still uses
`/api/hermes/chat/stream`; no direct browser-to-Hermes/Gateway path, storage
path, memory admin UI, run stop, approval action, Agent access selector, auth
classification, or export/import behavior was added. See
`docs/checkpoints/HERMES_RUNS_BRAIN_MEMORY_PARITY_16D.md`. The next
recommended slice is Slice 16E: server-side run stop experiment.

## Checkpoint: Slice 16E Hermes Runs server-side stop experiment

Slice 16E added an opt-in BFF-only Runs stop probe on 2026-05-31.
`POST /api/hermes/runs/stop-probe` and `npm run smoke:hermes:runs:stop`
create a harmless counting run, call `POST /v1/runs/{run_id}/stop` through the
server-side Hermes client, and reconcile final status/events. The live probe
passed with run `run_ae63c23ca85a456d8ab455e3c3f40ba4`: the stop endpoint
returned HTTP 200 with `status=stopping`, final status was `cancelled`, and
`run.cancelled` was observed. Production chat still uses
`/api/hermes/chat/stream`; composer stop still uses the Slice 13G client/BFF
stream abort path; no direct browser-to-Hermes/Gateway path, approval action,
memory admin UI, Agent access selector, auth classification, or export/import
behavior was added. See
`docs/checkpoints/HERMES_RUNS_STOP_EXPERIMENT_16E.md`. The next recommended
slice is Slice 16F: approvals action probe.

## Checkpoint: Slice 16F Hermes Runs approvals action probe

Slice 16F added an opt-in BFF-only Runs approval probe on 2026-05-31.
`POST /api/hermes/runs/approval-probe` and
`npm run smoke:hermes:runs:approval` create a controlled run that triggers a
Hermes terminal approval request, then sends `choice=deny` through
`POST /v1/runs/{run_id}/approval` from the server-side Hermes client. The live
probe passed with run `run_e345b064a8a94067bfa611df280b134c`: observed
`approval.request` and `approval.responded`, approval HTTP status `200`,
`resolved=1`, final status `completed`, and output
`HERMES_RUNS_APPROVAL_PROBE_DONE`. Production chat still uses
`/api/hermes/chat/stream`; no production approval buttons, direct
browser-to-Hermes/Gateway path, storage path, memory admin UI, Agent access
selector, auth classification, or export/import behavior was added. See
`docs/checkpoints/HERMES_RUNS_APPROVAL_PROBE_16F.md`. The next recommended
slice is Slice 16G: experimental Runs mode feature flag.

## Checkpoint: Slice 16G Hermes Runs experimental mode gate

Slice 16G added a disabled-by-default experimental Runs execution gate on
2026-05-31. `HERMES_UI_EXPERIMENTAL_RUNS_MODE=true` enables the BFF-only
`POST /api/hermes/runs/experimental-chat` route and
`npm run smoke:hermes:runs:experimental-chat`; with the flag off, the route
returns a normalized HTTP 403 disabled response and creates no run. The live
basic prompt passed with run `run_6a1dd54df8574373be1d7d19b09b48b4`, final
status `completed`, and event types `message.delta`, `reasoning.available`,
and `run.completed`. Production chat still uses `/api/hermes/chat/stream`; no
composer Agent access selector, approval buttons, provider/model switching,
direct browser-to-Hermes/Gateway path, storage path, or memory admin UI was
added. See `docs/checkpoints/HERMES_RUNS_EXPERIMENTAL_MODE_16G.md`. The next
recommended slice is Slice 16H: Runs default migration decision.

## Checkpoint: Slice 16H Hermes Runs default migration decision

Slice 16H decided to keep session stream as the production default and keep
Hermes Runs behind `HERMES_UI_EXPERIMENTAL_RUNS_MODE=true`. The 16H rerun of
the Runs Brain Memory parity smoke passed under a temporary Web UI child process
with the full Brain Memory Gateway readback env, clarifying the 16G readback
failure as an env/runbook gap rather than a Runs memory failure. Production
chat still uses `/api/hermes/chat/stream`; no composer Agent access selector,
approval buttons, direct browser-to-Hermes/Gateway path, storage path, or
memory mutation/admin UI was added. See
`docs/checkpoints/HERMES_RUNS_DEFAULT_DECISION_16H.md`. The next recommended
slice is Slice 16I: Runs Brain Memory live env/runbook hardening.

## Checkpoint: Slice 16I Hermes Runs Brain Memory env hardening

Slice 16I hardened the live env/runbook path for Runs + Brain Memory smokes.
The Runs memory probe now returns redacted Web UI BFF env posture and a
normalized blocker category for Hermes reachability, Gateway reachability,
tenant memory key missing/unauthorized, optional UI bearer unauthorized,
marker/search failures, scope mismatch, and Runs/MCP failures. Env templates
and runbooks now distinguish `BRAIN_MEMORY_GATEWAY_MEMORY_API_KEY` from the
optional `BRAIN_MEMORY_UI_API_KEY` and document the local `local-dev` Hermes
MCP posture. Production chat still uses `/api/hermes/chat/stream`; experimental
Runs remains flag-gated; no direct browser-to-Hermes/Gateway path, storage
path, memory admin UI, approval buttons, provider/model switching, or composer
Agent access selector was added. See
`docs/checkpoints/HERMES_RUNS_BRAIN_MEMORY_ENV_HARDENING_16I.md`. The next
recommended slice is Slice 16J: Runs replay/history reconciliation plan.

## Checkpoint: Slice 16J Hermes Runs replay/history reconciliation

Slice 16J defined how future Hermes Runs execution maps into the existing Web
UI run history and persisted replay model. `RunRecord.id` remains a Web
UI-generated local id, Hermes `run_id` is stored in `RunRecord.hermesRunId`,
and `RunRecord.activityReplay[]` should be built from normalized
`AgentActivityEvent` objects rather than raw Runs event payloads. Runs
`message.delta` remains assistant transcript buffer data, not one persisted
replay row per delta. Production chat still uses `/api/hermes/chat/stream`;
experimental Runs remains flag-gated; no direct browser-to-Hermes/Gateway path,
storage path, memory admin UI, approval buttons, provider/model switching, or
composer Agent access selector was added. See
`docs/architecture/HERMES_RUNS_REPLAY_RECONCILIATION_16J.md`. The next
recommended slice is Slice 16K: experimental Runs RunRecord/replay prototype.

## Checkpoint: Slice 16K Hermes Runs RunRecord/replay prototype

Slice 16K extended the disabled-by-default experimental Runs BFF route so a
successful `POST /api/hermes/runs/experimental-chat` response includes
`runRecordPreview`, `activityReplayPreview`, `activitySummary`, and
`replayExcludedFields`. The preview keeps a local Web UI `RunRecord.id`, stores
Hermes `run_id` in `hermesRunId`, builds replay through normalized
`AgentActivityEvent` and persisted replay helpers, and excludes per-token
`message.delta` rows, raw Runs payloads, secrets, action handles, full outputs,
and hidden reasoning text. Production chat still uses
`/api/hermes/chat/stream`; experimental Runs remains flag-gated; no direct
browser-to-Hermes/Gateway path, storage path, memory admin UI, approval
buttons, provider/model switching, or composer Agent access selector was
added. See
`docs/checkpoints/HERMES_RUNS_RUNRECORD_REPLAY_PROTOTYPE_16K.md`. The next
recommended slice is Slice 16L: gated Runs replay UI hydration experiment.

## Checkpoint: Slice 16L Hermes Runs replay UI hydration

Slice 16L added an Option A, test-only Playwright hydration smoke for the
experimental Runs preview shape. `npm run smoke:hermes:runs:replay-ui` calls
the feature-flagged `/api/hermes/runs/experimental-chat` BFF route, validates
`runRecordPreview` and `activityReplayPreview`, injects them into an isolated
local workspace state, reloads `/`, and verifies the existing Run history and
Persisted replay UI render the Runs-backed record with visible `hermesRunId`,
`completed` status, activity summary metrics, bounded replay rows, no
per-token `message.delta` replay rows, no hidden reasoning text, no secrets,
and no horizontal overflow. Production chat still uses
`/api/hermes/chat/stream`; experimental Runs remains flag-gated; no direct
browser-to-Hermes/Gateway path, storage path, memory admin UI, approval
buttons, provider/model switching, or composer Agent access selector was
added. See
`docs/checkpoints/HERMES_RUNS_REPLAY_UI_HYDRATION_16L.md`. The next
recommended slice is Slice 16M: gated production Runs execution state machine
contract.

## Checkpoint: Slice 16M Hermes Runs execution state machine

Slice 16M defined the future gated production Runs execution state machine in
`docs/architecture/HERMES_RUNS_EXECUTION_STATE_MACHINE_16M.md`. The contract
covers `idle`, `preparing_context`, `creating_run`, `streaming_events`,
`waiting_for_approval`, `stopping`, `stopped`, `completed`, `failed`,
`reconnecting`, `replaying`, and `cancelled`; Browser/BFF/Hermes/Brain Memory
responsibilities; stop and approval contracts; future Agent access selector
policy mapping; migration gates; and rollback to `/api/hermes/chat/stream`.
Production chat still uses the session stream; experimental Runs remains
flag-gated; no production Runs composer switch, approval buttons, direct
browser-to-Hermes/Gateway path, storage path, memory admin UI, provider/model
switching, or composer Agent access selector was added. The next recommended
slice is Slice 16N: BFF production Runs route contract and event envelope.

## Checkpoint: Slice 16N Hermes Runs BFF event contract

Slice 16N defined the future production Runs BFF route contract in
`docs/architecture/HERMES_RUNS_BFF_EVENT_CONTRACT_16N.md` without implementing
runtime execution. The contract specifies the future
`POST /api/hermes/runs/chat/stream` request shape, `HermesRunsBffEvent`
browser-facing stream envelope, assistant text handling, `AgentActivityEvent`
mapping, `RunRecord` and `activityReplay` reconciliation, stop and approval
envelopes, error taxonomy, replay/reconnect semantics, and source guards.
Production chat still uses `/api/hermes/chat/stream`; no production Runs route,
composer Runs selector, approval buttons, direct browser-to-Hermes/Gateway
path, storage path, Brain Memory BFF change, memory scope bridge change,
stable-key change, provider/model switching, memory mutation/admin UI, or Agent
access selector was added. The next recommended slice is Slice 16O: typed Runs
BFF event envelope fixtures and reducer checks.

## Checkpoint: Slice 16O Hermes Runs BFF event fixtures

Slice 16O added typed fixture-only coverage for the future Runs BFF event
contract in `docs/checkpoints/HERMES_RUNS_BFF_EVENT_FIXTURES_16O.md`.
`apps/web/src/types/hermesRunsBffEvents.ts` defines `HermesRunsBffEvent` and
supporting run, message, approval, replay, error, stop, and approval envelope
types. `apps/web/src/data/hermesRunsBffEventFixtures.ts` adds deterministic
success, activity/tool, approval deny, stop, error, reconnect/replay, and
`done` sequences. `apps/web/src/lib/hermesRunsBffEventReducer.ts` applies those
events to a pure local draft state for assistant text, `AgentActivityEvent`,
`RunRecord`, `activityReplay`, approvals, errors, replay snapshot, and done
state. `npm run check:hermes-runs-bff-events` verifies the contract and source
guards. Production chat still uses `/api/hermes/chat/stream`; no production
Runs route, composer Runs selector, approval buttons, direct
browser-to-Hermes/Gateway path, storage path, Brain Memory BFF change, memory
scope bridge change, stable-key change, provider/model switching,
memory mutation/admin UI, or Agent access selector was added. The next
recommended slice is Slice 16P: disabled production-shaped Runs BFF route
skeleton and contract response guard.

## Checkpoint: Slice 16P Hermes Runs disabled production route guard

Slice 16P added `POST /api/hermes/runs/chat/stream` as a production-shaped
disabled route skeleton only. The route returns HTTP 501 JSON with
`reason=production_runs_route_not_enabled`, `sessionStreamDefault=true`,
`hermesRunCreated=false`, `hermesCalled=false`, `brainMemoryCalled=false`, and
`eventStreamStarted=false`. `npm run smoke:hermes:runs:route-guard`,
`npm run check:hermes-runs-bff-events`, and `npm run check:ui-structure` guard
that the route exists only as a disabled contract response and does not import
or call Hermes, Brain Memory Gateway, storage, or the memory scope bridge.
Production chat still uses `/api/hermes/chat/stream`; no production Runs
composer switch, approval buttons, direct browser-to-Hermes/Gateway path,
provider/model switching, memory mutation/admin UI, or Agent access selector
was added. The next recommended slice is Slice 16Q: disabled Runs BFF request
validation contract and dry-run source checks.

## Checkpoint: Slice 16Q Hermes Runs request validation contract

Slice 16Q added a pure future request contract for the disabled
`POST /api/hermes/runs/chat/stream` route. `HermesRunsBffRequest` now captures
project id, session id, message, required memory scope with tenant/stable
project/stable session keys, future Agent access metadata, inert provider/model
fields, and bounded options. `validateHermesRunsBffRequest` and
`npm run check:hermes-runs-bff-request` verify valid/invalid fixtures,
credential-field rejection, inert provider/model behavior, source purity, the
disabled route guard, and absence of a production Runs composer switch. The
disabled route still returns HTTP 501
`reason=production_runs_route_not_enabled`; it does not parse/validate at
runtime yet, call Hermes or Brain Memory Gateway, read service env values,
stream events, create runs, or import the memory scope bridge. Production chat
still uses `/api/hermes/chat/stream`. The next recommended slice is Slice 16R:
disabled route validation echo contract, still HTTP 501 and no execution.

## Checkpoint: Slice 16R Hermes Runs disabled validation echo and access policy

Slice 16R connects the disabled production-shaped
`POST /api/hermes/runs/chat/stream` route to the pure request validator while
keeping HTTP 501 and `reason=production_runs_route_not_enabled` for valid and
invalid bodies. The response now includes redacted `requestValidation` posture
and explicit `execution` flags proving no Hermes run creation, no Hermes or
Brain Memory Gateway call, no approval/stop action, no event stream, and no
storage access. Slice 16R also documents future Agent access policy modes
`chat_only`, `read_only_tools`, `ask_before_tools`, `full_access`, and
`custom` in `docs/architecture/AGENT_ACCESS_APPROVAL_POLICY_16R.md`.
Production chat still uses `/api/hermes/chat/stream`; no production Runs
composer switch, composer Agent access selector UI, approval buttons, direct
browser-to-Hermes/Gateway path, storage path, memory bridge change, stable-key
change, or Brain Memory mutation/admin UI was added. See
`docs/checkpoints/HERMES_RUNS_DISABLED_ROUTE_VALIDATION_AND_AGENT_ACCESS_16R.md`.
The next recommended slice is Slice 16S: disabled Runs policy fixture matrix
and source-only Agent access rendering guard.

## Checkpoint: Slice 16S Agent access policy matrix

Slice 16S adds deterministic Agent access policy fixtures and source-only
guards for the future `chat_only`, `read_only_tools`, `ask_before_tools`,
`full_access`, and `custom` modes. `npm run check:agent-access-policy`
verifies every mode remains `productionUiEnabled=false` and
`enforcementAvailable=false`, `full_access` is not unrestricted OS/system
access, read-only and chat-only policies block side effects, the production UI
has no enabled `Full access` selector copy, Composer has no Agent access
selector UI or approval buttons, and the disabled Runs route still validates
`agentAccessMode` without execution. The route guard now covers `chat_only`,
`full_access`, and invalid `agentAccessMode` disabled-route cases. Production
chat still uses `/api/hermes/chat/stream`; no production Runs composer switch,
approval buttons, direct browser-to-Hermes/Gateway path, storage path, memory
bridge change, stable-key change, or Brain Memory mutation/admin UI was added.
See `docs/checkpoints/AGENT_ACCESS_POLICY_MATRIX_16S.md`. The next
recommended slice is Slice 16T: production Runs BFF lifecycle dry-run contract
and no-runtime source guard.

## Checkpoint: Slice 16T Hermes Runs lifecycle dry run

Slice 16T defines the future production Runs BFF lifecycle as a no-runtime
dry-run contract. `HermesRunsBffLifecycleStage` covers `validate_request`,
`validate_scope`, `validate_agent_access_policy`, `prepare_context`,
`create_run`, `stream_or_poll_events`, `normalize_event`,
`update_run_record`, `update_activity_replay`, `handle_approval_request`,
`submit_approval_response`, `handle_stop_request`, `finalize_run`,
`emit_done`, and `emit_error`. `createHermesRunsBffLifecycleDryRun` and
fixture coverage produce disabled lifecycle plans with runtime execution flags
false and no raw request echo or service secret reads. The disabled
`POST /api/hermes/runs/chat/stream` route still returns HTTP 501 with
`reason=production_runs_route_not_enabled`, now including `lifecycleDryRun`,
and still does not call Hermes, Brain Memory Gateway, storage, service env,
fetch, or the memory scope bridge. Production chat still uses
`/api/hermes/chat/stream`; no production Runs composer switch, composer Agent
access selector UI, approval buttons, direct browser-to-Hermes/Gateway path,
stable-key change, or Brain Memory mutation/admin UI was added. See
`docs/checkpoints/HERMES_RUNS_BFF_LIFECYCLE_DRY_RUN_16T.md`. The next
recommended slice is Slice 16U: disabled Runs lifecycle route-response fixture
and migration gate checklist.

## Checkpoint: Slice 16U Hermes Runs disabled route-response baseline

Slice 16U pins representative disabled response fixtures for
`POST /api/hermes/runs/chat/stream` and adds the production migration gate
checklist in
`docs/architecture/HERMES_RUNS_PRODUCTION_MIGRATION_GATE_16U.md`.
`apps/web/src/data/hermesRunsDisabledRouteResponseFixtures.ts` covers valid
minimal, valid full future, missing memory scope, credential-like field, and
oversized message cases. `validateHermesRunsDisabledRouteResponse` and the
route guard verify HTTP 501, `reason=production_runs_route_not_enabled`,
redacted validation posture, lifecycle dry-run posture, no runtime ids, no
approval actions, no secret-like response data, and no Hermes/Gateway/storage
execution. Production chat still uses `/api/hermes/chat/stream`; no production
Runs execution, composer switch, composer Agent access selector UI, approval
buttons, direct browser-to-Hermes/Gateway path, memory bridge change,
stable-key change, or Brain Memory mutation/admin UI was added. The next
recommended slice is Slice 16V: production Runs implementation ADR and
feature-flag contract.

## Checkpoint: Slice 17A MVP completion audit

Slice 17A parks production Runs work as post-MVP and audits the current product
against the MVP completion criteria. The current recommendation is
conditionally complete for a local/demo MVP RC after the safe non-live gate
passes. Browser and live-service claims require one healthy selected Web UI
base URL and intentionally running Hermes/Brain Memory services.

The audit and smoke matrix are documented in
`docs/release/MVP_COMPLETION_AUDIT_17A.md`,
`docs/release/FINAL_MVP_LIVE_SMOKE_CHECKLIST_17A.md`, and
`docs/release/RELEASE_DECISION_17A.md`.

MVP production chat still uses `/api/hermes/chat/stream`; Brain Memory remains
read-only in MVP; production Runs implementation, Agent access selector UI,
approval buttons, memory mutation/admin UI, export/import, provider/model
runtime switching, artifact upload/download, automatic context compaction,
cross-channel discovery, and production installer work remain deferred. The
next recommended slice is Slice 17B: final RC browser/live smoke run and
decision record.

## Checkpoint: Slice 17B final MVP RC browser/live smoke decision

Slice 17B ran the final MVP RC smoke pass against
`http://127.0.0.1:3002` and records the decision in
`docs/release/RELEASE_DECISION_17B.md`. The decision is MVP complete with
known limitations for the local/demo RC: non-live checks passed, browser smokes
passed, live Hermes send/stop passed, and Brain Memory live Gateway claims
remain unavailable because the Web UI BFF was configured for mock/unconfigured
Brain Memory mode.

Production chat still uses `/api/hermes/chat/stream`; production Runs remains
deferred/post-MVP; no Agent access selector UI, approval buttons, memory
mutation/admin UI, export/import runtime, direct browser-to-Hermes/Gateway
path, or direct storage path was added. The next recommended slice is Slice
17C: comprehensive MVP E2E verification run.

## Checkpoint: Slice 17C comprehensive MVP E2E verification

Slice 17C ran the comprehensive MVP E2E verification pass against
`http://127.0.0.1:3002` and records the result in
`docs/release/MVP_COMPREHENSIVE_E2E_17C.md`. The recommendation remains MVP
complete with known limitations for the local/demo RC: release checks passed,
browser smokes passed, live Hermes send/stop passed, optional disabled-Runs
guard/probe checks passed, and live Brain Memory search/detail remained
unclaimed because the Web UI BFF was mock/unconfigured for Brain Memory.

Production chat still uses `/api/hermes/chat/stream`; production Runs remains
deferred/post-MVP; no Agent access selector UI, approval buttons, memory
mutation/admin UI, export/import runtime, direct browser-to-Hermes/Gateway
path, or direct storage path was added. The next recommended slice is Slice
17D: publish-ready release notes and local handoff package manifest.

## Checkpoint: Visual system correction (UI polish pass)

A comprehensive visual-system audit and correction pass was completed on
2026-06-01. Changes: fixed global `font-size: 105%` to 100%, replaced fluid
clamp font tokens with stable fixed sizes (`--font-body: 15px`,
`--font-small: 13px`, `--font-xs: 11.5px`), tightened content-width to
`clamp(640px,56%,860px)`, converted the mockBanner from alarming orange warning
to a subtle muted inline notice, removed `overflow: hidden` from the composer
wrapper (horizontal scroll fix), made assistant message copy actions
hover-reveal only, constrained shimmer to running/queued activity icons only,
updated Composer placeholder and footer copy to user-facing language, tightened
ContextRail padding and heading sizes, reduced code block header height, and
removed `min-width: 118px` from copy button. All checks pass: typecheck, build,
`check:ui-structure`, `check:workspace-state`, `check:agent-activity` (36),
`check:agent-activity-rendering` (35), `check:brain-memory-client`,
`check:tenant-scope`, `npm audit`. No product features, backend logic, Hermes
paths, Brain Memory paths, or production chat route changed. See
`docs/checkpoints/UI_VISUAL_SYSTEM_CORRECTION.md`.

## Checkpoint: Slice 17D local handoff release notes

Slice 17D adds publish-ready local/demo RC handoff docs:
`docs/release/MVP_LOCAL_RC_RELEASE_NOTES_17D.md`,
`docs/packaging/LOCAL_HANDOFF_MANIFEST_17D.md`, and
`docs/release/PRIVATE_DEVELOPER_HANDOFF_17D.md`. These docs summarize the
suggested `v0.1.0-local-rc.1` release name, supported modes, verification
commands, local handoff contents, private developer setup path, known
limitations, deferred features, and non-claimable production features.

This slice does not create a public release, archive, production installer,
one-command package, export/import runtime, production Runs default, Agent
access selector UI, approval buttons, memory mutation/admin UI, direct
browser-to-service path, or direct storage path. The next recommended slice is
Slice 17E: local handoff dry-run review and issue triage checklist.

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
