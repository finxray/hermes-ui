# MVP Local RC Release Notes 17D

Release name suggestion: `v0.1.0-local-rc.1`
Product: Hermes UI / Brain Memory Studio
Release posture: local/demo RC and private technical handoff only
Prepared: 2026-05-31T21:18:52+04:00
Source commit: `8dc2332 docs: record comprehensive MVP E2E verification`
Branch at preparation: `master`

## Summary

Brain Memory Studio is ready for a local/demo MVP release candidate with known
limitations. The current product provides a local ChatGPT-like workspace for
Hermes Agent with a Codex-style shell, project/session navigation, BFF-mediated
Hermes chat streaming, read-only Brain Memory inspection foundations, activity
blocks, markdown rendering, launcher diagnostics, and release checks.

This is not production-ready, not a public beta, not a production installer,
and not the final one-command GitHub package. It is suitable for local/demo RC
use or private technical handoff only.

## Current Verification

Slice 17C recorded the comprehensive E2E baseline:

- selected Web UI URL: `http://127.0.0.1:3002`;
- release checks passed;
- browser smokes passed;
- live Hermes send/stop checks passed;
- optional Runs guard/probe checks passed;
- Brain Memory Gateway direct health/ready was reachable, but live Brain
  Memory search/detail was not claimed because the Web UI BFF was
  mock/unconfigured for Brain Memory.

See `docs/release/MVP_COMPREHENSIVE_E2E_17C.md`.

## What Works

- Local Next.js Web UI and BFF routes.
- Codex-style production root shell.
- Project/session sidebar, recent chats, stable local project/session keys,
  and local session replay foundations.
- Hermes status and chat streaming through the server-side Web UI BFF.
- Current stop/cancel behavior through session-stream abort.
- Rich markdown rendering, tables, code blocks, copy controls, and long-message
  fixture coverage.
- Agent activity blocks for tool, command, memory, run/status, approval
  display, elapsed, stopped, and error events.
- Brain Memory read-only status/search/detail surfaces through BFF routes,
  with honest mock/unconfigured fallback.
- Brain Memory memory-detail fixture with evidence, supersession, and audit
  not-implemented states.
- Local run history, persisted activity replay summaries, and local export
  preview foundation.
- Launcher, doctor, stale-server diagnostics, selected-base URL guidance, and
  safe release checks.
- Disabled production-shaped Runs route guard and diagnostic Runs probes.

## How To Run Locally

Install dependencies:

```powershell
npm install
```

Start only the Web UI on the recommended recovery port:

```powershell
npm run studio:web -- --port 3002 --open
```

Verify the selected Web UI server:

```powershell
npm run studio:launch -- --check --base-url http://127.0.0.1:3002
```

Run the safe non-browser release gate:

```powershell
npm run release:check
```

Run browser smokes after the selected server is healthy:

```powershell
npm run smoke:ui -- --base-url http://127.0.0.1:3002
npm run smoke:mvp -- --base-url http://127.0.0.1:3002
npm run smoke:markdown -- --base-url http://127.0.0.1:3002
npm run smoke:markdown:long -- --base-url http://127.0.0.1:3002
npm run smoke:memory-detail -- --base-url http://127.0.0.1:3002
```

Run live Hermes smokes only when Hermes is intentionally running and configured:

```powershell
npm run smoke:ui:send -- --base-url http://127.0.0.1:3002
npm run smoke:ui:stop -- --base-url http://127.0.0.1:3002
node scripts/mvp-smoke.mjs --require-hermes --base-url http://127.0.0.1:3002
```

## Supported Modes

| Mode | Support level | Notes |
| --- | --- | --- |
| Web UI local/demo with mock Brain Memory | Supported | Brain Memory may honestly report mock, disabled, or unconfigured. |
| Web UI + Hermes live | Supported when Hermes is already running | Browser still calls only the Web UI BFF. Hermes is expected at `http://127.0.0.1:8642` unless env overrides it. |
| Brain Memory attach-later | Manual supported path | Gateway is optional and usually expected at `http://127.0.0.1:8080` when live; live claims require BFF env and tenant-bound read key posture. |
| Runs diagnostics/guarded experimental | Post-MVP only | Diagnostic probes and disabled route guards exist; production chat still uses the session stream. |

## Safety Boundaries

- Browser code calls only the Web UI BFF.
- Hermes remains the agent runtime.
- Brain Memory Gateway remains the memory authority.
- Brain Memory storage is not accessed directly by the Web UI.
- API keys and local env values must stay server-side and must not be printed.
- Brain Memory UI remains read-only for MVP.
- Production chat still uses `/api/hermes/chat/stream`.
- Production Runs remains deferred/post-MVP.

## Known Limitations

- Live Brain Memory search/detail is not claimable unless the Web UI BFF is
  configured for real Gateway mode with the required tenant-bound read key and
  the live gates pass.
- Stop/cancel is current session-stream abort, not server-side production Runs
  stop.
- Approval rows are display-only; no approve/deny action route exists.
- Files/artifacts are local/mock foundations only.
- Provider/model runtime switching is disabled/server-configured.
- Export preview is local display-only; export/import is deferred.
- This RC has no production installer or final one-command GitHub package.

## Deferred Features

- full auth/classification model;
- production one-command CLI;
- durable evidence/supersession/audit storage;
- memory mutation/admin actions;
- real server-side stop/cancel through production Runs;
- provider/model selector polish and runtime switching;
- artifact upload/download;
- export/import;
- production Runs default;
- Agent access selector UI;
- approval action buttons/routes;
- context compaction runtime;
- scalable progressive loading runtime;
- further UI polish.

## What Must Not Be Claimed Yet

Do not describe this RC as:

- production-ready;
- a public beta;
- a production installer;
- a managed Hermes installer;
- a managed Brain Memory installer;
- a final one-command GitHub package;
- a product with durable export/import;
- a product with memory mutation/admin UI;
- a product whose production chat path is Runs;
- a product with direct browser-to-Hermes, direct browser-to-Brain-Memory, or
  direct storage access.

## Recommended Handoff Reading

- `docs/packaging/LOCAL_HANDOFF_MANIFEST_17D.md`
- `docs/release/PRIVATE_DEVELOPER_HANDOFF_17D.md`
- `docs/release/MVP_COMPREHENSIVE_E2E_17C.md`
- `docs/release/MVP_RC_NOTES.md`
- `docs/release/MANUAL_RC_CHECKLIST.md`
