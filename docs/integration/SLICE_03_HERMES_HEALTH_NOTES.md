# Slice 03 Hermes Health Notes

Date: 2026-05-29

## Scope

Slice 03 adds the first real Hermes integration, limited to server-side health,
models, and capabilities checks.

It does not add chat sending, streaming, sessions, Responses, Runs, approvals,
provider switching, Brain Memory integration, auth, or secrets management UI.

## Environment Variables

Copy `.env.example` to `.env.local` for local development.

```text
HERMES_API_BASE_URL=http://127.0.0.1:8642
HERMES_API_KEY=
HERMES_UI_ENABLE_REAL_HERMES=true
```

Notes:

- `HERMES_API_BASE_URL` enables real Hermes status checks.
- `HERMES_API_KEY` is optional in config but required by authenticated Hermes
  endpoints such as `/v1/capabilities` and `/v1/models` when Hermes enforces
  bearer auth.
- `HERMES_UI_ENABLE_REAL_HERMES=false` forces mock mode even if a base URL is set.
- The API key is only read in the Next.js route handler and is never returned to
  the browser.

## BFF Route

Browser code calls:

```http
GET /api/hermes/status
```

The route lives at:

```text
apps/web/src/app/api/hermes/status/route.ts
```

The route calls the server-side package:

```text
packages/hermes-client/src/index.ts
```

Architecture remains:

```text
Browser -> Next.js BFF route -> server-side Hermes client -> Hermes API server
```

## Normalized Response Shape

```ts
type NormalizedHermesStatus = {
  mode: "real" | "mock" | "unconfigured" | "error";
  configured: boolean;
  reachable: boolean;
  baseUrl: string | null;
  capabilities: Record<string, unknown> | null;
  health: Record<string, unknown> | null;
  models: Record<string, unknown> | null;
  error: {
    kind:
      | "disabled"
      | "unconfigured"
      | "invalid_config"
      | "network"
      | "timeout"
      | "http_error"
      | "unknown";
    message: string;
  } | null;
  checkedAt: string;
};
```

`baseUrl` is sanitized for display. Secrets are not included.

## Hermes Endpoints Attempted

The tolerant client attempts:

- `GET /v1/capabilities`
- `GET /health`
- `GET /health/detailed`
- `GET /v1/models`

`/v1/capabilities` and `/v1/models` receive `Authorization: Bearer <HERMES_API_KEY>`
when `HERMES_API_KEY` is configured. Health endpoints are attempted without auth.

If any endpoint succeeds, the normalized payload is `mode: "real"` and
`reachable: true`. If all endpoints fail, the payload becomes `mode: "error"`
with a sanitized error.

## UI Behavior

- Sidebar and top bar show Hermes status as checking, unconfigured, mock,
  connected, or unreachable.
- The right context panel includes a Hermes status card with configured,
  reachable, base URL, last checked time, capabilities, and a refresh button.
- The chat transcript remains mocked and explicitly says this slice only checks
  health/capabilities through the BFF.

## What Is Real

- Next.js BFF route.
- Server-side Hermes status client.
- Fetches to Hermes health/capabilities/models when configured.
- Browser fetch to `/api/hermes/status`.
- UI status normalization and refresh.

## What Remains Mocked

- Chat sending.
- Streaming.
- Hermes sessions.
- Hermes Responses/Runs.
- Approvals/stop.
- Brain Memory Gateway status.
- Brain Memory retrieval/evidence.
- Provider/model switching.

## Testing With Hermes Running

1. Start Hermes gateway with API server enabled.
2. Configure `.env.local`:

```text
HERMES_API_BASE_URL=http://127.0.0.1:8642
HERMES_API_KEY=your-local-key
HERMES_UI_ENABLE_REAL_HERMES=true
```

3. Restart the Next.js dev server:

```powershell
npm run dev
```

4. Open:

```text
http://localhost:3000
```

5. Confirm the Hermes status card shows reachable and lists capabilities.

## Checks Run

```powershell
npm run typecheck
npm run build
npm audit --audit-level=moderate
```

Additional smoke checks:

- No-env BFF response returns `mode: "unconfigured"`.
- Invalid URL client normalization returns `mode: "error"` and does not leak an API key.
- Unreachable URL returns `mode: "error"` with safe network message.
- Browser UI shows Hermes unconfigured state, refresh control, and no horizontal overflow.

## Known Limitations

- No live Hermes instance was available during this slice, so connected-mode UI
  was implemented against the documented response shape and package normalizer.
- Auth errors on `/v1/capabilities` can coexist with successful `/health`;
  future slices may expose endpoint-level warnings if needed.
- There is no auth for the Studio app yet. Do not expose it beyond trusted local
  development.

## Slice 04

Slice 04 should add real Hermes chat streaming and run events only after checking
`/v1/capabilities` at runtime. It should keep the BFF boundary and avoid
per-token React state updates.
