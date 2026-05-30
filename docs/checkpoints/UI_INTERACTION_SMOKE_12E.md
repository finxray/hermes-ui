# UI Interaction Smoke 12E

Date: 2026-05-30

## Purpose

Slice 12E adds a browser-level regression harness for the MVP shell. It covers
the interaction contract captured in `docs/product/UI_INTERACTION_CONTRACT_12D.md`
without adding product features or changing backend behavior.

## Tool Chosen

The harness uses Playwright from a plain Node script:

```text
scripts/ui-interaction-smoke.mjs
```

This avoids a larger test-runner setup while still driving a real browser.
The script first tries the installed Microsoft Edge channel, then falls back to
Playwright's default Chromium installation.

## Commands

Default:

```text
npm run smoke:ui
```

Custom server:

```text
npm run smoke:ui -- --base-url http://127.0.0.1:3100
```

Headed/debug:

```text
npm run smoke:ui:headed
```

JSON output:

```text
npm run smoke:ui -- --json
```

Optional live send:

```text
npm run smoke:ui:send
```

Headed optional live send:

```text
npm run smoke:ui:send:headed
```

Optional live stop:

```text
npm run smoke:ui:stop
```

Headed optional live stop:

```text
npm run smoke:ui:stop:headed
```

The default run does not click Send, so it does not require live Hermes. The
live send run passes `--send-test --require-hermes`; it requires the Web UI BFF
Hermes status route to report `mode=real` and `reachable=true` before it sends
one real composer message. The live stop run passes
`--send-test --stop-test --require-hermes`; it sends a longer live message,
clicks `Stop generation`, verifies a stopped/cancelled activity row, and checks
the composer can type another sendable message afterward.

## Interactions Covered

- Root app loads at `/`.
- Brain Memory Studio title/text is visible.
- Old green UI markers are absent.
- No horizontal overflow is present at desktop smoke width.
- Project/session sidebar is visible.
- Project row accepts a safe click.
- Child session row becomes active.
- Recent chat row becomes active.
- Left rail collapses and expands.
- Right rail collapses and expands.
- Settings popover opens and closes with Escape.
- Right rail `Context`, `Memory`, `Tools`, and `Files` controls switch active panels.
- Composer typing enables the Send button.
- Optional live-send mode clicks Send, renders a unique user smoke message,
  waits for a new assistant message, requires non-empty assistant content, and
  verifies `/api/hermes/chat/stream` returned HTTP 200.
- Optional live-stop mode clicks Send, waits for the enabled `Stop generation`
  button, clicks Stop, verifies the composer returns to Send state, verifies
  `Stopped` / `Generation stopped by user` activity, and checks the stopped
  assistant message is not marked as a red error.
- Deferred top menu placeholders remain disabled and labelled coming soon.
- Deferred composer controls remain disabled and honestly labelled.
- Stop response placeholder is not exposed outside generation state.
- Serious browser console/page errors and unexpected HTTP errors are captured.

## Accessibility/Test Target Changes

- Left and right rail controls now use real `button` elements with the existing
  `aria-label`, `aria-pressed`, and `title` state instead of label forwarding to
  hidden checkboxes. The underlying shell checkbox/state path remains unchanged.
- No `data-testid` attributes were added; existing ARIA labels and structural
  landmarks were sufficient for the harness.

## Interactions Not Covered

- Default mode does not send a message to Hermes.
- Default mode does not require live Brain Memory Gateway search/detail.
- Live-send mode does not require Brain Memory Gateway.
- Default mode does not exercise real stop/cancel streaming.
- Live-stop mode validates client/BFF stream abort behavior, not server-side
  `/v1/runs/{run_id}/stop`.
- The harness does not stress-test high-token streaming throughput.
- The harness does not validate mobile layouts.

## Default Behavior

The script expects a Web UI server to be running at:

```text
http://127.0.0.1:3000
```

It exits nonzero on true interaction failures. It prints `[ok]`, `[--]`, and
`[!!]` lines and never prints API keys or environment secrets.

The harness creates a fresh Playwright browser context for each run. This keeps
localStorage/sessionStorage/cookies isolated from the user's existing browser
profile and avoids polluting the in-app browser session.

## Known Limitations

- A generic browser `404` resource console line is ignored as harmless local
  static/favicon noise.
- Dev-server HMR websocket noise is ignored because it is not a product runtime
  interaction failure.
- The project row check verifies a safe click. Session/chat row checks verify
  active state because project selection may immediately select a child session.
- If Playwright cannot find Edge or a Chromium browser, run `npx playwright install chromium`.

## How To Use Before UI Changes

Before changing MVP shell interactions:

```text
npm run smoke:ui
npm run smoke:mvp
```

Use `npm run smoke:ui:headed` when debugging a browser-only regression.

When Hermes is intentionally live and reachable, add:

```text
npm run smoke:ui:send
npm run smoke:ui:stop
```

Use the live send gate before changing composer send behavior, BFF stream route
plumbing, or UI transcript rendering. Use the live stop gate before changing
composer stop behavior, abort propagation, or cancelled activity rendering.
