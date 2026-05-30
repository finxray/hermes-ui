# MVP Checkpoint 12A

Date: 2026-05-30

## Current Commit

- Branch: `master`
- Commit: `45e4a82aceb4de50bce340cd13590681f9021dd3`
- Short commit: `45e4a82 fix: polish composer send state and studio title alignment`
- Initial working tree state for this slice: clean

## Architecture Summary

Hermes UI / Brain Memory Studio is currently a Next.js/React TypeScript app with
server-side BFF routes and typed client packages.

The active boundaries remain:

```text
Agent memory path:
Browser UI -> Web UI Backend/BFF -> Hermes -> Brain Memory MCP/skill -> Brain Memory Gateway
```

```text
Memory observability/admin path:
Browser UI -> Web UI Backend/BFF -> Brain Memory Gateway UI/Admin API
```

Current package shape:

- `apps/web`: production UI, Next.js app routes, and local BFF route handlers.
- `packages/hermes-client`: typed Hermes API/status/chat client surface.
- `packages/brain-memory-client`: typed Brain Memory Gateway UI client surface.
- `scripts`: smoke/regression checks for workspace state, UI structure, doctor
  diagnostics, and client shape contracts.
- `docs`: architecture, integration, design, packaging, process, and checkpoint
  records.

The UI remains presentation/orchestration. Hermes remains the agent runtime.
Brain Memory Gateway remains the memory authority.

## Current Feature Status

| Area | Status | Notes |
| --- | --- | --- |
| Production shell | Working | Root app uses the Codex-style dark shell. Old green UI is no longer visible. |
| Project/session state | Stable | Script regression checks pass for stable keys, renames, active state repair, archive behavior, and reset behavior. |
| Hermes status | Live | BFF reports real Hermes mode, configured and reachable at `http://127.0.0.1:8642`. |
| Hermes streaming | Working | BFF stream smoke returned `OK` from Hermes through `/api/hermes/chat/stream`. |
| Brain Memory status | Mock/unconfigured in this process | BFF reports Gateway checks disabled and returns mock status. |
| Brain Memory search | BFF route present | Safe smoke returned HTTP 200 mock response with real Gateway disabled. |
| Brain Memory inspect | BFF route present | Safe smoke returned HTTP 200 mock response with real Gateway disabled. |
| Memory scope bridge | Present | Existing project/session scope path and regression checks remain in place. |
| Memory mutation/admin | Deferred | No mutation/admin actions are implemented in this checkpoint. |
| Auth/classification | Deferred | No production auth/classification model is implemented yet. |
| Visual design | Acceptable for MVP baseline | No visual tuning was performed in this slice. |

## Route Matrix

Test target: `http://127.0.0.1:3000`

| Route | Method | Result | Notes |
| --- | --- | --- | --- |
| `/` | GET | Pass, HTTP 200 | Production root rendered. HTML length observed: 53289. |
| `/design/codex-shell` | GET | Pass, HTTP 200 | Design route still present. HTML length observed: 55597. |
| `/api/hermes/status` | GET | Pass, HTTP 200 | `mode: real`, `configured: true`, `reachable: true`. |
| `/api/brain-memory/status` | GET | Pass, HTTP 200 | `mode: mock`, `configured: false`, `reachable: false`; real Gateway checks disabled. |
| `/api/brain-memory/search` | POST | Pass, HTTP 200 | Safe scoped request returned mock disabled response. |
| `/api/brain-memory/memory/inspect` | POST | Pass, HTTP 200 | Safe inspect request returned mock disabled response. |
| `/api/hermes/chat/stream` | POST | Pass, HTTP 200 | BFF stream emitted `run.started`, `message_delta: OK`, `message_done`, `run.completed`, and `done`. |

## Script and Check Matrix

| Check | Result | Notes |
| --- | --- | --- |
| `git status --short` | Pass | Clean at slice start. |
| `git log --oneline -n 12` | Pass | Latest commit was `45e4a82 fix: polish composer send state and studio title alignment`. |
| `npm run check:workspace-state` | Pass | Workspace state checks passed. |
| `npm run check:brain-memory-client` | Pass | Brain Memory client shape checks passed. |
| `npm run studio:doctor` | Pass | Local checks passed; Hermes live; Brain Memory in attach-later/mock state. |
| `npm run check:ui-structure` | Pass | UI structure checks passed. |
| `npm run typecheck` | Pass | `tsc --noEmit` passed for `@hermes-ui/web`. |
| `npm run build` | Pass | Next.js production build passed. |
| `npm audit --audit-level=moderate` | Pass | Found 0 vulnerabilities. |

## Live Service Matrix

| Service | Status | Evidence |
| --- | --- | --- |
| Web UI on port 3000 | Running | Root and design routes returned HTTP 200. |
| Hermes direct `/health` | Running | HTTP 200, `status: ok`, `platform: hermes-agent`. |
| Hermes direct `/health/detailed` | Running | HTTP 200, gateway state `running`, API server `connected`. |
| Web UI BFF Hermes status | Running | HTTP 200, real/configured/reachable. |
| Web UI BFF Hermes stream | Running | Simple BFF stream prompt returned assistant content `OK`. |
| Brain Memory Gateway direct checks | Disabled for this UI process | `studio:doctor` reported direct Gateway checks disabled. |
| Web UI BFF Brain Memory status | Mock | HTTP 200 mock response; real Gateway disabled. |
| Web UI BFF Brain Memory search | Mock | HTTP 200 mock disabled response. |
| Web UI BFF Brain Memory inspect | Mock | HTTP 200 mock disabled response. |

## UI Status

Browser smoke target: `http://127.0.0.1:3000/`

Observed at desktop viewport override `1440x900`:

- App loaded with title `Brain Memory Studio`.
- Codex-style production shell rendered.
- Old green UI was not detected.
- Project/sidebar region was visible.
- Composer was visible with the Hermes BFF placeholder.
- Right rail was visible with `Context`, `Memory`, `Tools`, and `Files` tab controls.
- Horizontal overflow check passed: document width matched viewport width.
- Settings text was visible in the sidebar region, but browser automation did
  not identify a unique settings button/popover target.

Panel toggle status:

- `Context`: present and clickable in browser smoke.
- `Memory`: present and clickable in browser smoke.
- `Tools`: present and clickable in browser smoke.
- `Files`: present and clickable in browser smoke.

Browser send note:

- A direct browser automation chat send was not completed in this checkpoint.
  The textarea accepted synthetic text, but the send button remained disabled
  during automation. The live Hermes service path was therefore verified through
  the existing BFF stream route instead.

## Known Remaining UI Issues

- Settings popover needs a clearer automation/accessibility target if future
  smoke checks should open it deterministically.
- Browser automation did not complete a composer send from the rendered UI in
  this run, even though the BFF streaming route succeeded.
- Provider/model selector still shows MVP-level polish and is deferred.
- Stop/cancel streaming remains a placeholder.
- Further visual polish is intentionally deferred after the current acceptable
  baseline.

## Known Deferred Features

- Full auth/classification model.
- Production one-command CLI.
- Durable evidence/supersession storage.
- Memory mutation/admin actions.
- Real stop/cancel streaming.
- Provider/model selector polish.
- Further UI polish.

## Risks Remaining

- Brain Memory Gateway was not live in this UI process, so this checkpoint does
  not re-verify real Gateway search/detail behavior.
- The production UI depends on the BFF boundary remaining intact as future
  features are added.
- Fast-stream handling has architectural safeguards, but no dedicated high-rate
  synthetic stress test is part of this checkpoint.
- Browser-level chat send needs a deterministic regression smoke before it can
  be used as an automated MVP gate.

## Next Recommended Slices

1. Slice 12B - MVP regression smoke harness.
   Add a lightweight automated route/UI smoke that can run against port 3000
   and records deterministic pass/fail output without changing app behavior.
2. Slice 12C - Gateway live re-check.
   Run the same checkpoint matrix with Brain Memory Gateway enabled and capture
   real search/detail evidence.
3. Slice 12D - Launch runbook.
   Consolidate local startup, environment modes, known mocks, and operator
   troubleshooting into a concise launch-readiness runbook.
