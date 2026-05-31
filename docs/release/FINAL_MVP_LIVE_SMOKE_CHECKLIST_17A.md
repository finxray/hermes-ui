# Final MVP Live Smoke Checklist 17A

Date: 2026-05-31

## Purpose

This checklist is the final MVP smoke matrix for Hermes UI / Brain Memory
Studio. It separates safe default non-live checks from browser checks and
optional live Hermes/Brain Memory checks.

Do not claim live behavior unless the matching live check was run against a
healthy selected Web UI base URL and intentionally live services.

## Default Non-Live Checks

Run these from the repository root. They do not require a healthy Web UI server
or live Hermes/Brain Memory services.

```powershell
npm run release:check
npm run check:packaging
npm run check:studio-launch
npm run check:brain-memory-regression-index
npm run check:hermes-runs-bff-request
npm run check:hermes-runs-bff-events
npm run check:hermes-runs-lifecycle
npm run check:agent-access-policy
npm run check:ui-structure
npm run typecheck
npm run build
npm audit --audit-level=moderate
```

Default non-live checks confirm:

- packaging/readiness docs are in place;
- release checks pass;
- Brain Memory read-only guardrails remain intact;
- session stream remains the production chat path;
- Runs production remains deferred and guarded;
- no Agent access selector UI or approval buttons are exposed;
- no memory mutation/admin UI is exposed;
- export/import remains deferred;
- typecheck, build, and audit pass.

## Browser Checks With Healthy Selected Web UI

First select exactly one healthy Web UI base URL:

```powershell
npm run studio:launch -- --check --base-url http://127.0.0.1:<port>
```

Then use the same selected URL for all browser checks:

```powershell
npm run smoke:mvp -- --base-url http://127.0.0.1:<port>
npm run smoke:ui -- --base-url http://127.0.0.1:<port>
npm run smoke:ui:send -- --base-url http://127.0.0.1:<port>
npm run smoke:ui:stop -- --base-url http://127.0.0.1:<port>
npm run smoke:markdown -- --base-url http://127.0.0.1:<port>
npm run smoke:markdown:long -- --base-url http://127.0.0.1:<port>
npm run smoke:memory-detail -- --base-url http://127.0.0.1:<port>
npm run smoke:long-session -- --base-url http://127.0.0.1:<port>
npm run smoke:sidebar:large -- --base-url http://127.0.0.1:<port>
npm run smoke:artifacts-tools:large -- --base-url http://127.0.0.1:<port>
```

Notes:

- `smoke:ui:send` and `smoke:ui:stop` require live Hermes.
- `smoke:memory-detail`, markdown, long-session, sidebar-large, and
  artifacts/tools-large are deterministic fixture/measurement checks.
- Browser smoke claims must name the selected base URL.
- Do not use stale or broken local servers for browser claims.

## Live Hermes And Brain Memory Checks

Run these only when the selected Web UI server is healthy and the relevant
services are intentionally live and configured.

```powershell
node scripts/mvp-smoke.mjs --require-hermes --base-url http://127.0.0.1:<port>
node scripts/mvp-smoke.mjs --require-brain-memory --base-url http://127.0.0.1:<port>
node scripts/mvp-smoke.mjs --require-hermes --require-brain-memory --base-url http://127.0.0.1:<port>
npm run smoke:ui:memory-live -- --base-url http://127.0.0.1:<port>
npm run smoke:ui:memory-scope -- --base-url http://127.0.0.1:<port>
```

Live Hermes checks prove:

- `/api/hermes/status` reports real/reachable through the BFF;
- `/api/hermes/chat/stream` emits assistant content and completion events;
- browser send and stop work through the current session-stream path.

Live Brain Memory checks prove:

- Brain Memory Gateway is real/reachable through the BFF;
- tenant-bound read key posture is valid without printing secrets;
- read-only search and inspect work through BFF routes;
- live timeline and scope-isolation behavior are intact.

If Hermes or Brain Memory is absent, record `not running`, `unconfigured`, or
`blocked by env`. Do not fake a live pass.

## Runs Experimental Checks, Optional/Post-MVP

Runs work is parked post-MVP unless explicitly resumed. These checks remain
useful as optional regression coverage, but they do not make Runs the MVP
production path.

```powershell
npm run smoke:hermes:runs
npm run smoke:hermes:runs:memory
npm run smoke:hermes:runs:approval
npm run smoke:hermes:runs:route-guard
npm run check:hermes-runs-bff-request
npm run check:hermes-runs-bff-events
npm run check:hermes-runs-lifecycle
```

Required Runs MVP posture:

- production chat still uses `/api/hermes/chat/stream`;
- `POST /api/hermes/runs/chat/stream` remains disabled HTTP 501;
- production Runs implementation remains deferred;
- no production Runs composer switch exists;
- no Agent access selector UI exists;
- no approval buttons exist.

## Manual Pass/Fail Recording

For each run, record:

- selected Web UI base URL;
- current commit;
- whether Web UI was healthy;
- whether Hermes was real/reachable;
- whether Brain Memory Gateway was real/reachable;
- default non-live check result;
- browser check result;
- live Hermes result or skipped reason;
- live Brain Memory result or skipped reason;
- remaining blockers.

## MVP Recommendation Rule

- **Complete**: default non-live checks, browser checks, and intentionally
  required live checks pass.
- **Conditionally complete**: default non-live checks pass, browser/live checks
  are unavailable or partially run, and skipped live evidence is honestly
  documented.
- **Not complete**: source/build/audit checks fail, selected Web UI cannot be
  verified for browser claims, or a required live service gate fails.
