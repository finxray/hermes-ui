# Local Handoff Manifest 17D

Product: Hermes UI / Brain Memory Studio
Handoff type: local/demo MVP RC, private technical handoff only
Suggested release name: `v0.1.0-local-rc.1`
Prepared: 2026-05-31T21:18:52+04:00
Repo path at preparation: `C:\Users\Alexey\.cursor\projects\hermes-ui`
Branch at preparation: `master`
Commit at preparation: `8dc2332 docs: record comprehensive MVP E2E verification`

## Purpose

This manifest lists what belongs in the local handoff package and how a private
developer should verify it. It does not create an archive, upload an artifact,
install services, or implement a production release flow.

## Required Runtime

| Requirement | Current expectation |
| --- | --- |
| Node | Verified locally with Node `v24.15.0`; use the repo toolchain installed by `npm install`. |
| npm | Verified locally with npm `11.12.1`. |
| OS | Windows/PowerShell path is the current verified path; WSL is documented as a local operator variant. |
| Web UI | Next.js app under `apps/web`, started by `npm run studio:web`. |
| Hermes | External dependency, not installed by this repo. Expected at `http://127.0.0.1:8642` when live unless env overrides it. |
| Brain Memory Gateway | Optional external dependency, not installed by this repo. Usually expected at `http://127.0.0.1:8080` when live. |
| Browser smokes | Require one healthy selected Web UI base URL. |

Brain Memory live claims also require real BFF Gateway mode, a Gateway URL, and
the tenant-bound read key. Do not place secrets in this manifest.

## Supported Handoff Modes

| Mode | Status | Verification |
| --- | --- | --- |
| Web UI local/demo with mock Brain Memory | Supported | `studio:launch`, `smoke:ui`, `smoke:mvp`, release checks. |
| Web UI + Hermes live | Supported when Hermes is already running | `smoke:ui:send`, `smoke:ui:stop`, `mvp-smoke --require-hermes`. |
| Brain Memory attach-later | Manual supported path | Configure BFF Gateway env/key posture, then follow the read-only QA gate. |
| Runs diagnostics/guarded experimental | Post-MVP only | Disabled route guard and diagnostic probes; not production chat. |

## Key Commands

Install:

```powershell
npm install
```

Start the Web UI:

```powershell
npm run studio:web -- --port 3002 --open
```

Verify selected server:

```powershell
npm run studio:launch -- --check --base-url http://127.0.0.1:3002
```

Safe release gate:

```powershell
npm run release:check
```

Browser smoke:

```powershell
npm run smoke:ui -- --base-url http://127.0.0.1:3002
```

Live Hermes smoke:

```powershell
npm run smoke:ui:send -- --base-url http://127.0.0.1:3002
npm run smoke:ui:stop -- --base-url http://127.0.0.1:3002
```

Additional verification:

```powershell
npm run check:packaging
npm run check:studio-launch
npm run check:ui-structure
npm run check:workspace-state
npm run check:brain-memory-client
npm run check:tenant-scope
npm run check:agent-activity
npm run check:agent-activity-rendering
npm run typecheck
npm run build
npm audit --audit-level=moderate
```

## Docs Entry Points

- `README.md` - quick orientation and current launch commands.
- `docs/release/MVP_LOCAL_RC_RELEASE_NOTES_17D.md` - publish-ready local RC
  release notes.
- `docs/release/PRIVATE_DEVELOPER_HANDOFF_17D.md` - private developer handoff
  guide.
- `docs/release/MVP_COMPREHENSIVE_E2E_17C.md` - latest comprehensive E2E
  verification baseline.
- `docs/release/MVP_RC_NOTES.md` - current MVP RC posture and claim levels.
- `docs/release/MANUAL_RC_CHECKLIST.md` - manual dry-run checklist.
- `docs/packaging/LOCAL_BUNDLE_CHECKLIST_14O.md` - current local operator
  checklist.
- `docs/product/BRAIN_MEMORY_READ_ONLY_QA_GATE_15L.md` - live Brain Memory
  read-only claim gate.
- `docs/architecture/HERMES_RUNS_PRODUCTION_MIGRATION_GATE_16U.md` - Runs
  production migration gate.

## Files And Directories In Scope

| Path | Purpose |
| --- | --- |
| `apps/web` | Next.js Web UI and BFF route handlers. |
| `scripts` | Launcher, doctor, release checks, and smoke checks. |
| `docs` | Architecture, product, packaging, release, and runbook docs. |
| `env` | Example env files only; no secrets. |
| `package.json` and lockfiles | Workspace scripts and dependency state. |
| `README.md` and `ROADMAP.md` | Top-level orientation and current roadmap checkpoints. |

## Must Not Be Committed

- `apps/web/.env.local`
- API keys, tokens, bearer strings, passwords, or copied secrets
- temporary smoke logs such as `.codex-smoke-logs`
- `.next`
- local screenshots or recordings that expose secrets
- generated release archives unless a later slice explicitly creates them

## Operational Caveats

- Stale Next servers can make the browser look wrong. Use
  `npm run studio:launch -- --check --base-url <url>` to select one healthy
  server.
- Use the same healthy selected base URL for all browser smokes.
- `3002` is the recommended local recovery port when `3000` is stale,
  occupied, or confusing.
- Brain Memory live claims require the Web UI BFF to be configured for real
  Gateway mode with the correct Gateway URL and tenant-bound read key.
- Runs is experimental/diagnostic only for this RC. Production chat still uses
  `/api/hermes/chat/stream`.
- The launcher and wrapper do not install Hermes, install Brain Memory, manage
  Docker/systemd, delete `.next`, or kill unrelated processes.

## Deferred Features

- production installer;
- final one-command GitHub bundle;
- export/import;
- production Runs default;
- Agent access selector UI;
- approval buttons/action routes;
- memory mutation/admin UI;
- provider/model runtime switching;
- artifact upload/download;
- durable evidence/supersession/audit storage;
- full auth/classification;
- context compaction runtime;
- scalable progressive loading runtime.

## What This Manifest Does Not Do

This manifest does not create a package archive, upload a release artifact,
create a public GitHub release, implement export/import, or change runtime behavior.
