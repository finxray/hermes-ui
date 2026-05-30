# Live Send Smoke 12G

Date: 2026-05-30

## Purpose

Slice 12G adds an optional launch-readiness gate for real composer send
behavior. The existing browser smoke remains safe by default and does not send
messages. The new gate is explicit because it sends one real message through the
Web UI BFF to Hermes.

## Starting State

- Working tree at slice start: clean.
- Base commit at slice start: `c5d7b44 docs: add MVP local launch runbook`.
- `--send-test` already existed in `scripts/ui-interaction-smoke.mjs`, but it
  only clicked Send and verified the user message rendered.

## What Changed

- Added `--require-hermes` support to the UI interaction smoke harness.
- Hardened `--send-test` into a live Hermes composer send gate.
- Added named npm scripts for the optional gate:
  - `npm run smoke:ui:send`
  - `npm run smoke:ui:send:headed`
- Added unexpected HTTP error capture to the browser smoke.
- Switched the harness to a fresh Playwright browser context per run so browser
  storage is isolated from the user's profile.

## Commands

Default non-sending UI smoke:

```powershell
npm run smoke:ui
```

Opt-in live send smoke:

```powershell
npm run smoke:ui:send
```

Headed opt-in live send smoke:

```powershell
npm run smoke:ui:send:headed
```

Equivalent direct invocation:

```powershell
node scripts/ui-interaction-smoke.mjs --send-test --require-hermes
```

## Required Preconditions

The Web UI server must be running at the selected base URL, defaulting to:

```text
http://127.0.0.1:3000
```

Hermes must be enabled through the Web UI BFF. The harness checks:

```text
GET /api/hermes/status
```

Live send proceeds only when that route reports:

```text
mode=real
reachable=true
```

If Hermes is mock, disabled, unreachable, or misconfigured, the live-send gate
fails honestly before sending a message.

## Verification Behavior

The live send gate:

- loads `/`;
- verifies the existing MVP shell interactions;
- types a unique message like `UI_SMOKE_SEND_<timestamp> please reply with
  UI_SMOKE_SEND_OK.`;
- clicks the accessible `Send message` button;
- verifies the unique user message rendered in the transcript;
- waits up to 60 seconds for a new assistant message;
- requires non-empty assistant content;
- passes the marker check when `UI_SMOKE_SEND_OK` appears in the assistant
  response;
- accepts non-empty assistant content with a warning if the marker is absent;
- verifies `/api/hermes/chat/stream` returned a non-error HTTP status.

## Storage Isolation

The harness launches a new Playwright browser context for each run. This keeps
localStorage, sessionStorage, and cookies isolated from the user's real browser
profile and from the in-app browser session at `http://127.0.0.1:3000/`.

The smoke may still create a normal Hermes-side conversation event because it
intentionally sends one real message to Hermes.

## Verification Results

Run on 2026-05-30:

| Command | Result |
| --- | --- |
| `npm run smoke:ui:send` | Passed: 46 passed, 0 warnings, 0 failed. |
| `npm run smoke:ui` | Passed: 39 passed, 1 expected warning, 0 failed. |
| `npm run smoke:mvp` | Passed: 26 passed, 2 expected warnings, 0 failed. |
| `npm run check:workspace-state` | Passed. |
| `npm run check:brain-memory-client` | Passed. |
| `npm run studio:doctor` | Passed local checks; Hermes real/reachable; Brain Memory mock. |
| `npm run check:ui-structure` | Passed. |
| `npm run typecheck` | Passed. |
| `npm run build` | Passed. |
| `npm audit --audit-level=moderate` | Passed: 0 vulnerabilities. |

The live send run observed:

```text
GET /api/hermes/status: mode=real, reachable=true
/api/hermes/chat/stream: HTTP 200
assistant response: UI_SMOKE_SEND_OK
```

## Known Limitations

- The gate verifies one simple browser-driven send, not high-throughput stress.
- It does not validate stop/cancel behavior; real stop/cancel streaming remains
  deferred.
- It does not require Brain Memory Gateway.
- It does not validate memory mutation/admin actions.
- It does not test mobile layout.
- It relies on Hermes honoring a simple marker instruction for the strongest
  marker check; non-empty assistant content is accepted with a warning if the
  marker is absent.

## Boundaries Preserved

- No Hermes streaming logic changed.
- No Brain Memory BFF logic changed.
- No memory scope bridge logic changed.
- No project/session stable key logic changed.
- No direct browser-to-Hermes calls added.
- No direct browser-to-Brain-Memory-Gateway calls added.
- No direct storage access added.
- No auth/classification implementation added.
- No memory mutation/admin actions added.
- No visual design changes made.

## Next Recommended Slice

Slice 12H: tighten the MVP smoke stream-route probe so it no longer reports a
timeout warning when Hermes is live but the generic probe cannot complete under
its current timeout semantics, without changing production streaming behavior.
