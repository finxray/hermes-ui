# MVP Smoke Harness 12B

Date: 2026-05-30

## Purpose

Slice 12B adds a lightweight MVP regression smoke harness for the Slice 12A
checkpoint. It is designed to catch accidental breakage in MVP-critical routes,
source-level UI accessibility targets, BFF boundaries, and live-service posture
without introducing browser automation dependencies.

The harness lives at:

```text
scripts/mvp-smoke.mjs
```

Root package scripts:

```text
npm run smoke:mvp
npm run smoke:mvp:live
```

## What It Checks

Source-level UI smoke:

- required shell/composer files exist,
- left and right rail toggle labels are present,
- current Workspace top menu label is present,
- deferred top menu sections are disabled and labelled as coming soon,
- settings control has a deterministic accessible label,
- settings popover keeps an accessible dialog label,
- right rail panel tabs expose deterministic accessible labels,
- composer textarea and send button have accessible labels,
- deferred composer controls are disabled and labelled as placeholders,
- stop/cancel remains explicitly documented as deferred.

Route/BFF smoke:

- `GET /`,
- root document title,
- absence of old green UI markers in root HTML,
- `GET /design/codex-shell` if still present,
- `GET /api/hermes/status`,
- `GET /api/brain-memory/status`,
- safe `POST /api/brain-memory/search`,
- safe `POST /api/brain-memory/memory/inspect`,
- optional `POST /api/hermes/chat/stream` when Hermes BFF status reports
  real/reachable.

The script uses Node built-ins only.

## Default Mode

Command:

```text
npm run smoke:mvp
```

Default mode expects the Web UI server to be running, usually at:

```text
http://127.0.0.1:3000
```

It does not require live Brain Memory Gateway. Mock/unconfigured Brain Memory
status is accepted as a warning.

It does not require Hermes to be live, but if `/api/hermes/status` reports
`mode: real` and `reachable: true`, the script safely verifies the BFF stream
route with a simple `OK` prompt.

Default mode exits `0` when there are passes and warnings but no failures.

## Live Hermes Mode

Command:

```text
node scripts/mvp-smoke.mjs --require-hermes
```

Behavior:

- `/api/hermes/status` must report real/reachable.
- `/api/hermes/chat/stream` must emit assistant content and a done event.
- Missing or unreachable Hermes becomes a failure instead of a warning.

No browser-to-Hermes calls are made; the script only calls the Web UI BFF.

## Live Brain Memory Mode

Command:

```text
node scripts/mvp-smoke.mjs --require-brain-memory
```

Behavior:

- `/api/brain-memory/status` must report real/reachable.
- search must return a live `mode: "real"` response.
- inspect uses the first search result id when search returns a result; if search
  is live but empty, inspect uses a harmless nonexistent id to verify safe
  Gateway normalization.
- 401 and 403 responses are reported as auth/tenant failures without printing
  secrets.
- Mock/unconfigured Brain Memory becomes a failure instead of a warning.

No browser-to-Gateway calls are made; the script only calls the Web UI BFF.

## Combined Live Mode

Command:

```text
npm run smoke:mvp:live
```

This requires both Hermes and Brain Memory Gateway to be live/reachable through
the Web UI BFF. It is intended for bundle-ready or release-candidate checks, not
for normal web-ui-only development.

## CLI Options

```text
node scripts/mvp-smoke.mjs --base-url http://127.0.0.1:3000
node scripts/mvp-smoke.mjs --json
node scripts/mvp-smoke.mjs --verbose
node scripts/mvp-smoke.mjs --require-hermes
node scripts/mvp-smoke.mjs --require-brain-memory
```

The script never prints API keys. Verbose JSON bodies are sanitized before being
attached to report details.

## Pass/Fail Semantics

- `pass`: MVP behavior or source target is present.
- `warn`: optional live service is unavailable or optional design route is not
  present.
- `fail`: required route/source behavior is missing, a required live service is
  unavailable, or a normalized route shape regressed.

Exit code:

- `0`: no failures.
- nonzero: one or more failures.

## Manual Browser Checklist

Browser automation is intentionally not added in this slice because no
lightweight browser automation dependency is currently present.

Manual smoke checklist:

- Open `http://127.0.0.1:3000/`.
- Confirm the app loads as Brain Memory Studio.
- Confirm the old green UI is gone.
- Confirm project/session sidebar is visible.
- Confirm composer textarea is visible.
- Confirm typing into the composer enables the send button.
- Confirm the right rail is visible.
- Confirm `Context`, `Memory`, `Tools`, and `Files` panel tabs switch panels.
- Confirm the settings control opens the settings/connection popover.
- Confirm there is no horizontal page overflow at desktop width.

## Known Limitations

- The harness does not replace a real browser smoke test.
- Composer send behavior is checked through source/accessibility targets and the
  live BFF stream route, not through a browser-driven click.
- Real Brain Memory search/detail is only verified when the UI process is
  configured for a live Gateway.
- Fast-token throughput is not stress-tested here.
- Stop/cancel streaming remains deferred.

## Relation To Slice 12A

Slice 12A documented the MVP baseline. Slice 12B turns the highest-signal parts
of that baseline into a repeatable local smoke command while preserving all
mandatory architecture boundaries:

- browser code still targets the Web UI/BFF,
- Hermes remains the agent runtime,
- Brain Memory Gateway remains the memory authority,
- no direct storage access was added,
- no memory mutation/admin actions were added.
