# Provider Model Selector 13J

Date: 2026-05-31

## Scope

Slice 13J adds an honest provider/model selector foundation and documents the
fast-stream UX constraints needed for future Cerebras/Kimi-like providers.

The architecture remains:

```text
Browser UI -> Next.js BFF -> Hermes API server -> Hermes server-configured runtime
```

No direct browser-to-Hermes calls, provider calls, provider credentials, Hermes
source changes, Brain Memory changes, memory mutations, or storage access were
added.

## Hermes Model And Provider Findings

Live `GET /api/hermes/status` currently reports:

- `mode: "real"`;
- `reachable: true`;
- `capabilities.model: "hermes-agent"`;
- `/v1/models` returns one model id: `hermes-agent`;
- `uiCapabilities.models.clientSelectable: false`;
- `uiCapabilities.models.serverConfiguredOnly: true`.

Current Hermes source/docs findings:

- `/v1/models` advertises the API server model/profile id.
- `API_SERVER_MODEL_NAME` can override the advertised model name.
- API server docs state the request `model` field is accepted but the actual
  LLM runtime model is configured server-side.
- Programmatic integration docs mention request body `model` and
  `X-Hermes-Model`.
- Reviewed `api_server.py` did not read `X-Hermes-Model`.
- `_create_agent()` resolves the actual runtime model through Gateway
  config/env via `_resolve_gateway_model()` and runtime agent kwargs.
- Session creation stores a body `model`, and OpenAI-compatible responses echo
  request `model`, but this is not enough to verify runtime switching for the
  current `/api/sessions/{session_id}/chat/stream` path.

Conclusion: the UI must display the current server-advertised model but keep
runtime switching disabled until Hermes exposes or verifies a BFF-safe
client-selectable path.

## Provider/Model UI State

`HermesUiCapabilities.models` now includes:

- `currentModelLabel`;
- `currentProviderLabel`;
- `serverConfiguredOnly`;
- `clientSelectable`;
- `modelsListAvailable`;
- `availableModels`;
- `selectedModelId`;
- `selectionStatus`;
- `reason`;
- `fastStreamProfile`.

Current values are derived from Hermes status/capabilities and remain:

- `selectionStatus: "server-configured"`;
- `clientSelectable: false`;
- `currentProviderLabel: "Hermes server config"`;
- `fastStreamProfile: "unknown"`.

## UI Behavior

The composer provider/model control remains disabled. It displays the current
server-advertised model with a server-configured label, for example:

```text
hermes-agent - Server-configured
```

The tooltip explains that runtime model switching is not verified for the
current Hermes session API. The BFF chat request now sends `model: null` unless
the normalized Hermes capability state explicitly becomes `clientSelectable`.

Hermes status in the right rail shows:

- current model;
- provider source;
- selection mode;
- fast-stream profile.

## Fast-Stream UX Constraints

Future Cerebras/Kimi-like providers may stream extremely fast. The UI contract
is:

- do not update React state once per token;
- accumulate text deltas in mutable buffers;
- flush visible text with `requestAnimationFrame` or bounded intervals;
- keep raw activity details collapsed and lazy;
- avoid expensive markdown rendering on every delta;
- consider transcript virtualization before high-volume sessions;
- keep provider credentials and provider requests behind the BFF/Hermes
  runtime, never in browser code.

Current `ChatView` already buffers assistant deltas in a local `accumulated`
string and schedules assistant message updates through `requestAnimationFrame`.
This slice did not rewrite streaming. It tightened the model request path so
the UI does not pass a fake placeholder model as if it selected runtime.

## Cerebras/Kimi Future Notes

Cerebras/Kimi fast mode remains planned only. A future slice should verify:

- whether Hermes server config can select a Cerebras/Kimi provider;
- whether Hermes exposes a BFF-safe runtime model switch;
- whether high-rate streams need additional interval throttling beyond
  animation-frame batching;
- whether transcript virtualization is needed for very long outputs;
- how to surface throughput diagnostics without making them user-facing noise.

No Cerebras/OpenRouter/OpenAI/provider keys were added.

## Next Steps

Slice 13K - Brain Memory Event Timeline.
