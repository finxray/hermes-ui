# Hermes integration notes

Codex must refresh these notes during Slice 0.

## Preferred integration order

1. Use Hermes capabilities/health endpoints to discover what is available.
2. Use Hermes session endpoints for project/session UI if available.
3. Use run endpoints for structured streaming, stop, and approvals if available.
4. Use `/v1/chat/completions` or `/v1/responses` as fallback/compatibility path.

## Candidate endpoints to verify

```text
GET  /health
GET  /health/detailed
GET  /v1/models
GET  /v1/capabilities
POST /v1/chat/completions
POST /v1/responses
GET  /v1/responses/{response_id}
DELETE /v1/responses/{response_id}
GET  /api/sessions
POST /api/sessions
GET  /api/sessions/{session_id}
PATCH /api/sessions/{session_id}
DELETE /api/sessions/{session_id}
GET  /api/sessions/{session_id}/messages
POST /api/sessions/{session_id}/fork
POST /api/sessions/{session_id}/chat
POST /api/sessions/{session_id}/chat/stream
POST /v1/runs
GET  /v1/runs/{run_id}
GET  /v1/runs/{run_id}/events
POST /v1/runs/{run_id}/approval
POST /v1/runs/{run_id}/stop
```

## Headers/fields to verify

```text
Authorization: Bearer <API_SERVER_KEY>
X-Hermes-Session-Id
X-Hermes-Session-Key
X-Hermes-Model
Idempotency-Key
```

## Security note

If browser calls Hermes directly, CORS allowlists are required. Preferred design is browser -> Web UI BFF -> Hermes, so secrets stay server-side.
