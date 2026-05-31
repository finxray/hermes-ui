# MVP Comprehensive E2E Verification 17C

Candidate: Hermes UI / Brain Memory Studio local MVP/demo RC
Verification date/time: 2026-05-31T21:13:06+04:00
Candidate commit before this document: `cf8b878 docs: record final MVP RC live smoke decision`
Selected Web UI base URL: `http://127.0.0.1:3002`

## Result

MVP complete with known limitations.

This run confirms the local/demo MVP baseline after the Slice 17B release
decision. Required source, build, audit, browser, and live Hermes checks passed
against the selected Web UI server. Live Brain Memory Gateway was reachable
directly on the machine, but the Web UI BFF was not configured for live Brain
Memory mode, so live Brain Memory search/detail claims remain skipped and not
claimed.

This is not a production installer, final one-command GitHub distribution, or
production Runs launch.

## Working Tree And Server

Initial working tree state: clean.

Recent candidate history:

```text
cf8b878 docs: record final MVP RC live smoke decision
95d0bdb docs: audit MVP completion readiness
6ecea07 test: add disabled Runs response fixtures
7512c56 test: add Runs BFF lifecycle dry run
3b8eaeb test: add Agent access policy matrix
795501a test: add disabled Runs validation echo and access policy
c14a041 test: add disabled Runs request validation contract
804215e test: add disabled Runs route guard
a6460e4 test: add Hermes Runs BFF event fixtures
627d1a5 docs: define Hermes Runs BFF event contract
f6d8f98 docs: define Hermes Runs execution state machine
c0bba8b test: hydrate experimental Runs replay in UI
```

Temporary Web UI server:

```powershell
npm run studio:web -- --port 3002 --no-open
```

The server returned HTTP 200 at `http://127.0.0.1:3002/`. The selected listener
PID reported by launcher diagnostics was `31876`; the wrapper PID recorded by
this run was `15024`.

## Route Matrix

| Route | Method | Result | Notes |
| --- | --- | --- | --- |
| `/` | GET | Pass, HTTP 200 | Root included `Brain Memory Studio`; old green UI markers absent. |
| `/design/codex-shell` | GET | Pass, HTTP 200 | Optional/reference route still present. |
| `/api/hermes/status` | GET | Pass, HTTP 200 | `mode=real`, `configured=true`, `reachable=true`. |
| `/api/hermes/chat/stream` | POST | Pass, HTTP 200 | Production chat stream emitted assistant content and done event. |
| `/api/brain-memory/status` | GET | Pass, HTTP 200 | `mode=mock`, `configured=false`, `reachable=false`, error kind `disabled`. |
| `/api/brain-memory/search` | POST | Pass, normalized mock response | Safe smoke returned mock response with 0 results. |
| `/api/brain-memory/memory/inspect` | POST | Pass, normalized mock response | Safe smoke returned mock disabled/detail posture. |
| `/api/hermes/runs/chat/stream` | POST | Pass as disabled route | Returned disabled HTTP 501 JSON; not a production path. |

Production build route inventory also included the deterministic design fixture
routes for markdown, long markdown, memory detail, long session, large sidebar,
and large artifacts/tools coverage.

## Non-Live Checks

| Check | Result |
| --- | --- |
| `npm run release:check` | Pass |
| `npm run check:packaging` | Pass through release gate, 123 passed, 0 failed |
| `npm run check:studio-launch` | Pass through release gate, 104 passed, 0 failed |
| `npm run check:workspace-state` | Pass |
| `npm run check:brain-memory-client` | Pass |
| `npm run check:brain-memory-regression-index` | Pass |
| `npm run check:agent-access-policy` | Pass through release gate, 14 passed |
| `npm run check:agent-activity` | Pass through release gate, 36 passed |
| `npm run check:agent-activity-rendering` | Pass through release gate, 35 passed |
| `npm run check-message-rendering` | Pass |
| `npm run check:ui-structure` | Pass |
| `npm run check:tenant-scope` | Pass |
| `npm run check:hermes-runs-bff-request` | Pass, 11 passed |
| `npm run check:hermes-runs-bff-events` | Pass, 15 passed |
| `npm run check:hermes-runs-lifecycle` | Pass, 11 passed |
| `npm run studio:doctor` | Pass with selected `STUDIO_WEB_UI_URL`; Hermes BFF real, Brain Memory BFF mock |
| `npm run typecheck` | Pass through release gate |
| `npm run build` | Pass through release gate |
| `npm audit --audit-level=moderate` | Pass, 0 vulnerabilities |

One unscoped `npm run studio:doctor` invocation also exited 0 but reported Web
UI BFF checks unreachable because the doctor defaulted to port 3000. Rerunning
with `STUDIO_WEB_UI_URL=http://127.0.0.1:3002` resolved the target mismatch.

## Browser Smoke Matrix

All browser smokes used `http://127.0.0.1:3002`.

| Check | Result | Evidence |
| --- | --- | --- |
| `npm run smoke:mvp -- --base-url http://127.0.0.1:3002` | Pass | 47 passed, 1 warning, 0 failed. Warning was accepted Brain Memory mock/unconfigured mode. |
| `npm run smoke:ui -- --base-url http://127.0.0.1:3002` | Pass | 57 passed, 1 warning, 0 failed. Optional send skipped by default. |
| `npm run smoke:markdown -- --base-url http://127.0.0.1:3002` | Pass | 26 passed, 0 failed. |
| `npm run smoke:markdown:long -- --base-url http://127.0.0.1:3002` | Pass | 23 passed, 0 failed. |
| `npm run smoke:memory-detail -- --base-url http://127.0.0.1:3002` | Pass | 18 passed, 0 failed. |
| `npm run smoke:long-session -- --base-url http://127.0.0.1:3002 --json` | Pass | 35 passed, 0 failed, 0 px horizontal overflow. |
| `npm run smoke:sidebar:large -- --base-url http://127.0.0.1:3002 --json` | Pass | 19 passed, 0 failed, 0 px horizontal overflow. |
| `npm run smoke:artifacts-tools:large -- --base-url http://127.0.0.1:3002 --json` | Pass | 23 passed, 0 failed, 0 px horizontal overflow. |

Desktop browser smoke confirmed:

- production root loaded;
- old green UI absent;
- project/session sidebar visible;
- composer visible;
- right rail visible;
- settings popover opened and closed;
- Context, Memory, Tools, and Files tabs worked;
- no horizontal overflow;
- no browser console, page, static chunk, or unexpected network errors.

In-app browser evidence used a 620 px responsive viewport. The root loaded with
title `Brain Memory Studio`, no horizontal overflow, no old green UI markers,
visible shell and composer, and no credential-like visible text. At that narrow
viewport the left sidebar and right rail were collapsed behind visible rail
toggles, which matches the responsive layout; full rail visibility is covered
by the desktop smoke above.

## Live Hermes Matrix

| Check | Result | Notes |
| --- | --- | --- |
| `curl.exe -i http://127.0.0.1:8642/health` | Pass | HTTP 200, `{"status":"ok","platform":"hermes-agent"}`. |
| Web UI BFF `/api/hermes/status` | Pass | `mode=real`, `reachable=true`; capabilities advertised session stream, Responses, Runs, run stop, approvals, skills, and session headers. |
| `node scripts/mvp-smoke.mjs --require-hermes --base-url http://127.0.0.1:3002` | Pass | 47 passed, 1 accepted Brain Memory warning, 0 failed. |
| `npm run smoke:ui:send -- --base-url http://127.0.0.1:3002` | Pass | 67 passed, 0 failed; assistant response included `UI_SMOKE_SEND_OK`; run history completed. |
| `npm run smoke:ui:stop -- --base-url http://127.0.0.1:3002` | Pass | 70 passed, 0 failed; stop button visible during stream; stopped activity and run history recorded. |

Production chat still uses `/api/hermes/chat/stream`. Stop/cancel in this MVP
is the current session-stream abort path, not production Runs stop.

## Live Brain Memory Matrix

| Check | Result | Notes |
| --- | --- | --- |
| `curl.exe -i http://127.0.0.1:8080/health` | Direct service reachable | HTTP 200, `status=ok`, `service=brain-memory-gateway`, `version=0.1.0-rc.1`, Postgres ok. |
| `curl.exe -i http://127.0.0.1:8080/ready` | Direct service ready | HTTP 200, `status=READY`, Postgres ok. |
| Web UI BFF `/api/brain-memory/status` | Mock/unconfigured | HTTP 200, `mode=mock`, `configured=false`, `reachable=false`, error kind `disabled`. |
| BFF search/detail live claim | Skipped | Web UI process had no live Gateway URL/key posture. |
| Direct Gateway memory search/detail | Skipped | The MVP claim path is the Web UI BFF, not ad hoc direct Gateway probing from the browser. |

Brain Memory Gateway was available on the machine, but this Web UI process was
not configured to use it. Therefore live Brain Memory search/inspect is not
claimed for this verification pass.

## Optional Runs Guard And Probe

Runs remains post-MVP/deferred and is not required for MVP completion.

| Check | Result | Notes |
| --- | --- | --- |
| `npm run smoke:hermes:runs:route-guard -- --base-url http://127.0.0.1:3002` | Pass | Production-shaped Runs chat route returned disabled HTTP 501 JSON. Node emitted a non-failing module-type warning. |
| `npm run smoke:hermes:runs -- --base-url http://127.0.0.1:3002 --require-hermes` | Pass diagnostic only | Hermes Runs probe completed with `HERMES_RUNS_PROBE_OK`; event types were `message.delta`, `reasoning.available`, and `run.completed`. |

The diagnostic Runs probe does not change the production MVP path.

## Architecture Summary

- Browser code calls the Next.js Web UI BFF only.
- Hermes remains the agent runtime.
- Brain Memory Gateway remains the memory authority.
- Production chat uses BFF-mediated Hermes session streaming.
- Brain Memory UI surfaces remain read-only through BFF-approved routes when
  configured, and mock/unconfigured when not configured.
- Project/session state remains local and stable-key scoped.
- Runs, approvals, Agent access modes, memory mutation/admin, export/import,
  and provider/model runtime switching remain deferred.

## Known Limitations

- Live Brain Memory Gateway search/inspect was not verified because the Web UI
  BFF was mock/unconfigured for Brain Memory.
- Brain Memory direct Gateway health/ready is not equivalent to a live UI/BFF
  search/detail claim.
- Stop/cancel is session-stream abort, not server-side production Runs stop.
- Approval rows remain display-only; no approve/deny action route exists.
- Files/artifacts remain local/mock foundations; real upload/download is
  deferred.
- Provider/model selector remains server-configured/disabled.
- Export preview remains local display-only; durable export/import is deferred.
- The in-app browser evidence was narrow responsive viewport evidence; desktop
  rail visibility is covered by Playwright smoke.
- This remains a local MVP/demo RC, not a production installer.

## Deferred Features

- full auth/classification model;
- production one-command CLI;
- durable evidence/supersession/audit storage;
- memory mutation/admin actions;
- real server-side stop/cancel streaming through production Runs;
- provider/model selector polish and runtime switching;
- further UI polish;
- production Runs default;
- Agent access selector UI;
- approval action buttons/routes;
- artifact upload/download;
- export/import;
- context compaction runtime;
- scalable progressive loading runtime.

## Cleanup

The temporary Web UI server started for this run was stopped by terminating only
the recorded wrapper process tree. `http://127.0.0.1:3002/` was verified
unreachable afterward. Temporary `.codex-smoke-logs` files created by this run
were removed. Hermes and Brain Memory services were not started or stopped by
this slice.

## Safety Confirmations

- Production chat still uses `/api/hermes/chat/stream`.
- Production Runs remains deferred/post-MVP.
- The production-shaped Runs chat route remains disabled HTTP 501.
- No Agent access selector UI was added.
- No approval buttons were added.
- No memory mutation/admin controls were added.
- No export/import runtime was added.
- No direct browser-to-Hermes route was added.
- No direct browser-to-Brain-Memory route was added.
- No direct storage path was added.

## Final Recommendation

Keep the MVP recommendation as complete with known limitations for the
local/demo RC.

Exact next recommended slice: Slice 17D - publish-ready release notes and local
handoff package manifest.
