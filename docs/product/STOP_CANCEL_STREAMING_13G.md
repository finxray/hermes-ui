# Stop And Cancel Streaming 13G

Date: 2026-05-30

## Purpose

Slice 13G replaces the disabled stop placeholder with the safest currently
correct stop behavior for the existing MVP chat stream.

The architecture remains:

```text
Browser UI -> Next.js BFF -> Hermes API server
```

No direct browser-to-Hermes call was added.

## Strategy Chosen

Strategy B: client/BFF stream abort.

The current UI path uses:

```text
POST /api/hermes/chat/stream
  -> POST /api/sessions/{hermesSessionId}/chat/stream
```

The local Hermes session stream does include `run_id` values in streamed event
payloads. However, the verified `/v1/runs/{run_id}/stop` endpoint is scoped to
runs created and tracked by `/v1/runs`. The current session chat stream does
not give the UI a durable `/v1/runs` run id that is safe to stop through that
endpoint.

Because of that, this slice does not add `POST /api/hermes/run/stop` and does
not claim server-side Hermes run interruption.

## What Is Implemented

The browser now owns an `AbortController` for the active BFF streaming request.
When the user clicks `Stop generation`, the UI aborts that request, cleans up
local streaming state, and records a cancelled activity row.

The BFF passes the incoming `Request.signal` into the Hermes client. The Hermes
client links that signal to the upstream session-stream fetch, so client aborts
can close the BFF-to-Hermes request when the runtime supports abortable fetch
streams.

The UI also distinguishes intentional abort from a network error. A user stop
does not create a red Hermes stream error and does not expose raw `AbortError`
details.

## UI Behavior

During active generation:

- the composer action changes from `Send message` to `Stop generation`;
- the stop button is enabled and uses the existing light circular action style;
- clicking stop disables duplicate stop clicks while the abort settles;
- the composer returns to `Send message` after cleanup;
- the user can type another message after stop.

If partial assistant text already arrived, that partial text remains in the
assistant message and is marked complete with references:

- `Stopped by user`
- `Client-side stream abort`

If no assistant text arrived, the assistant placeholder becomes:

```text
Stopped before Hermes returned assistant text.
```

## Activity Behavior

Stopping appends a live `AgentActivityEvent`:

```ts
{
  type: "status",
  status: "cancelled",
  title: "Stopped",
  summary: "Generation stopped by user",
  source: "ui",
  details: {
    stopStrategy: "client_stream_abort",
    serverSideRunStop: false
  }
}
```

An elapsed marker is also appended when safe start/end timestamps are available.

This is intentionally a UI/client-stream cancellation marker, not a claim that
Hermes `/v1/runs/{run_id}/stop` was called.

## BFF Abort Behavior

`apps/web/src/app/api/hermes/chat/stream/route.ts` passes `request.signal` into
`streamHermesSessionChat`.

`packages/hermes-client/src/index.ts` links that signal to:

- the capability preflight;
- session ensure/create;
- the upstream `/api/sessions/{id}/chat/stream` fetch;
- normalized upstream SSE reading.

Abort errors caused by an intentional client stop are closed quietly. Unexpected
stream failures still emit the existing normalized network error.

## Smoke Command

Default non-mutating smoke remains:

```text
npm run smoke:ui
```

Optional live send remains:

```text
npm run smoke:ui:send
```

New optional live stop smoke:

```text
npm run smoke:ui:stop
```

The stop smoke requires live Hermes. It sends a longer prompt, waits for the
enabled `Stop generation` control, clicks it, verifies the stopped activity row,
checks that the assistant message is not marked as a red error, and confirms the
composer can type another sendable message after stop.

## Limitations

- This is not server-side `/v1/runs/{run_id}/stop`.
- The current session-stream run id is not treated as a durable run-stop id.
- If Hermes or the platform does not interrupt work on client disconnect, the
  UI can only guarantee that the browser/BFF stream was aborted and local
  generation state was cleaned up.
- Full run-native cancellation still needs a BFF run submission/events path.

## Future Hermes-Native Run Stop Plan

A future run-backed slice should:

1. submit chat work through `/v1/runs`;
2. store the returned durable `run_id`;
3. stream `/v1/runs/{run_id}/events`;
4. call a BFF route that invokes `/v1/runs/{run_id}/stop`;
5. reconcile final `run.cancelled`, `run.failed`, or terminal status events;
6. update the UI marker from client abort to server-confirmed stop.

Slice 16A update:

`docs/architecture/HERMES_RUNS_MIGRATION_ASSESSMENT_16A.md` confirms that
Hermes Runs API exposes `POST /v1/runs/{run_id}/stop`, but recommends not
switching the production chat path yet. Server-side stop should be introduced
only after a BFF-owned Runs path proves send, event, Brain Memory scope, and
status reconciliation parity. Until then, the current Studio stop behavior
remains client/BFF stream abort and must keep reporting
`serverSideRunStop: false`.

## Boundaries Confirmed

No Brain Memory BFF logic changed.

No memory scope bridge behavior or stable project/session keys changed.

No memory mutation/admin action was added.

No direct storage access was added.

No auth/classification, provider/model selector, approvals, files/artifacts, or
Hermes source changes were made.

## Next Recommended Slice

Slice 13H: approvals UX.

Reason: stop now has an honest MVP behavior on the session-stream path. The
next orchestration gap advertised by Hermes but not implemented in the UI is
approval request/response handling, which should be added through BFF-mediated
routes only after the request/response surface is made explicit.
