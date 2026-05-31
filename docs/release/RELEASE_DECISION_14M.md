# Release Decision 14M

## Candidate

MVP RC dry run 14M

## Commit

`f2ec0b5 docs: add MVP release notes and RC checklist`

## Date / Time

2026-05-31, Asia/Dubai local dry run.

## Selected Base URL

`http://127.0.0.1:3002`

The selected server was started only for this RC dry run and stopped after
browser/manual evidence was collected.

## Server Setup

| Step | Result | Notes |
| --- | --- | --- |
| `npm run studio:web -- --port 3002 --dry-run --json` | Pass | Port `3002` was free/unreachable before start. |
| `npm run studio:launch -- --check --verbose --base-url http://127.0.0.1:3002` before start | Pass with warnings | Confirmed no healthy selected server yet; stale non-selected `3000` and `3005`; Hermes direct health was reachable; Brain Memory Gateway unconfigured. |
| `npm run studio:web -- --port 3002 --no-open` under hidden redirected automation | Setup caveat | Failed with `spawn EINVAL` before serving. No server remained running. |
| `npm run dev -- --hostname 127.0.0.1 --port 3002` under root npm script | Setup caveat | Windows/npm argument forwarding parsed host/port as app arguments and exited before serving. |
| Local Next binary from `apps/web` on port `3002` | Pass | Started the Web UI only; `http://127.0.0.1:3002` became healthy. |
| Cleanup | Pass | Stopped only the `3002` Next listener and its parent process started for this dry run. Did not stop stale `3000` or `3005`. |

## Checks Run

| Check | Result | Notes |
| --- | --- | --- |
| `git status --short` | Pass | Clean at start. |
| `git log --oneline -n 8` | Pass | HEAD was `f2ec0b5`. |
| `npm install` | Pass | Up to date; found `0` vulnerabilities. |
| `npm run release:check` | Pass | Included packaging, launcher contract, workspace state, Brain Memory client, activity/rendering, message rendering, UI structure, typecheck, build, and moderate audit. |
| `npm run check:packaging` | Pass | `85` passed, `0` failed. |
| `npm run check:studio-launch` | Pass | `87` passed, `0` failed. |
| `npm run check-message-rendering` | Pass | Message rendering checks passed. |
| `npm run check:workspace-state` | Pass | Workspace state checks passed. |
| `npm run check:agent-activity` | Pass | `26` activity checks passed. |
| `npm run check:agent-activity-rendering` | Pass | `34` rendering checks passed. |
| `npm run check:brain-memory-client` | Pass | Brain Memory client shape checks passed. |
| `npm run check:ui-structure` | Pass | UI structure checks passed. |
| `npm run typecheck` | Pass | Web TypeScript check passed. |
| `npm run build` | Pass | Production Next build passed; routes included `/`, Brain Memory BFF routes, Hermes BFF routes, and design fixtures. |
| `npm audit --audit-level=moderate` | Pass | Found `0` vulnerabilities. |
| `npm run studio:launch -- --help` | Pass | Help printed safety boundaries and flags. |
| `npm run studio:web -- --help` | Pass | Help printed Web UI-only wrapper behavior and safety boundaries. |
| `npm run studio:launch -- --check --base-url http://127.0.0.1:3002` | Pass with warnings | Selected `3002` was healthy; stale non-selected `3000` and `3005`; Brain Memory Gateway common URLs down/unconfigured. |
| `npm run studio:launch -- --check --verbose --base-url http://127.0.0.1:3002` | Pass with warnings | Same selected-server result with verbose diagnostics. |
| `npm run smoke:mvp -- --base-url http://127.0.0.1:3002` | Pass with warning | `38` passed, `1` warning for Brain Memory mock/unconfigured. Hermes stream emitted assistant content and done event. |
| `npm run smoke:ui -- --base-url http://127.0.0.1:3002` | Pass with warning | `54` passed, `1` warning because optional send was skipped by the non-mutating smoke. |
| `npm run smoke:markdown -- --base-url http://127.0.0.1:3002` | Pass | `26` passed, `0` failed. |
| `npm run smoke:markdown:long -- --base-url http://127.0.0.1:3002` | Pass | `23` passed, `0` failed. |
| `npm run smoke:ui:send -- --base-url http://127.0.0.1:3002` | Pass | `64` passed, `0` failed; live Hermes response included the expected smoke marker. |
| `npm run smoke:ui:stop -- --base-url http://127.0.0.1:3002` | Pass | `67` passed, `0` failed; stop returned composer to send state and persisted stopped activity replay. |
| `node scripts/mvp-smoke.mjs --require-hermes --base-url http://127.0.0.1:3002` | Pass with warning | `38` passed, `1` warning for Brain Memory mock/unconfigured. |
| Brain Memory `--require-brain-memory` | Not run | Gateway was not configured; live Brain Memory was intentionally not required. |

## Live Hermes Status

Hermes was live and reachable.

- Web UI BFF `/api/hermes/status`: `mode=real`, `configured=true`,
  `reachable=true`, `baseUrl=http://127.0.0.1:8642`.
- Direct Hermes `/health`: `status=ok`, `platform=hermes-agent`.
- Live send smoke passed.
- Live stop smoke passed for the current client/BFF session-stream abort path.

## Brain Memory Status

Brain Memory Gateway live mode was not configured for this RC dry run.

- Web UI BFF `/api/brain-memory/status`: `mode=mock`,
  `configured=false`, `reachable=false`.
- Common Gateway URLs `http://127.0.0.1:8080/` and
  `http://127.0.0.1:8765/` were unreachable.
- Default mock/unconfigured behavior was accepted as a known MVP limitation.
- Live `--require-brain-memory` was skipped rather than faked.

## Browser Evidence

Manual in-app browser checks used `http://127.0.0.1:3002`.

| Area | Result | Evidence |
| --- | --- | --- |
| Production root `/` | Pass | Title was `Brain Memory Studio`; path was `/`. |
| Old green UI absent | Pass | No old green markers were present in root DOM. |
| Sidebar | Pass | Projects and recent chats were visible. |
| Projects/sessions | Pass | `brain-memory`, `hermes-ui`, and session rows were visible. |
| Composer | Pass | Textarea and `Send message` control were present. |
| Live send | Pass | Covered by `smoke:ui:send`; assistant response included expected marker. |
| Live stop | Pass | Covered by `smoke:ui:stop`; stopped activity and replay were visible. |
| Right rail | Pass | Context, Memory, Tools, and Files tabs were visible and clickable. |
| Settings popover | Pass | Settings popover opened and showed Hermes connected plus Brain Memory mock/disconnected state. |
| Markdown fixture | Pass | `/design/markdown-fixture` rendered code, tables, copy controls, no overflow, and no visible secret-like strings. |
| Long markdown fixture | Pass | `/design/markdown-long-fixture` rendered code, tables, copy controls, no overflow, and no visible secret-like strings. |
| Horizontal overflow | Pass | Root and fixture routes fit within the `1440px` viewport. |
| Browser errors | Pass | In-app browser error log count was `0` for the checked routes. |
| Secrets visible | Pass | No visible secret-like strings were detected in root or fixture text. |

No screenshot artifact was committed; evidence was recorded from launcher,
Playwright smoke output, and in-app browser DOM/console checks.

## Route / Static Evidence

- `/` returned HTTP `200` and included the Brain Memory Studio title.
- `/design/codex-shell` returned HTTP `200` during launcher/MVP smoke checks.
- `/design/markdown-fixture` and `/design/markdown-long-fixture` loaded and
  passed browser fixture smokes.
- Selected `3002` static asset preflight passed with `8` checked assets.

## Stale Server Status

Stale non-selected Studio servers were detected and left untouched:

| Base URL | Status | Notes |
| --- | --- | --- |
| `http://127.0.0.1:3000` | Stale/broken Studio | Static chunk failures, listener PID `33944`. |
| `http://127.0.0.1:3005` | Stale/broken Studio | Static chunk failures, listener PID `16692`. |
| `http://127.0.0.1:3002` | Healthy selected server during run | Started for RC dry run; stopped after evidence collection. |

The stale servers did not block the RC dry run because every launcher and smoke
command used the explicit selected base URL `http://127.0.0.1:3002`.

## Known Limitations

- Brain Memory Gateway live mode was mock/unconfigured for this run.
- Production installer is not implemented.
- Final one-command GitHub bundle is not implemented.
- Export/import is deferred.
- Real artifact upload/download is deferred.
- Provider/model runtime switching is deferred.
- Full auth/classification is deferred.
- Memory admin/mutation UI is deferred.
- Cross-channel Telegram/CLI run discovery is deferred.
- Hermes Runs API migration is not done.
- Real server-side run stop is not implemented for the current session-stream
  chat path; current stop is client/BFF stream abort.
- Hidden redirected automation could not start `studio:web` directly in this
  run (`spawn EINVAL`), so the local Next binary was used for the Web UI-only
  server after the wrapper dry-run verified port safety.

## Release Decision

Pass with known limitations.

## Rationale

The safe source/build/audit release gate passed, a healthy selected Web UI
server was established, route/static checks passed against that selected base
URL, browser smokes passed, live Hermes send and stop gates passed, and manual
browser evidence found no old UI, no horizontal overflow, no console errors,
and no visible secret-like strings.

The candidate is not a full pass because Brain Memory Gateway live mode was
not configured and several larger packaging/product features remain explicitly
deferred. Those are documented limitations, not hidden failures.

## Not Claimable

- Production installer.
- Final one-command GitHub distribution.
- Auto-install or auto-start/stop of Hermes.
- Auto-install or auto-start/stop of Brain Memory.
- Docker/systemd service automation.
- Durable export/import.
- Memory mutation/admin controls.
- Direct browser-to-Hermes or browser-to-Brain-Memory paths.
- Direct storage access.

## Cleanup

- Stopped the selected `3002` Web UI listener and its parent process started
  for this RC dry run.
- Did not stop or modify stale non-selected `3000` or `3005`.
- Did not delete `.next`.
- Did not modify `~/.hermes`.
- Did not modify `apps/web/.env.local`.
