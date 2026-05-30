# Hermes Capability Mapping 13C

Date: 2026-05-30

## Purpose

Slice 13C adds a typed, UI-facing interpretation of Hermes status and
capabilities. It does not change Hermes streaming, Brain Memory BFF behavior,
memory scope bridging, stable project/session keys, admin actions, auth,
provider switching, approvals, or stop/cancel behavior.

The browser still receives Hermes state only from the Web UI BFF:

```text
Browser UI -> Next.js BFF -> Hermes API server
```

## Live Hermes Fields Observed

The running local Web UI reported Hermes as:

| Field | Observed value |
| --- | --- |
| BFF route | `GET /api/hermes/status` |
| Status mode | `real` |
| Configured | `true` |
| Reachable | `true` |
| Base URL | `http://127.0.0.1:8642` |
| Advertised model | `hermes-agent` |
| `/v1/models` object | `list` |
| `/v1/models` count | `1` |

Observed `capabilities.features`:

| Feature | Value |
| --- | --- |
| `chat_completions` | `true` |
| `chat_completions_streaming` | `true` |
| `responses_api` | `true` |
| `responses_streaming` | `true` |
| `run_submission` | `true` |
| `run_status` | `true` |
| `run_events_sse` | `true` |
| `run_stop` | `true` |
| `run_approval_response` | `true` |
| `tool_progress_events` | `true` |
| `approval_events` | `true` |
| `session_resources` | `true` |
| `session_chat` | `true` |
| `session_chat_streaming` | `true` |
| `session_fork` | `true` |
| `admin_config_rw` | `false` |
| `jobs_admin` | `false` |
| `memory_write_api` | `false` |
| `skills_api` | `true` |
| `audio_api` | `false` |
| `realtime_voice` | `false` |
| `session_continuity_header` | `X-Hermes-Session-Id` |
| `session_key_header` | `X-Hermes-Session-Key` |
| `cors` | `false` |

Observed `capabilities.endpoints` include:

- `/health`
- `/health/detailed`
- `/v1/models`
- `/v1/chat/completions`
- `/v1/responses`
- `/v1/runs`
- `/v1/runs/{run_id}`
- `/v1/runs/{run_id}/events`
- `/v1/runs/{run_id}/approval`
- `/v1/runs/{run_id}/stop`
- `/v1/skills`
- `/v1/toolsets`
- `/api/sessions`
- `/api/sessions/{session_id}`
- `/api/sessions/{session_id}/messages`
- `/api/sessions/{session_id}/fork`
- `/api/sessions/{session_id}/chat`
- `/api/sessions/{session_id}/chat/stream`

## Normalized UI Capability Model

The typed model is exposed as:

```ts
status.uiCapabilities
```

Top-level groups:

- `status`: configured, reachable, and mode.
- `chat`: session chat, session streaming, Chat Completions, Responses, and
  whether the current UI can send through the advertised session stream path.
- `runs`: run submission, status, SSE events, and reconnect readiness.
- `tools`: skills/toolsets registry availability and tool progress events.
- `approvals`: whether Hermes advertises approval events and responses, plus
  whether this UI has implemented them.
- `cancellation`: run stop endpoint availability and whether the current UI path
  can truly stop work.
- `files`: upload/artifact support state.
- `models`: model list, advertised server model, and selector readiness.
- `memory`: continuity/scope headers, metadata context propagation status,
  instruction bridge state, and memory write API status.
- `ui`: the final UI control decisions consumed by components.

The model intentionally separates Hermes availability from UI readiness. A
feature can be advertised by Hermes while still marked `deferred` in the UI if
the Web UI does not yet have the required BFF route, run id, event model, or
verified behavior.

## Current UI Decisions

| Surface | Decision |
| --- | --- |
| Chat send | Available only when Hermes is `real`, reachable, and session streaming is advertised. Mock/unconfigured fallback remains honest. |
| Session stream | Available in the observed local Hermes state. Existing streaming path is unchanged. |
| Runs | Hermes advertises runs/status/events, but the UI has not switched chat to a run-backed path. |
| Tool activity | Tool event display remains tied to real normalized stream events. Skills/toolsets registry UI is deferred. |
| Approvals | Hermes advertises approval events and response endpoint. UI remains `deferred` because no BFF approval route or approval row exists yet. |
| Stop/cancel | Hermes advertises `/v1/runs/{run_id}/stop`. Slice 13G enables client/BFF stream abort for the current session-stream path, but server-side run stop remains deferred until chat is run-backed. |
| Provider/model selector | Model list is visible to status logic. Slice 13J adds a richer server-configured UI state, but client selector remains disabled because runtime model-switch behavior is not live-verified as a safe UI action. |
| Files/artifacts | File uploads are not supported through the verified API server path. Artifacts remain local/mock metadata until a safe artifact source exists. |
| Memory scope | `X-Hermes-Session-Key` is advertised. Instruction bridge is reported as active unless `HERMES_UI_ENABLE_MEMORY_SCOPE_BRIDGE=false`. Metadata context propagation remains `unknown`. |
| Memory mutation/admin | Not added. `memory_write_api=false` remains a hard boundary for this UI. |

## Component Consumption

- `HermesStatusPanel` renders the normalized capability summary instead of
  slicing raw feature flags directly.
- `Composer` keeps provider/model and stop controls disabled, but their titles
  now reflect capability state.
- Slice 13J extends model state with current model/provider labels,
  available model metadata, selection status, reason, and fast-stream profile.
- `ContextRail` keeps tool and file empty states honest about whether the UI is
  available, deferred, or unknown.
- `scripts/mvp-smoke.mjs` now verifies that `/api/hermes/status` includes
  `uiCapabilities`.

## Non-Changes

- No Hermes streaming behavior changed.
- No direct browser-to-Hermes calls were added.
- No direct browser-to-Brain Memory calls were added.
- No Brain Memory BFF logic changed.
- No memory scope bridge logic changed.
- No project/session stable key logic changed.
- No memory mutation/admin actions were added.
- No auth/classification behavior was implemented.
- No provider/model selector behavior was enabled.
- Slice 13G later enabled client/BFF stream abort only. No server-side run stop
  route was added in Slice 13C.
- No production Hermes or Brain Memory service source was modified.

## Regression Expectations

The status route must keep returning a `NormalizedHermesStatus` object with
`uiCapabilities`, even in mock, unconfigured, and error states.

Default smoke checks should remain non-mutating. Live send smoke remains opt-in
and should only be required when Hermes is real/reachable.

## Next Recommended Slice

Slice 13D: AgentActivityEvent frontend type/model.

Reason: capabilities now tell the UI what Hermes can advertise. The next
regression boundary should define the stable activity event type before adding
new visual activity behavior, run-backed stop, approvals, command output, memory
activity, or artifact handling.
