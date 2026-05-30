# UI Smoke Regression 13H-R

Date: 2026-05-30

## Failure Reproduced

After Slice 13H, the browser UI smoke suite failed before composer send:

- `npm run smoke:ui`
- `npm run smoke:ui:send`
- `npm run smoke:ui:stop`

The repeated failure path was:

- `sidebar-new-chat` reported an empty active child row label.
- `left-rail-collapse` expected `data-left-collapsed="true"` but observed
  `false`.
- The script then timed out waiting for the `Open left sidebar` button.

The same failure happened in live send and live stop modes before any Hermes
message was sent.

## Root Cause

The running production `next start` process on port 3000 was stale after a
build rewrote `.next`.

The server still returned HTTP 200 for `/`, but the HTML referenced old
`/_next/static/chunks/...` asset names that no longer existed in
`apps/web/.next/static/chunks`. Browser probes showed HTTP 500 responses for
Next static CSS/JS chunks. The page was server-rendered but not hydrated, so
React click handlers were not attached.

That made project/session rows, the Chat quick action, and rail toggles appear
visible while remaining inert.

## UI Or Harness

The product UI source behavior was not the root cause. Once the stale server was
restarted from the current build:

- new chat creation worked;
- the active child row had a non-empty `New chat` label;
- the active chat heading became `New chat`;
- left rail collapse changed `data-left-collapsed` from `false` to `true`;
- the left toggle label changed from `Collapse left sidebar` to
  `Open left sidebar`;
- right rail collapse changed `data-right-collapsed` from `false` to `true`.

The smoke harness was improved because its previous failure output hid the
actual hydration problem behind later click assertions.

## Fix Applied

`scripts/ui-interaction-smoke.mjs` now:

- records failed `/_next/static/` asset responses separately;
- fails fast with a `static-assets-loaded` check when Next chunks do not load;
- avoids continuing into misleading interaction assertions when the app is not
  hydrated;
- checks that the new-chat active row has a non-empty label;
- keeps a separate default-title assertion for the `New chat` lifecycle before
  the first user message.

The stale server was restarted after `npm run build` so port 3000 served the
current `.next` assets.

## Files Changed

- `scripts/ui-interaction-smoke.mjs`
- `docs/checkpoints/UI_INTERACTION_SMOKE_12E.md`
- `docs/checkpoints/UI_SMOKE_REGRESSION_13H_R.md`

No application component, Hermes streaming, Brain Memory BFF, memory scope, or
project/session stable-key logic changed in this repair slice.

## Checks Run

Green after restart:

- `npm run smoke:ui`
- `npm run smoke:ui:send`
- `npm run smoke:ui:stop`
- `npm run smoke:mvp`
- `npm run check:agent-activity`
- `npm run check:agent-activity-rendering`
- `npm run check:workspace-state`
- `npm run check:brain-memory-client`
- `npm run studio:doctor`
- `npm run check:ui-structure`
- `npm run typecheck`
- `npm run build`
- `npm audit --audit-level=moderate`

Manual in-app browser verification also confirmed the root page, new chat,
left rail toggle, right rail toggle, composer, right rail, settings, and no
horizontal overflow.

## Remaining Limitations

- The smoke suite assumes an already running Web UI server at
  `http://127.0.0.1:3000`.
- The harness now detects stale static assets but does not restart the server
  automatically.
- The live send and stop smokes require Hermes to be real and reachable.
- Brain Memory Gateway can remain mock/unconfigured for this UI smoke.
