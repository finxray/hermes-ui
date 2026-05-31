# MVP Completion Audit 17A

Date: 2026-05-31
Current commit at audit start: `6ecea07 test: add disabled Runs response fixtures`

## Purpose

This audit decides whether the current Hermes UI / Brain Memory Studio product
qualifies as MVP-complete for a local/demo release candidate.

This slice does not add runtime product features. It does not implement
production Runs, switch chat to Runs, add Agent access controls, add approval
buttons, add memory mutation/admin UI, implement export/import, implement
provider/model switching, or create a production installer.

## MVP Scope

| Criterion | MVP status | Evidence |
| --- | --- | --- |
| Local Web UI starts | Complete, with manual local startup | `studio:web`, `studio:launch`, launcher docs, packaging docs. |
| Clean ChatGPT/Codex-like shell | Complete | Production root uses the current dark Codex-style shell; old green UI removed. |
| Project/session sidebar | Complete | Local projects, sessions, recent chats, stable keys, and session selection are source/browser-smoke covered. |
| Hermes session-stream chat | Complete when Hermes is running | Production execution path remains `/api/hermes/chat/stream` through the Web UI BFF. |
| Stop/cancel through client/BFF abort | Complete for MVP | Stop aborts the current session stream and records an honest stopped/cancelled activity row. |
| Rich markdown/code rendering | Complete for MVP | Markdown, long markdown, code blocks, tables, links, and copy actions are fixture-smoke covered. |
| Activity blocks | Complete for MVP | `AgentActivityEvent` and `AgentActivityBlock` render status, tools, commands, approvals display, memory, and errors. |
| Command/tool/memory event rendering | Complete for MVP | Command details, memory timeline, tool events, redacted details, and activity rendering checks pass. |
| Brain Memory read-only search/detail/timeline | Complete for MVP default mode | BFF-mediated status/search/inspect, mock/unconfigured fallback, read-only detail fixture, and timeline are covered. |
| Brain Memory live E2E when configured | Conditionally complete | Optional live checks exist; live proof must be run only when Hermes and Gateway are reachable with tenant read keys. |
| Tenant/project/session scope isolation | Complete for MVP checks | Tenant diagnostics, workspace state, and optional live scope smoke exist. |
| Run history and persisted replay summaries | Complete for MVP local history | Local `RunRecord`, persisted replay, and export preview foundation are present; durable backend history is deferred. |
| Launcher/doctor/recovery diagnostics | Complete for MVP | `studio:doctor`, `studio:launch`, `studio:web`, recovery docs, and launcher checks are present. |
| Scalable-loading measurements and decision | Complete for MVP | Measurements and Slice 15S decision defer runtime pagination/virtualization until thresholds are crossed. |
| Runs track safely guarded/deferred | Complete for MVP | Production Runs route is disabled HTTP 501 with fixtures, validation, route guard, and migration gate. |
| Packaging/readiness docs | Complete for local/demo RC | Packaging readiness, local bundle checklist, RC notes, and manual RC checklist exist. |

## Completed Capabilities

- Local Next.js Web UI with a production shell and BFF routes.
- Local project/session state with stable project/session memory keys.
- Hermes status and session-stream chat through the server-side BFF.
- Client/BFF stream abort stop behavior for the current session stream.
- Rich markdown and code rendering with long-content fixture coverage.
- Normalized activity blocks for tool, command, memory, run/status, approval
  display, elapsed, stopped, and error events.
- Brain Memory read-only status/search/inspect through Gateway-approved BFF
  routes, with mock/unconfigured fallback.
- Brain Memory read-only detail fixture for evidence, supersession, and audit
  not-implemented states.
- Brain Memory timeline derived from normalized activity events.
- Tenant/project/session diagnostics and scope-isolation checks.
- Local Run history, persisted activity replay summaries, and local export
  preview foundation.
- Launcher, doctor, stale-server recovery, port diagnostics, and packaging
  readiness docs.
- Scalable-loading measurements for long transcripts, large sidebars, and
  large artifacts/tools fixtures.
- Hermes Runs research, probes, event/request/lifecycle contracts, disabled
  production-shaped route guard, and migration gate.

## Deferred Capabilities

The MVP explicitly does not require:

- production Runs default;
- production Runs implementation;
- Agent access selector UI;
- approval buttons or approval action routes;
- memory mutation/admin UI;
- export/import;
- provider/model runtime switching;
- artifact upload/download;
- automatic context compaction;
- manual context compaction;
- cross-channel discovery;
- durable backend run history;
- durable evidence/supersession/audit storage;
- production installer;
- final one-command GitHub bundle.

## Known Limitations

- Live Hermes behavior is claimable only when Hermes is real/reachable through
  the BFF and live smokes pass.
- Live Brain Memory behavior is claimable only when Hermes, Brain Memory
  Gateway, and the tenant-bound memory read key are intentionally configured
  and live checks pass.
- Brain Memory mock/unconfigured mode remains acceptable for the default local
  MVP path, but it is not live Gateway evidence.
- Stop/cancel is session-stream abort, not server-side `/v1/runs/{run_id}/stop`
  for the production chat path.
- Approval rows are display-only; no approve/deny buttons are included.
- Files/artifacts are local/mock foundations only; real upload/download is not
  implemented.
- Provider/model selector is honest and disabled for runtime switching.
- Export preview is local display-only; durable export/import is deferred.
- Runtime scalable loading is deferred because measured fixtures are acceptable
  for MVP thresholds.
- The package is a local MVP/demo RC, not a production public release.

## Required Checks

Default non-live gate:

- `npm run release:check`
- `npm run check:packaging`
- `npm run check:studio-launch`
- `npm run check:brain-memory-regression-index`
- `npm run check:hermes-runs-bff-request`
- `npm run check:hermes-runs-bff-events`
- `npm run check:hermes-runs-lifecycle`
- `npm run check:agent-access-policy`
- `npm run check:ui-structure`
- `npm run check:workspace-state`
- `npm run check:agent-activity`
- `npm run check:agent-activity-rendering`
- `npm run check:brain-memory-client`
- `npm run check:tenant-scope`
- `npm run typecheck`
- `npm run build`
- `npm audit --audit-level=moderate`

## 17A Verification Result

Result recorded on 2026-05-31:

| Check | Result | Notes |
| --- | --- | --- |
| `git status --short` at start | Pass | Working tree was clean before 17A edits. |
| `npm run release:check` | Pass | Includes packaging, launcher contract, workspace state, Brain Memory client/regression checks, activity checks, message rendering, UI structure, typecheck, build, and audit. |
| `npm run check:packaging` | Pass | 123 passed, 0 failed. |
| `npm run studio:doctor` | Pass with service warnings | Local repo/env checks passed; Hermes direct `/health` connected; Web UI BFF and Brain Memory BFF were unreachable because no Web UI server was running. |
| `npm run check:brain-memory-client` | Pass | Brain Memory client shape checks passed. |
| `npm run check:brain-memory-regression-index` | Pass | Regression index checks passed. |
| `npm run check:hermes-runs-bff-request` | Pass | Disabled production-shaped Runs request contract remains guarded. |
| `npm run check:hermes-runs-bff-events` | Pass | Runs BFF event fixtures remain deterministic and production route remains disabled. |
| `npm run check:hermes-runs-lifecycle` | Pass | Runs lifecycle dry-run remains non-executing while route is disabled. |
| `npm run check:agent-access-policy` | Pass | No production Agent access selector or approval buttons exposed. |
| `npm run check:tenant-scope` | Pass | Tenant scope diagnostics checks passed. |
| `npm run check:ui-structure` | Pass | UI structure checks passed. |
| `npm audit --audit-level=moderate` | Pass | Found 0 vulnerabilities. |

Live/browser result:

| Surface | Result | Notes |
| --- | --- | --- |
| Selected Web UI base URL | Skipped/unavailable | `npm run studio:launch -- --check --json` found no reachable Web UI server on ports 3000-3007. |
| Browser smoke | Skipped/unavailable | In-app browser showed `ERR_CONNECTION_REFUSED`; no healthy selected Web UI URL was available. |
| Hermes live through BFF | Skipped/unavailable | Hermes direct `/health` returned HTTP 200, but BFF status/chat routes could not be verified without Web UI. |
| Brain Memory live through BFF | Skipped/unavailable | Gateway-like URL on `127.0.0.1:8080` was reachable but real Gateway mode and keys were not configured; BFF routes could not be verified without Web UI. |

## Optional Live Checks

Run these only with a healthy selected Web UI base URL and intentionally live
services:

- `npm run smoke:mvp -- --base-url <url>`
- `npm run smoke:ui -- --base-url <url>`
- `npm run smoke:ui:send -- --base-url <url>`
- `npm run smoke:ui:stop -- --base-url <url>`
- `node scripts/mvp-smoke.mjs --require-hermes --base-url <url>`
- `node scripts/mvp-smoke.mjs --require-brain-memory --base-url <url>`
- `node scripts/mvp-smoke.mjs --require-hermes --require-brain-memory --base-url <url>`
- `npm run smoke:ui:memory-live -- --base-url <url>`
- `npm run smoke:ui:memory-scope -- --base-url <url>`

Do not fake live smoke success. If the Web UI, Hermes, or Brain Memory Gateway
is unavailable, record it as blocked or unconfigured.

## Release Decision Status

Recommendation: **conditionally complete**.

The MVP is complete for a local/demo RC when:

1. the default non-live gate passes;
2. one healthy selected Web UI base URL is verified for browser claims;
3. live Hermes and Brain Memory claims are made only after the corresponding
   optional live gates pass.

This is not a production public release and not a final one-command package.

## Blockers

No source/build/audit blocker is identified by this audit document.

Live-service evidence can be blocked by local environment availability. That is
not an MVP source blocker, but it must be documented before making live Hermes
or live Brain Memory claims.

## Safety Confirmations

- Production chat still uses `/api/hermes/chat/stream`.
- Runs production implementation remains deferred/post-MVP.
- The disabled production-shaped Runs route remains HTTP 501 guarded.
- Brain Memory UI remains read-only for MVP.
- No Agent access selector UI is part of MVP.
- No approval buttons are part of MVP.
- No memory mutation/admin controls are part of MVP.
- No export/import runtime is part of MVP.
- Browser code must continue to call only Web UI BFF routes.

## Next Recommended Slice

Slice 17B: final RC browser/live smoke run and decision record.

Reason: 17A creates the audit and final checklist. The next useful slice is an
environment-specific verification pass that selects one healthy Web UI base
URL, runs the browser/live smokes that are actually available, and records the
candidate decision without adding runtime features.
