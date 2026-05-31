# Release Decision 17B - Final MVP RC Browser And Live Smoke

Candidate: Hermes UI / Brain Memory Studio local MVP/demo RC
Decision date/time: 2026-05-31T20:56:32+04:00
Decision commit: `95d0bdb docs: audit MVP completion readiness`
Selected Web UI base URL: `http://127.0.0.1:3002`

## Decision

MVP complete with known limitations.

The final RC source, browser, and live Hermes gates passed against the selected
Web UI server. Live Brain Memory Gateway claims remain unavailable in this shell
because the Web UI BFF is configured for mock/unconfigured Brain Memory mode.
That is an accepted limitation for the default local MVP path and is not a
source blocker.

This decision does not make the package a production public release, production
installer, or final one-command GitHub bundle.

## Selected Server

The Web UI was started with:

```powershell
npm run studio:web -- --port 3002 --no-open
```

Launcher verification:

```powershell
npm run studio:launch -- --check --base-url http://127.0.0.1:3002
```

Result: pass with known Brain Memory configuration warnings.

- Root `/` returned HTTP 200.
- Root HTML included the `Brain Memory Studio` title.
- Old green UI markers were absent.
- 8 Next static assets responded successfully.
- Hermes BFF reported `mode=real`, `reachable=true`.
- Hermes direct `/health` returned HTTP 200.
- Brain Memory BFF reported `mode=mock`, `reachable=false`.
- Brain Memory Gateway-like URL `http://127.0.0.1:8080/` was reachable as a
  local service root but not configured for this Web UI process.
- No stale/broken Studio server was selected.

## Non-Live Checks

| Check | Result |
| --- | --- |
| `npm run release:check` | Pass |
| `npm run check:packaging` | Pass, 123 passed, 0 failed |
| `npm run check:studio-launch` | Pass, 104 passed, 0 failed |
| `npm run check:brain-memory-regression-index` | Pass |
| `npm run check:hermes-runs-bff-request` | Pass, 11 passed |
| `npm run check:hermes-runs-bff-events` | Pass, 15 passed |
| `npm run check:hermes-runs-lifecycle` | Pass, 11 passed |
| `npm run check:agent-access-policy` | Pass, 14 passed |
| `npm run check:ui-structure` | Pass |
| `npm run check:workspace-state` | Pass |
| `npm run check:agent-activity` | Pass, 36 passed |
| `npm run check:agent-activity-rendering` | Pass, 35 passed |
| `npm run check:brain-memory-client` | Pass |
| `npm run check:tenant-scope` | Pass |
| `npm run typecheck` | Pass |
| `npm run build` | Pass |
| `npm audit --audit-level=moderate` | Pass, 0 vulnerabilities |

## Browser Smokes

All browser and fixture smokes used the selected base URL
`http://127.0.0.1:3002`.

| Check | Result | Notes |
| --- | --- | --- |
| `npm run smoke:mvp -- --base-url http://127.0.0.1:3002` | Pass | 47 passed, 1 warning, 0 failed. Warning was Brain Memory mock/unconfigured mode accepted. |
| `npm run smoke:ui -- --base-url http://127.0.0.1:3002` | Pass | 57 passed, 1 warning, 0 failed. Warning was optional send click skipped by default. |
| `npm run smoke:markdown -- --base-url http://127.0.0.1:3002` | Pass | 26 passed, 0 failed. |
| `npm run smoke:markdown:long -- --base-url http://127.0.0.1:3002` | Pass | 23 passed, 0 failed. |
| `npm run smoke:memory-detail -- --base-url http://127.0.0.1:3002` | Pass | 18 passed, 0 failed. |
| `npm run smoke:long-session -- --base-url http://127.0.0.1:3002 --json` | Pass | 35 passed, 0 failed, 0 px overflow. |
| `npm run smoke:sidebar:large -- --base-url http://127.0.0.1:3002 --json` | Pass | 19 passed, 0 failed, 0 px overflow. |
| `npm run smoke:artifacts-tools:large -- --base-url http://127.0.0.1:3002 --json` | Pass | 23 passed, 0 failed, 0 px overflow. |

Browser smoke evidence:

- root loaded;
- old green UI absent;
- project/session sidebar visible;
- composer visible;
- right rail visible;
- settings popover opened and closed in the automated browser smoke;
- Context, Memory, Tools, and Files tabs were usable;
- markdown/code copy route passed;
- memory detail fixture passed;
- no horizontal overflow was reported;
- no browser console, page, static chunk, or unexpected network errors were
  captured by the smoke scripts;
- no visible secrets were reported.

The in-app browser was also opened to `http://127.0.0.1:3002/`. Its narrow
620 px viewport showed the Studio root with no horizontal overflow.

## Live Hermes Checks

| Check | Result | Notes |
| --- | --- | --- |
| `node scripts/mvp-smoke.mjs --require-hermes --base-url http://127.0.0.1:3002` | Pass | Hermes BFF real/reachable; session stream emitted assistant content and done event. |
| `npm run smoke:ui:send -- --base-url http://127.0.0.1:3002` | Pass | 67 passed, 0 failed; assistant response included `UI_SMOKE_SEND_OK`; run history completed. |
| `npm run smoke:ui:stop -- --base-url http://127.0.0.1:3002` | Pass | 70 passed, 0 failed; stop button visible during stream; stopped activity and run history recorded. |

Live Hermes status:

- Web UI BFF `/api/hermes/status` reported `mode=real`,
  `configured=true`, `reachable=true`.
- Production chat still used `/api/hermes/chat/stream`.
- Stop/cancel remained current session-stream abort, not production Runs stop.

## Live Brain Memory Checks

Live Brain Memory was not claimable in this shell.

Evidence:

- Web UI BFF `/api/brain-memory/status` returned `mode=mock`,
  `configured=false`, `reachable=false`.
- BFF error kind was `disabled`.
- `http://127.0.0.1:8080/` returned an HTTP response, but this Web UI process
  had no `BRAIN_MEMORY_GATEWAY_URL`, no real Gateway mode, and no tenant-bound
  read key configured.

Skipped live checks:

- `node scripts/mvp-smoke.mjs --require-brain-memory --base-url ...`
- `node scripts/mvp-smoke.mjs --require-hermes --require-brain-memory --base-url ...`
- `npm run smoke:ui:memory-live -- --base-url ...`
- `npm run smoke:ui:memory-scope -- --base-url ...`

Reason: live Gateway/key posture was unavailable. Default local MVP accepts
mock/unconfigured Brain Memory when that state is documented honestly.

## Optional Runs Checks

Runs remains post-MVP/deferred and is not required for MVP completion.

| Check | Result | Notes |
| --- | --- | --- |
| `npm run check:hermes-runs-bff-request` | Pass | Disabled request contract remains guarded. |
| `npm run check:hermes-runs-bff-events` | Pass | BFF event fixtures remain deterministic. |
| `npm run check:hermes-runs-lifecycle` | Pass | Lifecycle dry-run remains non-executing. |
| `npm run check:agent-access-policy` | Pass | No production Agent access selector or approval buttons exposed. |
| `npm run smoke:hermes:runs:route-guard -- --base-url http://127.0.0.1:3002` | Pass | Production-shaped Runs route returned disabled HTTP 501 JSON. |
| `npm run smoke:hermes:runs -- --base-url http://127.0.0.1:3002 --require-hermes` | Pass | Diagnostic Runs probe completed and returned `HERMES_RUNS_PROBE_OK`. |

The successful diagnostic Runs probe does not change the MVP execution path.

## Known Limitations

- Live Brain Memory Gateway search/inspect was not verified because the Web UI
  BFF was in mock/unconfigured mode with no live Gateway URL/key posture.
- Brain Memory mock/unconfigured mode is acceptable for the default local MVP,
  but it is not live Gateway evidence.
- Stop/cancel is session-stream abort, not server-side production Runs stop.
- Approval rows remain display-only.
- Files/artifacts remain local/mock foundations; real upload/download is
  deferred.
- Provider/model runtime switching remains disabled/server-configured.
- Export preview remains local display-only; durable export/import is
  deferred.
- Runtime scalable loading remains deferred because MVP-scale measurements pass.
- The package remains a local MVP/demo RC, not a production installer or final
  one-command distribution.

## Deferred/Post-MVP Items

- production Runs default or production Runs route implementation;
- Agent access selector UI;
- approval buttons and approval action routes;
- memory mutation/admin UI;
- export/import;
- provider/model runtime switching;
- artifact upload/download;
- automatic/manual context compaction runtime;
- cross-channel discovery;
- durable backend run history;
- durable evidence/supersession/audit storage;
- production installer;
- final one-command GitHub bundle.

## Safety Confirmations

- Production chat still uses `/api/hermes/chat/stream`.
- Runs production implementation remains deferred/post-MVP.
- The production-shaped Runs route remains disabled HTTP 501.
- Brain Memory UI remains read-only for MVP.
- No Agent access selector UI was added.
- No approval buttons were added.
- No memory mutation/admin controls were added.
- No export/import runtime was added.
- Browser code continues to use Web UI BFF routes.

## Cleanup

The Web UI server was started by this slice through the safe wrapper and then
stopped by terminating only the recorded wrapper process tree. A graceful
Windows process-tree stop left child processes running, so the same recorded
tree was force-stopped; `http://127.0.0.1:3002/` was then unreachable. Temporary
smoke logs created by this slice were removed from the workspace. Hermes and
Brain Memory services were not started or stopped by this slice.

## Next Recommended Slice

Slice 17C: publish-ready release notes and local handoff package manifest.

Reason: 17B establishes the final RC decision. The next useful slice should
package the human-facing release notes and handoff manifest without adding
runtime features.
