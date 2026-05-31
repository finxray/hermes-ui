# Release Decision 14P - Final RC Refresh After Launcher Hardening

Candidate: Hermes UI / Brain Memory Studio local MVP RC refresh 14P  
Decision date/time: 2026-05-31 11:34 +04:00, Asia/Dubai  
Decision commit: `773f7f4 docs: consolidate local bundle readiness checklist`

## Decision

Pass with known limitations.

Slice 17A supersedes the current release framing for MVP completion status.
See `docs/release/RELEASE_DECISION_17A.md` and
`docs/release/MVP_COMPLETION_AUDIT_17A.md`. The updated recommendation is
conditionally complete for a local/demo MVP RC after the safe non-live gate
passes, with browser/live claims gated by a healthy selected Web UI server and
intentionally running services.

The local MVP package remains acceptable for a Web UI + Hermes local RC when a
healthy selected Web UI server and Hermes service are running. Brain Memory
Gateway live mode remains optional/deferred in the current environment; the
read-only UI path supports mock/unconfigured mode and must not be claimed as a
live Gateway pass unless the Gateway is explicitly configured and checked.

## Changes Since 14M

- Slice 14N hardened the optional `studio:web` dev-server wrapper for
  Windows/WSL. It starts only the Web UI dev server from `apps/web` through the
  Next CLI with Node, reports diagnostics, handles child spawn failures, and
  stops only the child process tree it owns.
- Slice 14O added `docs/packaging/LOCAL_BUNDLE_CHECKLIST_14O.md` and
  consolidated packaging/release documentation around the current local MVP
  bundle path.
- Packaging docs now separate ready, partially ready, deferred, and
  not-claimable states for the local MVP package.
- Release/package scripts remain safe, local, and non-destructive.
- No production installer, final one-command GitHub bundle, export/import,
  Hermes auto-install, Brain Memory auto-install, service automation, Docker
  automation, systemd automation, backend logic change, Hermes logic change, or
  Brain Memory BFF logic change was added.

## Checks Run

| Check | Result | Notes |
| --- | --- | --- |
| `git status --short` | Pass | Working tree was clean at the start of Slice 14P. |
| `git log --oneline -n 8` | Pass | Confirmed HEAD history through 14O. |
| `npm run check:packaging` | Pass | Packaging contract checks passed. |
| `npm run release:check` | Pass | Safe release gate passed, including build and audit. |
| `npm run check:studio-launch` | Pass | Launcher contract checks passed. |
| `npm run studio:web -- --help` | Pass | Help/diagnostics available. |
| `npm run studio:launch -- --help` | Pass | Help/diagnostics available. |
| `npm run check-message-rendering` | Pass | Message renderer contract passed. |
| `npm run check:workspace-state` | Pass | Workspace-state contract passed. |
| `npm run check:agent-activity` | Pass | Agent activity contract passed. |
| `npm run check:agent-activity-rendering` | Pass | Agent activity rendering contract passed. |
| `npm run check:brain-memory-client` | Pass | Brain Memory client contract passed. |
| `npm run check:ui-structure` | Pass | UI structure contract passed. |
| `npm run typecheck` | Pass | TypeScript check passed. |
| `npm run build` | Pass | Production build passed. |
| `npm audit --audit-level=moderate` | Pass | 0 vulnerabilities reported. |
| `npm run studio:web -- --port 3002 --dry-run` | Pass | Port `3002` was free; dry run printed the Web UI-only Next command. |
| `npm run studio:launch -- --check --verbose` | Pass with warnings | No selected Web UI server was reachable; optional live services were unavailable/unconfigured. |

Browser smokes were not required or run in this refresh because no healthy
selected Web UI server was already available during the 14P diagnostic pass.
Live Brain Memory Gateway checks were not required or run.

## Pass / Fail Summary

- Safe release checks: pass.
- Packaging and launcher contract checks: pass.
- Help output checks: pass.
- Optional `studio:web` recovery dry run on `3002`: pass.
- Build/typecheck/audit: pass.
- Launcher live diagnostic: pass with warnings because no Web UI server was
  running and optional live services were not reachable/configured.
- Browser/live-service gates: not run in this refresh and not claimed.

## Current Local Bundle Status

The current package is a local MVP/demo RC, not a production installer and not
the final one-command GitHub distribution. The supported local path is:

1. install dependencies;
2. run the safe release gate;
3. start only the Web UI dev server with `studio:web` when needed;
4. verify one healthy selected Web UI base URL before browser smokes;
5. use live Hermes checks only when Hermes is already running and configured;
6. use live Brain Memory checks only when Brain Memory Gateway is already
   running and configured.

The `3002` Web UI recovery path remains available and safe. During this refresh,
`studio:web -- --port 3002 --dry-run` reported the port free and showed the
Web UI-only Next command it would run.

## Launcher Status

- `studio:web` help passed.
- `studio:launch` help passed.
- `check:studio-launch` passed.
- `studio:web -- --port 3002 --dry-run` passed.
- `studio:launch -- --check --verbose` exited successfully with warnings.
- The launcher did not start/stop Hermes, Brain Memory, Docker, systemd, or any
  unrelated process.
- The launcher did not modify `~/.hermes`, `apps/web/.env.local`, or `.next`.

## Hermes Status

Hermes real mode was configured in the environment checked by
`studio:launch -- --check --verbose`, but the direct Hermes `/health` probe was
unreachable during this run. Web UI BFF Hermes checks were skipped because no
selected Web UI server was reachable. This 14P refresh does not claim live
Hermes availability.

## Brain Memory Status

Brain Memory Gateway was not configured for live mode during this refresh. The
launcher reported common local Gateway URLs as unreachable and skipped direct
Gateway health because no live Gateway URL was configured. Mock/unconfigured
Brain Memory remains acceptable for the current local MVP default; live Gateway
E2E remains deferred.

## Stale Server Status

The 14P launcher diagnostic found no reachable Web UI server on ports `3000`
through `3007`. The optional `3002` dry run also reported the port free. No
stale server was killed or modified.

## Known Limitations

- Brain Memory Gateway live mode is optional and may be mock/unconfigured in a
  default local run.
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
  chat path.

## Deferred / Not Claimable

- Production installer.
- Managed Hermes installer or auto-installer.
- Managed Brain Memory installer or auto-installer.
- Auto-start/stop for Hermes, Brain Memory, Docker, or systemd.
- Final one-command GitHub distribution.
- Durable export/import.
- Memory mutation/admin controls.
- Context compaction runtime.
- Scalable infinite/progressive loading runtime.
- Direct browser-to-Hermes or browser-to-Brain-Memory access.
- Direct Postgres, Redis, Qdrant, RAGLight, SQLite, or memory-storage access.

## Slice 15M Release-Claim Refresh

Slice 15M supersedes the release-claim framing for future RC notes:

- default local MVP claims allow mock/unconfigured Brain Memory;
- browser smoke claims require one healthy selected Web UI base URL;
- live Hermes claims require Hermes real/reachable through the BFF;
- live Brain Memory claims require Hermes, Brain Memory Gateway, and the
  tenant-bound read key, and should follow
  `docs/product/BRAIN_MEMORY_READ_ONLY_QA_GATE_15L.md`;
- context compaction runtime and scalable infinite/progressive loading runtime
  remain deferred.

## Next Recommended Slice

Slice 15M - Refresh release/RC notes and add scalable UI loading roadmap.
