# Hermes Discovery

Date: 2026-05-29
Hermes repository: https://github.com/NousResearch/hermes-agent
Reviewed HEAD: `a87f0a82a52178b05ff7405e9af7137e20a70bbf`

## Sources Reviewed

- Official repository README: https://github.com/NousResearch/hermes-agent
- API server docs: https://github.com/NousResearch/hermes-agent/blob/main/website/docs/user-guide/features/api-server.md
- Programmatic integration docs: https://github.com/NousResearch/hermes-agent/blob/main/website/docs/developer-guide/programmatic-integration.md
- API server source: https://github.com/NousResearch/hermes-agent/blob/main/gateway/platforms/api_server.py

Local temporary copies were downloaded outside this repo for inspection:

- `%TEMP%\hermes-agent-discovery\README.md`
- `%TEMP%\hermes-agent-discovery\api-server.md`
- `%TEMP%\hermes-agent-discovery\programmatic-integration.md`
- `%TEMP%\hermes-agent-discovery\api_server.py`

## Endpoint Map

Verified in `gateway/platforms/api_server.py` route registration:

| Method | Path | Notes |
| --- | --- | --- |
| `GET` | `/health` | Simple unauthenticated health check returning status/platform. |
| `GET` | `/v1/health` | Alias for `/health`. |
| `GET` | `/health/detailed` | Rich gateway status: gateway state, platforms, active agents, PID, update time. |
| `GET` | `/v1/models` | Authenticated OpenAI-style model list. Advertised id defaults to active profile or `hermes-agent`; override via `API_SERVER_MODEL_NAME`. |
| `GET` | `/v1/capabilities` | Authenticated machine-readable surface for features, headers, and endpoints. This should be the first integration probe. |
| `GET` | `/v1/skills` | Authenticated read-only installed skills metadata. Out of initial chat scope but useful later for capability views. |
| `GET` | `/v1/toolsets` | Authenticated read-only toolset metadata. Useful later for tool visibility. |
| `POST` | `/v1/chat/completions` | OpenAI Chat Completions. Supports streaming SSE and Hermes tool progress events. |
| `POST` | `/v1/responses` | OpenAI Responses-style endpoint. Supports `previous_response_id`, `conversation`, optional storage, streaming events, and memory-scope header. |
| `GET` | `/v1/responses/{response_id}` | Retrieve stored response. |
| `DELETE` | `/v1/responses/{response_id}` | Delete stored response from Hermes response store. |
| `GET` | `/api/sessions` | Authenticated paginated SessionDB list with `limit`, `offset`, `source`, `include_children`. |
| `POST` | `/api/sessions` | Create empty persisted Hermes session. Accepts optional `id`/`session_id`, `model`, `system_prompt`, `title`. |
| `GET` | `/api/sessions/{session_id}` | Read client-safe Hermes session metadata. |
| `PATCH` | `/api/sessions/{session_id}` | Update client-safe metadata: `title`, `end_reason`. |
| `DELETE` | `/api/sessions/{session_id}` | Delete Hermes session. |
| `GET` | `/api/sessions/{session_id}/messages` | Read client-safe session messages. |
| `POST` | `/api/sessions/{session_id}/fork` | Branch a session using SessionDB lineage. |
| `POST` | `/api/sessions/{session_id}/chat` | Run one synchronous turn against a persisted Hermes session. |
| `POST` | `/api/sessions/{session_id}/chat/stream` | SSE wrapper over one persisted-session turn. Emits `assistant.delta`, `tool.started`, `tool.completed`, `run.completed`. |
| `GET` | `/api/jobs` | Scheduled/background job API. Verified but not part of the initial UI plan. |
| `POST` | `/api/jobs` | Job creation. Out of scope for initial UI. |
| `GET` | `/api/jobs/{job_id}` | Job detail. Out of scope for initial UI. |
| `PATCH` | `/api/jobs/{job_id}` | Job update. Out of scope for initial UI. |
| `DELETE` | `/api/jobs/{job_id}` | Job delete. Out of scope for initial UI. |
| `POST` | `/api/jobs/{job_id}/pause` | Job pause. Out of scope for initial UI. |
| `POST` | `/api/jobs/{job_id}/resume` | Job resume. Out of scope for initial UI. |
| `POST` | `/api/jobs/{job_id}/run` | Trigger job. Out of scope for initial UI. |
| `POST` | `/v1/runs` | Start a structured run, returns `202` with `run_id` and status. |
| `GET` | `/v1/runs/{run_id}` | Poll run status. |
| `GET` | `/v1/runs/{run_id}/events` | SSE stream of structured lifecycle events. |
| `POST` | `/v1/runs/{run_id}/approval` | Resolve pending approval. |
| `POST` | `/v1/runs/{run_id}/stop` | Interrupt active run/agent turn. |

## Chat Completions

`POST /v1/chat/completions` is stable enough as an OpenAI-compatible fallback and for compatibility with existing frontends.

Important behavior:

- Requires bearer auth when `API_SERVER_KEY` is configured.
- Accepts `messages` and `stream`.
- Text-only and image URL/data image inputs are normalized; file inputs are rejected.
- System messages become an ephemeral prompt layered on top of Hermes' core prompt.
- If `X-Hermes-Session-Id` is provided, Hermes loads history from SessionDB instead of relying only on request-body history.
- If no session id is provided, Hermes derives a deterministic API session id from system prompt plus first user message.
- Supports `X-Hermes-Session-Key` for long-term memory scoping.
- Streaming emits standard `chat.completion.chunk` events plus `event: hermes.tool.progress` for tool-start visibility.

Assessment: not enough by itself for the full UI because session lifecycle, message history, approvals, reconnectable status, and stop/cancel require richer endpoints.

## Responses API

`POST /v1/responses` is stable enough to evaluate for a richer OpenAI-style integration.

Important behavior:

- Accepts `input`, `instructions`, `previous_response_id`, `conversation`, `conversation_history`, `store`, and `stream`.
- Stores complete conversation history when `store` is true.
- Supports retrieving and deleting stored responses.
- Reuses stored session id across `previous_response_id` chains.
- Supports `X-Hermes-Session-Key`.
- Streaming emits Responses-style events such as text deltas and structured tool items.
- Response headers include `X-Hermes-Session-Id` and, when used, `X-Hermes-Session-Key`.

Assessment: strong candidate when OpenAI Responses semantics matter, but the UI still needs Studio project/session metadata and should not depend only on response chaining.

## Sessions

Hermes sessions are represented through SessionDB-backed REST resources.

Client-safe session fields include:

- `id`
- `source`
- `user_id`
- `model`
- `title`
- `started_at`
- `ended_at`
- `end_reason`
- `message_count`
- `tool_call_count`
- token/cost counters
- `parent_session_id`
- `last_active`
- `preview`
- `_lineage_root_id`
- `has_system_prompt`
- `has_model_config`

Client-safe message fields include:

- `id`
- `session_id`
- `role`
- `content`
- `tool_call_id`
- `tool_calls`
- `tool_name`
- `timestamp`
- `token_count`
- `finish_reason`
- `reasoning`
- `reasoning_content`

Assessment: use Hermes native sessions, but wrap/mirror them in Studio's own project/session model because Hermes sessions do not by themselves provide the Studio project list, Brain Memory project metadata, or UI-specific settings.

## Runs, Events, Approvals, And Stop

`POST /v1/runs` accepts:

- `input`
- optional `session_id`
- optional `instructions`
- optional `conversation_history`
- optional `previous_response_id`
- optional `model`

It returns a `run_id` and stores run status. Events include at least:

- `message.delta`
- tool progress events from Hermes callbacks
- `approval.request`
- `approval.responded`
- `run.completed`
- `run.failed`
- `run.cancelled`

`GET /v1/runs/{run_id}/events` is an SSE stream with keepalives and JSON event payloads.

`POST /v1/runs/{run_id}/approval` accepts `choice` values:

- `once`
- `session`
- `always`
- `deny`

Aliases include `approve`, `approved`, and `allow` mapping to `once`. It also supports `all`/`resolve_all`.

`POST /v1/runs/{run_id}/stop` sets status to `stopping`, calls `agent.interrupt("Stop requested via API")`, cancels the task, and returns immediately with `{"run_id": "...", "status": "stopping"}`.

Assessment: runs are the best fit for long-running agent work, approval UX, cancellation, and reconnect-friendly status. Slice 04 should capability-gate this path and retain fallback behavior.

## Capabilities

`GET /v1/capabilities` advertises:

- auth type and whether auth is required;
- server runtime mode;
- feature flags for chat completions, Responses, run submission/status/events/stop/approval, tool progress events, sessions, session chat/streaming/fork, skills, and CORS;
- session continuity header: `X-Hermes-Session-Id`;
- session key header: `X-Hermes-Session-Key`;
- endpoint paths.

Assessment: every integration slice should call this first and adapt based on returned features.

## Health

Use:

- `GET /health` for lightweight liveness.
- `GET /health/detailed` for dashboard status.
- `GET /v1/health` as an OpenAI-compatible alias.

`/health/detailed` is documented/source-commented as unauthenticated.

## Auth, CORS, Bind Address, And API Keys

Verified configuration:

- `API_SERVER_ENABLED=false` by default.
- `API_SERVER_PORT=8642` by default.
- `API_SERVER_HOST=127.0.0.1` by default.
- `API_SERVER_KEY` is required for real deployments.
- `API_SERVER_CORS_ORIGINS` is empty by default.
- `API_SERVER_MODEL_NAME` can override advertised model name.

Auth:

- Bearer token via `Authorization: Bearer <API_SERVER_KEY>`.
- Source says the no-key branch exists for tests/unsupported manual wiring, while docs say `API_SERVER_KEY` is required for every deployment.

CORS:

- Browser CORS is disabled by default.
- Direct browser access requires an explicit `API_SERVER_CORS_ORIGINS` allowlist.
- SSE responses include CORS headers when enabled.

Risk:

- Hermes API server has access to Hermes' configured toolset, which can include terminal, file, web, and other high-privilege tools. Do not expose Hermes directly to browsers or local networks unless auth, CORS, and network policy are deliberately configured.

## Model Switching

The README says Hermes can use many providers, including Kimi/Moonshot, and users can switch with `hermes model`. Programmatic integration docs say API server callers include a `model` field in request bodies or set `X-Hermes-Model`.

Current source inspection confirms model names are advertised via `/v1/models` and request bodies read `model` in multiple paths, but Slice 03 should test whether `X-Hermes-Model` is honored consistently by the current API server before exposing a model selector.

## Stable Enough To Build Against

Stable enough for first integration:

- `GET /health`
- `GET /health/detailed`
- `GET /v1/models`
- `GET /v1/capabilities`
- `GET /api/sessions`
- `POST /api/sessions`
- `GET/PATCH/DELETE /api/sessions/{session_id}`
- `GET /api/sessions/{session_id}/messages`
- `POST /api/sessions/{session_id}/chat/stream`
- `POST /v1/responses`
- `GET/DELETE /v1/responses/{response_id}`
- `POST /v1/runs`
- `GET /v1/runs/{run_id}`
- `GET /v1/runs/{run_id}/events`
- `POST /v1/runs/{run_id}/approval`
- `POST /v1/runs/{run_id}/stop`

Use `/v1/capabilities` at runtime rather than hard-coding availability.

## Fallback Behavior Needed

- If sessions are unavailable, use `/v1/responses` with stored response chaining.
- If Responses are unavailable, use `/v1/chat/completions` with full history and `X-Hermes-Session-Id` when supported.
- If runs are unavailable, use `/api/sessions/{id}/chat/stream` or `/v1/responses` streaming and hide approval/stop UI.
- If approvals are unavailable, render approval requests as unsupported and instruct the user to continue in a native Hermes surface.
- If stop is unavailable, close the browser stream and mark cancellation as client-side only.
- If `X-Hermes-Session-Key` is unavailable, warn that project-level long-term memory scoping is degraded.

## Tests Before UI Integration

Before Slice 03/04 real integration:

- Start Hermes gateway with `API_SERVER_ENABLED=true`, loopback host, and `API_SERVER_KEY`.
- Verify BFF can call `/health`, `/health/detailed`, `/v1/models`, `/v1/capabilities`.
- Verify `Authorization` is required for authenticated endpoints.
- Verify CORS remains unnecessary for browser because browser calls BFF only.
- Create a Hermes session, set title, list it, read it, and fetch messages.
- Stream `/api/sessions/{id}/chat/stream` and confirm event names.
- Start `/v1/runs`, subscribe to `/events`, stop a run, and inspect final status.
- Trigger a safe approval workflow and verify approval choices.
- Send `X-Hermes-Session-Id` and `X-Hermes-Session-Key`; confirm returned headers and memory scoping behavior.
- Test a model override via request `model` and, separately, `X-Hermes-Model`.
- Test stream disconnection and ensure Hermes interrupts or completes safely.

