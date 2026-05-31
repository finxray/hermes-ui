# Private Developer Handoff 17D

Audience: a private developer or reviewer receiving the Hermes UI / Brain
Memory Studio local/demo MVP RC.

This guide is for private technical handoff only. It is not public release
copy, not a production install guide, and not a promise that live Brain Memory
or production Runs is enabled in every checkout.

## Prerequisites

- Node/npm available; the verified local run used Node `v24.15.0` and npm
  `11.12.1`.
- Repository checked out at or after
  `8dc2332 docs: record comprehensive MVP E2E verification`.
- PowerShell on Windows for the documented command path.
- Hermes already running if live chat smokes are required.
- Brain Memory Gateway already running and BFF env/key posture configured only
  if live Brain Memory read-only claims are required.
- No secrets committed or pasted into docs/logs.

## Clone, Install, Start

From the repo root:

```powershell
npm install
npm run studio:launch -- --check
npm run studio:web -- --port 3002 --open
```

In another terminal, verify the selected server:

```powershell
npm run studio:launch -- --check --base-url http://127.0.0.1:3002
```

If `3000` is already healthy, it is acceptable to use
`http://127.0.0.1:3000` consistently. If `3000` is stale or confusing, use
`3002` and pass that same base URL to every smoke command.

## First Smoke Run

Run the safe non-browser gate:

```powershell
npm run release:check
```

Then run browser smoke against the selected healthy URL:

```powershell
npm run smoke:ui -- --base-url http://127.0.0.1:3002
npm run smoke:mvp -- --base-url http://127.0.0.1:3002
```

Record failures exactly. Do not convert failed required checks into warnings.

## Attach Hermes

Hermes is external to this repo. The expected local URL is:

```text
http://127.0.0.1:8642
```

When Hermes is intentionally running, verify through the Web UI BFF:

```powershell
npm run studio:launch -- --check --base-url http://127.0.0.1:3002
npm run smoke:ui:send -- --base-url http://127.0.0.1:3002
npm run smoke:ui:stop -- --base-url http://127.0.0.1:3002
node scripts/mvp-smoke.mjs --require-hermes --base-url http://127.0.0.1:3002
```

If Hermes is absent, record it as not running or unconfigured. Do not fake a
live Hermes pass.

## Attach Brain Memory Later

Brain Memory Gateway is optional for the default local MVP. Mock, disabled, or
unconfigured Brain Memory is acceptable when documented honestly.

Live Brain Memory requires all of the following:

- Gateway reachable, usually at `http://127.0.0.1:8080`;
- Web UI BFF configured for real Gateway mode;
- tenant-bound memory read key configured server-side;
- selected Web UI base URL verified healthy;
- live read-only checks passing through the BFF.

Follow `docs/product/BRAIN_MEMORY_READ_ONLY_QA_GATE_15L.md` before claiming
live read-only Brain Memory behavior. Do not call Brain Memory storage
directly from this UI and do not pass API keys to browser JavaScript.

## What To Test Manually

- Production root `/` loads at the selected base URL.
- Old green UI is absent.
- Project/session sidebar is visible at desktop width.
- Recent chat/session selection works.
- Composer is visible.
- Live send works only when Hermes is configured.
- Stop/cancel works through the current session-stream abort path.
- Right rail Context, Memory, Tools, and Files tabs are visible and usable.
- Settings popover is available.
- Markdown headings, lists, links, tables, code blocks, and copy controls work.
- No horizontal overflow appears at desktop and common narrow widths.
- Brain Memory status is honestly labelled as mock/unconfigured or live.

## How To Report Issues

Include:

- commit hash and branch;
- selected Web UI base URL;
- exact command run;
- full pass/fail summary;
- whether Hermes was running;
- whether Brain Memory Gateway was configured through the Web UI BFF;
- whether the browser was on `/` or a design fixture route;
- any launcher warnings about stale servers or static chunks.

Do not include API keys, bearer tokens, `.env.local`, screenshots containing
secrets, or raw service credentials.

## Safe To Modify

For small private handoff fixes, safe areas are usually:

- docs and runbooks;
- non-runtime smoke/check wording;
- README links;
- release checklist wording;
- fixture docs that do not change production behavior.

Code changes should preserve the BFF boundary and the current MVP execution
path unless a later slice explicitly authorizes the change.

## Do Not Touch In This RC

- direct browser-to-Hermes paths;
- direct browser-to-Brain-Memory paths;
- direct storage access;
- memory mutation/admin controls;
- production Runs default;
- approval action buttons/routes;
- Agent access selector UI;
- provider/model runtime switching;
- artifact upload/download;
- export/import runtime;
- secrets or env files;
- Hermes source;
- Brain Memory source.

## Troubleshooting Pointers

- Start with `npm run studio:launch -- --check --verbose`.
- Use `npm run studio:launch -- --check --print-recovery-plan` for print-only
  recovery guidance.
- Read `docs/runbooks/HEALTHY_STUDIO_SERVER_RECOVERY.md` for stale server and
  stale chunk diagnostics.
- Read `docs/runbooks/MVP_LOCAL_LAUNCH_RUNBOOK.md` for the broader local
  launch flow.
- Use one healthy selected base URL for all browser smokes.
- If a live service is absent, document it as absent rather than claiming pass.

## Current Decision

The current recommendation remains MVP complete with known limitations for a
local/demo RC. Production chat still uses `/api/hermes/chat/stream`; production
Runs, export/import, memory mutation/admin UI, approval actions, provider/model
runtime switching, artifact upload/download, production installer, and final
one-command package remain deferred.
