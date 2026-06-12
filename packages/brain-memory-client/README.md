# @hermes-ui/brain-memory-client

Typed server-side client for Brain Memory Gateway UI/read-only endpoints.

Current supported calls:

- `getBrainMemoryStatus` — `GET /health` + `GET /ui/capabilities`
- `searchBrainMemory` — `POST /ui/memory/search` (with `GET` fallback)
- `inspectBrainMemory` — `GET /ui/memory/{id}` (+ evidence, supersession chain,
  and `GET /v1/memory/{id}` lifecycle detail)
- `fetchLifecycleMetrics` — `GET /v1/memory/lifecycle/metrics`
- `fetchLifecycleTimeline` — `GET /v1/memory/lifecycle/timeline`

Contract: every function resolves to a normalized envelope with a `mode`
(`real | mock | unconfigured | error`) and a typed `error` field. Functions
never throw and never leak configured secrets into responses. Disabled or
unconfigured Gateways degrade to `mock`/`unconfigured` envelopes so the UI can
render a quiet standalone state.

This package is for Gateway-mediated observability only. It must not import or
call Postgres, Redis, Qdrant, RAGLight, filesystem memory internals, or any
storage adapter directly.
