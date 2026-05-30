# Hermes API UX Contract

Date: 2026-05-30

## Purpose

This contract defines how Hermes UI / Brain Memory Studio should evolve from
an MVP chat shell into a Hermes-native agent orchestration studio.

The browser must continue to call only the Next.js BFF:

```text
Browser UI -> Next.js BFF -> Hermes API server
Browser UI -> Next.js BFF -> Brain Memory Gateway UI API
```

The UI must not treat Hermes as only a generic OpenAI chat completion server.
Hermes exposes sessions, runs, structured events, approvals, stop, capabilities,
tool metadata, memory-scope headers, and platform behavior that should shape
the product.

## Sources Re-Verified

Current upstream Hermes source/docs were downloaded to a temp inspection folder
without modifying Hermes source:

```text
%TEMP%\hermes-agent-slice13a
```

Reviewed upstream repository:

```text
https://github.com/NousResearch/hermes-agent
HEAD 5921d667855880b0aa2083a50f001748aed52f3e
```

Files reviewed:

- `README.md`
- `website/docs/user-guide/features/api-server.md`
- `website/docs/developer-guide/programmatic-integration.md`
- `gateway/platforms/api_server.py`

Local Hermes UI docs/source reviewed before this contract:

- `docs/architecture/HERMES_DISCOVERY.md`
- `docs/integration/SLICE_03_HERMES_HEALTH_NOTES.md`
- `docs/integration/SLICE_04_HERMES_STREAMING_NOTES.md`
- `docs/integration/SLICE_08D_MEMORY_SCOPE_BRIDGE.md`
- current Hermes UI BFF route/client/component source

`docs/integration/SLICE_04B_LIVE_HERMES_VERIFICATION.md` was requested but is
not present in this repo.

## Verified Endpoint Surface

Current Hermes `gateway/platforms/api_server.py` registers:

| Method | Path | UI relevance |
| --- | --- | --- |
| `GET` | `/health` | Lightweight liveness. |
| `GET` | `/v1/health` | OpenAI-compatible alias for health. |
| `GET` | `/health/detailed` | Rich status for dashboards. |
| `GET` | `/v1/models` | Advertised model/profile id. |
| `GET` | `/v1/capabilities` | Machine-readable feature flags and endpoints. |
| `GET` | `/v1/skills` | Read-only installed skill metadata. |
| `GET` | `/v1/toolsets` | Read-only toolset metadata for `api_server`. |
| `POST` | `/v1/chat/completions` | OpenAI-compatible chat fallback. |
| `POST` | `/v1/responses` | OpenAI Responses-style endpoint. |
| `GET` | `/v1/responses/{response_id}` | Stored response retrieval. |
| `DELETE` | `/v1/responses/{response_id}` | Stored response deletion. |
| `GET` | `/api/sessions` | List Hermes sessions. |
| `POST` | `/api/sessions` | Create empty Hermes session. |
| `GET` | `/api/sessions/{session_id}` | Read session metadata. |
| `PATCH` | `/api/sessions/{session_id}` | Update session title/end reason. |
| `DELETE` | `/api/sessions/{session_id}` | Delete Hermes session. |
| `GET` | `/api/sessions/{session_id}/messages` | Read session message history. |
| `POST` | `/api/sessions/{session_id}/fork` | Branch session lineage. |
| `POST` | `/api/sessions/{session_id}/chat` | One synchronous session turn. |
| `POST` | `/api/sessions/{session_id}/chat/stream` | SSE session turn. |
| `GET` | `/api/jobs` and job subroutes | Background job admin, out of MVP UI scope. |
| `POST` | `/v1/runs` | Start structured run. |
| `GET` | `/v1/runs/{run_id}` | Poll run status. |
| `GET` | `/v1/runs/{run_id}/events` | SSE structured run events. |
| `POST` | `/v1/runs/{run_id}/approval` | Resolve pending approval. |
| `POST` | `/v1/runs/{run_id}/stop` | Interrupt a running agent. |

## 1. Health And Status

Verified Hermes endpoints:

- `GET /health`
- `GET /v1/health`
- `GET /health/detailed`

Current Hermes UI BFF:

- `GET /api/hermes/status`

Current Hermes UI client attempts:

- `/v1/capabilities`
- `/health`
- `/health/detailed`
- `/v1/models`

Current normalized UI shape:

```ts
type NormalizedHermesStatus = {
  mode: "real" | "mock" | "unconfigured" | "error";
  configured: boolean;
  reachable: boolean;
  baseUrl: string | null;
  capabilities: Record<string, unknown> | null;
  health: Record<string, unknown> | null;
  models: Record<string, unknown> | null;
  error: { kind: string; message: string } | null;
  checkedAt: string;
};
```

UI contract:

- Show configured/reachable status without exposing secrets.
- Show base URL only after sanitizing user/password/search/hash.
- Use `/health` for liveness and `/health/detailed` for operational status.
- Treat partial endpoint success as reachable but preserve endpoint-level gaps
  in future diagnostics.
- Never expose `HERMES_API_KEY` to browser JavaScript.

## 2. Capabilities

Verified Hermes endpoint:

- `GET /v1/capabilities`

Current source returns:

- `object: "hermes.api_server.capabilities"`
- `platform: "hermes-agent"`
- `model`
- `auth.type: "bearer"`
- `auth.required`
- `runtime.mode: "server_agent"`
- `runtime.tool_execution: "server"`
- `features`
- `endpoints`

Verified feature flags include:

- `chat_completions`
- `chat_completions_streaming`
- `responses_api`
- `responses_streaming`
- `run_submission`
- `run_status`
- `run_events_sse`
- `run_stop`
- `run_approval_response`
- `tool_progress_events`
- `approval_events`
- `session_resources`
- `session_chat`
- `session_chat_streaming`
- `session_fork`
- `skills_api`
- `memory_write_api: false`
- `admin_config_rw: false`
- `jobs_admin: false`
- `session_continuity_header: "X-Hermes-Session-Id"`
- `session_key_header: "X-Hermes-Session-Key"`
- `cors`

UI contract:

- Probe capabilities first when deciding which controls to show.
- Hide real stop unless `run_stop` is available and the UI is using a stoppable
  run path.
- Hide approvals unless `approval_events` and `run_approval_response` are
  available.
- Hide session fork unless `session_fork` is available.
- Treat `memory_write_api: false` as a hard boundary for this UI: memory writes
  still go through Hermes agent tools or future Gateway-approved admin surfaces,
  not direct UI writes.
- Use `skills` and `toolsets` later to render deterministic tool registry
  surfaces without asking the model.

## 3. Sessions

Verified Hermes session endpoints:

- `GET /api/sessions`
- `POST /api/sessions`
- `GET/PATCH/DELETE /api/sessions/{session_id}`
- `GET /api/sessions/{session_id}/messages`
- `POST /api/sessions/{session_id}/fork`
- `POST /api/sessions/{session_id}/chat`
- `POST /api/sessions/{session_id}/chat/stream`

Session ids are used as path params for native session endpoints. Session
continuity for OpenAI-compatible endpoints is expressed through:

```text
X-Hermes-Session-Id
```

Current Hermes UI implementation:

- Studio stores local project/session state in browser localStorage.
- Studio sessions include a stable `hermesSessionId`.
- The BFF currently maps the active Studio session to Hermes by calling
  `POST /api/sessions` with that id, accepting `409` as already exists.
- The BFF then streams one turn via
  `/api/sessions/{hermesSessionId}/chat/stream`.

What remains weak:

- Studio session titles are local and MVP-level.
- Hermes session list/history is not yet used to restore Studio session lists.
- Studio does not yet reconcile Hermes session metadata with local project
  metadata.
- Session branch/fork is not exposed.
- Server-side Studio persistence is deferred.

UI contract:

- Keep Studio project/session state explicit.
- Map Studio sessions to Hermes sessions with a stable `hermesSessionId`.
- Use Hermes sessions for transcript continuity, but do not assume Hermes
  sessions alone represent Studio projects, Brain Memory scope, or UI settings.
- Add title/history polish before treating session UX as commercial-grade.

## 4. Streaming Chat

Current MVP BFF route:

```text
POST /api/hermes/chat/stream
```

Current upstream Hermes endpoint used behind the BFF:

```text
POST /api/sessions/{session_id}/chat/stream
```

Verified upstream session stream emits:

- `run.started`
- `message.started`
- `assistant.delta`
- `assistant.completed`
- `tool.progress` for `reasoning.available`
- `tool.started`
- `tool.completed`
- `tool.failed`
- `run.completed`
- `error`
- `done`

Current Hermes UI BFF normalizes:

- `assistant.delta` -> `message_delta`
- `assistant.completed` -> `message_done`
- `tool.started`, `tool.completed`, `tool.failed` -> `tool_event`
- `run.*` -> `run_event`
- `error` -> `error`
- `done` -> `done`

Current limitations:

- `tool.progress` is not currently mapped by Hermes UI because the normalizer
  only accepts `tool.started`, `tool.completed`, and `tool.failed`.
- `message.started` is not currently mapped.
- Real stop/cancel is not implemented.
- Approval UX is not implemented.
- Reconnect/resume is not implemented for the session stream path.
- Command stdout/stderr and artifact details are not yet modeled.

UI contract:

- Continue buffering deltas and flushing via animation frames.
- Treat streaming as a source of structured activity, not just assistant text.
- Render assistant text in the chat timeline and richer tool/run state in
  activity rows and right rail.
- Normalize upstream event names into a stable frontend event model.

## 5. Responses And Chat Completions

Verified OpenAI-compatible endpoints:

- `POST /v1/chat/completions`
- `POST /v1/responses`
- `GET /v1/responses/{response_id}`
- `DELETE /v1/responses/{response_id}`

Chat Completions:

- Supports streaming.
- Supports `X-Hermes-Session-Id`.
- Supports `X-Hermes-Session-Key`.
- Emits standard chat chunks plus Hermes custom tool progress events.
- Supports inline image inputs.
- Rejects file upload and non-image document inputs.

Responses:

- Supports `input`, `instructions`, `previous_response_id`,
  `conversation_history`, `store`, and streaming.
- Supports stored response retrieval/deletion.
- Supports `X-Hermes-Session-Key`.
- Emits Responses-style stream events.
- Supports inline images.
- Rejects uploaded files and non-image document inputs.

UI contract:

- Use OpenAI-compatible endpoints as fallback or compatibility surfaces.
- Prefer Hermes-native sessions for session continuity when building the Studio
  chat/session workspace.
- Prefer Hermes runs/events for commercial-grade agent orchestration when the
  UI needs approvals, cancel, reconnect, status, and durable activity state.

## 6. Runs

Verified Hermes run endpoints:

- `POST /v1/runs`
- `GET /v1/runs/{run_id}`
- `GET /v1/runs/{run_id}/events`
- `POST /v1/runs/{run_id}/approval`
- `POST /v1/runs/{run_id}/stop`

Verified run request fields include:

- `input`
- optional `session_id`
- optional `instructions`
- optional `conversation_history`
- optional `previous_response_id`
- optional `model`

Verified run status includes at least:

- `object: "hermes.run"`
- `run_id`
- `status`
- `session_id`
- `model`
- `output`
- `usage`
- error/last event fields when failed or waiting

Verified run event stream:

- SSE over `GET /v1/runs/{run_id}/events`.
- Sends JSON payloads in `data:` frames.
- Uses keepalive comments.
- Events are structured as an `event` field inside the JSON payload rather than
  a named SSE `event:` field.

Observed event types from current source:

- `message.delta`
- tool progress events forwarded by Hermes callbacks
- `approval.request`
- `approval.responded`
- `run.completed`
- `run.failed`
- `run.cancelled`

Why runs are better for orchestration UX:

- They provide a durable `run_id`.
- Status can be polled.
- Event streams can be attached to separately from submission.
- Approval and stop are run-scoped.
- Long-running agent work fits a run lifecycle better than a one-shot chat
  completion stream.

UI contract:

- Introduce runs behind the BFF in a future slice.
- Keep the session stream path as an MVP fallback.
- Do not show run-only UX controls until BFF support exists.
- Use run events as the preferred source for Codex-like activity blocks.

## 7. Tool Events

Verified event sources:

- Session stream tool callbacks:
  - `tool.progress`
  - `tool.started`
  - `tool.completed`
  - `tool.failed`
- Runs event stream via Hermes callback bridge.
- OpenAI-compatible chat stream custom tool progress event.

Observed payload fields include:

- `tool_name`
- `preview`
- `args`
- `message_id`
- `session_id`
- `run_id`
- `seq`
- `ts` or `timestamp`

UI contract:

- Map tool events to stable activity rows.
- Show a compact row in the chat timeline.
- Show expanded details in the right rail.
- Collapse raw args/output by default.
- Preserve raw payload under a details disclosure for debugging.
- Distinguish reasoning/thinking progress from external tool execution.

## 8. Approvals

Verified Hermes endpoints/events:

- `POST /v1/runs/{run_id}/approval`
- `approval.request`
- `approval.responded`

Verified approval choices:

- `once`
- `session`
- `always`
- `deny`

Aliases accepted by Hermes for `once`:

- `approve`
- `approved`
- `allow`

Request may include:

- `choice`
- `all` or `resolve_all`

UI contract:

- Represent approval requests as blocking activity rows.
- Freeze or mark the run as waiting until the user responds.
- Show the tool/action, risk summary, target, and raw details.
- Send approval responses only through a BFF route.
- Do not implement approvals until run support and BFF approval routes exist.

Slice 13H status:

- The UI now preserves `approval.*` stream frames as normalized
  `approval_event` objects and renders display-only approval activity rows.
- Current production chat still uses `/api/sessions/{session_id}/chat/stream`.
  The inspected session-stream handler does not register or forward approval
  gateway notifications.
- No approval action route or approve/deny controls were added because Hermes'
  action endpoint is run-scoped and requires an active `/v1/runs` approval
  session.

## 9. Stop And Cancel

Verified Hermes endpoint:

```text
POST /v1/runs/{run_id}/stop
```

Current Hermes behavior:

- Sets run status to `stopping`.
- Calls `agent.interrupt("Stop requested via API")`.
- Cancels the async task.
- Returns immediately with `{"run_id": "...", "status": "stopping"}`.

Current Hermes UI status:

- Composer now shows an enabled `Stop generation` button during active
  generation for the current session-stream path.
- No real stop/cancel route exists in the Studio BFF.
- Session stream events include transient `run_id` payloads, but the current UI
  does not own a durable `/v1/runs` run id that is safe to pass to
  `/v1/runs/{run_id}/stop`.
- Slice 13G implements client/BFF stream abort only. It appends a
  `Stopped`/`cancelled` UI activity marker and does not claim server-side run
  interruption.

UI contract:

- Do not claim server-side Hermes stop until the UI has a Hermes `/v1/runs`
  `run_id` or another verified cancellable operation id.
- Implement stop through the BFF, not direct browser-to-Hermes calls.
- Distinguish client-side stream close from real Hermes interrupt.
- Render final cancellation status from Hermes events/status, not optimism.
- When using the MVP session-stream path, label stop behavior as stream abort
  and record `serverSideRunStop: false` in the UI activity details.

## 10. Files And Artifacts

Current verified API server limitation:

- Inline image inputs are supported in Chat Completions and Responses.
- Uploaded files, `input_file`, `file_id`, and non-image document inputs are
  not supported through the API server.

Hermes tools may still create/read/write files on the server host because tools
execute server-side under the API server runtime.

Current Hermes UI status:

- Right rail has a files/artifacts tab.
- Artifacts are local/mock metadata unless Hermes emits artifact-shaped event
  data.
- Slice 13I keeps preview/download disabled because no verified Hermes artifact
  endpoint exists.

UI contract:

- Do not present file upload as real until Hermes exposes an approved file path
  or the Studio BFF owns a safe file/artifact service.
- Treat tool-generated file events as activity/artifact events when Hermes emits
  enough metadata.
- Keep artifact rendering read-only until a future file-management contract is
  defined.

## 11. Provider And Model Selection

Verified current docs:

- `/v1/models` returns an advertised model/profile id.
- `API_SERVER_MODEL_NAME` can override the advertised model name.
- Programmatic integration docs mention request body `model` or
  `X-Hermes-Model`.
- API server docs currently state the request `model` field is cosmetic and the
  actual LLM model comes from server-side config.

Verified current source nuance:

- `api_server.py` stores/echoes request body `model` in some response/status
  surfaces.
- `_create_agent()` resolves the actual runtime model from gateway config/env.
- Source inspection did not find `X-Hermes-Model` being read in
  `api_server.py` at reviewed HEAD.

UI contract:

- Keep provider/model selector disabled until behavior is tested live against
  the running Hermes version.
- Treat model selection as capability/config driven, not a simple OpenAI model
  dropdown.
- Prefer displaying the active Hermes profile/model from `/v1/models` and
  `/v1/capabilities` before allowing changes.
- Future provider/model UX should explain whether it changes runtime behavior
  or only tags the request.

## 12. Memory And Session Context

Verified Hermes headers:

- `X-Hermes-Session-Id`
- `X-Hermes-Session-Key`

Verified memory-scope behavior:

- `X-Hermes-Session-Key` is a stable per-channel long-term memory scope.
- It is independent of transcript/session id.
- Hermes validates the header length and rejects control characters.
- Hermes requires API-key auth for caller-supplied session keys.
- Header is supported on Chat Completions, Responses, and Runs.

Current Hermes UI implementation:

- The BFF forwards project stable key as `X-Hermes-Session-Key`.
- The BFF sends structured `metadata.context`.
- Slice 08D added an instruction bridge because current session chat does not
  forward request-body `metadata.context` into agent/MCP tool context.

Known limitation:

- Hermes currently ignores `metadata.context` for session chat tool calls unless
  the UI bridges scope through `instructions`.

Future ideal:

- Hermes should propagate first-class structured `metadata.context` into
  agent/MCP runtime context.
- When that exists, Studio can remove or reduce the instruction bridge.

UI contract:

- Keep memory scope explicit in UI, BFF request validation, and event models.
- Continue using `X-Hermes-Session-Key` for project-level long-term memory
  scope.
- Preserve Gateway-mediated Brain Memory observability/admin boundaries.

## 13. Security

Verified Hermes behavior:

- Bearer auth uses `Authorization: Bearer <API_SERVER_KEY>`.
- `API_SERVER_CORS_ORIGINS` controls CORS.
- Browser CORS access is disabled by default unless explicitly configured.
- Tools execute server-side in the API server runtime.

UI contract:

- Browser must never call Hermes directly.
- Browser must never receive `HERMES_API_KEY`.
- BFF must sanitize error output.
- BFF must bound request sizes.
- BFF must not proxy arbitrary user-supplied URLs.
- Treat Hermes as high privilege because it can execute tools, commands, file
  operations, web actions, memory actions, and future approvals.

## Hermes-Native UI Strategy

Current MVP:

- Browser calls `/api/hermes/chat/stream`.
- BFF ensures/creates Hermes session via `/api/sessions`.
- BFF streams `/api/sessions/{id}/chat/stream`.
- BFF normalizes Hermes SSE into a small UI event set.
- UI stores transcript locally and batches text deltas with
  `requestAnimationFrame`.
- UI uses the memory-scope instruction bridge because current Hermes session
  chat ignores `metadata.context` for tool context.

Future strategy:

- Treat `/v1/capabilities` as the source of truth for available Hermes UX.
- Keep session chat streaming as a simple MVP path.
- Prefer `/v1/runs` plus `/v1/runs/{id}/events` for commercial-grade agent UX
  when implementing approvals, stop, reconnect, durable run status, and rich
  activity timelines.
- Use OpenAI-compatible Chat Completions and Responses as compatibility and
  fallback surfaces, not the whole product model.
- Normalize Hermes events in the BFF into stable frontend activity events.
- Render chat text, tool progress, command execution, memory activity,
  approvals, artifacts, and errors as first-class orchestration elements.
- Keep Brain Memory reads/writes Gateway-mediated and scope-aware.

## Implementation Guidance

Near-term slices should not add visual decoration around mock events. They
should first define and then consume real event contracts:

1. Reconcile Hermes capabilities into a typed BFF status/capability model.
2. Add a stable frontend `AgentActivityEvent` type.
3. Expand BFF normalization to include `tool.progress`, `message.started`,
   run events, approvals, and cancellation.
4. Move real stop/cancel to a run-backed BFF path.
5. Add approvals only after BFF run support exists.
6. Add provider/model controls only after current Hermes runtime behavior is
   verified live.
