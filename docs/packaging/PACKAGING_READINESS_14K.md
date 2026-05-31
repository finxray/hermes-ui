# Packaging Readiness 14K

Date: 2026-05-31

## Purpose

This manifest defines the current packaging posture for Hermes UI / Brain
Memory Studio. It is a readiness baseline and release gate, not a production
installer.

For the current operator-facing local MVP / RC flow, start with
`docs/packaging/LOCAL_BUNDLE_CHECKLIST_14O.md`.

Slice 14K is docs and checks only. It does not build the final one-command
GitHub distribution, does not install services, and does not implement
export/import.

## Current Readiness Summary

### Ready

- Next.js Web UI app and BFF routes are present under `apps/web`.
- Root package scripts expose `dev`, `studio:web`, `studio:launch`,
  `studio:doctor`, `studio:env`, route/source smokes, browser smokes, typecheck,
  build, and contract checks.
- `studio:launch` provides safe diagnostics for env, Web UI route health, stale
  static chunks, Hermes status, Brain Memory mock/live status, selected base
  URL, and print-only recovery guidance.
- `studio:web` can explicitly start only the Web UI dev server after checking
  the selected port.
- Web UI standalone and Web UI plus Hermes are safe for MVP/demo use when a
  healthy selected Web UI server is running.
- Brain Memory can remain mock/unconfigured for default MVP startup.

### Partially Ready

- Live Hermes checks are available when Hermes is already running, usually at
  `http://127.0.0.1:8642`.
- Live Brain Memory Gateway checks are available when Gateway is already
  running, usually at `http://127.0.0.1:8080`, and the tenant-bound read key is
  configured.
- Bundle mode is documented as a target, but setup/start orchestration remains
  manual.
- Browser smokes are available, but they require one healthy selected Web UI
  base URL and are not part of the default release gate while the local server
  may be stale.

### Not Ready

- Production installer.
- Final one-command GitHub distribution.
- Automatic Hermes install/start/stop.
- Automatic Brain Memory install/start/stop.
- Docker or systemd orchestration.
- Durable export/import.
- Release-grade Brain Memory bundle setup.

### Deferred

- Full auth/classification model.
- Memory admin/mutation UI.
- Real artifact upload/download.
- Real provider/model runtime switching.
- Production one-command CLI.
- Durable evidence/supersession storage.
- Durable audit trail.
- Context compaction runtime.
- Scalable infinite/progressive loading runtime.
- Export/import.

## Packaging Modes

| Mode | Current status | Notes |
| --- | --- | --- |
| Web UI standalone | MVP/demo ready | Requires Node/npm. Hermes may be mock/unreachable depending on env. Brain Memory can stay disabled/mock. |
| Web UI + Hermes | MVP/demo ready when Hermes is running | Hermes is expected at `http://127.0.0.1:8642` unless env says otherwise. Browser still calls only the BFF. |
| Web UI + Brain Memory attached later | Documented/manual | Gateway is optional, expected at `http://127.0.0.1:8080` when live, and requires tenant-bound read key configuration. |
| Web UI + Brain Memory bundle | Future target | Not implemented as an installer or orchestrated bundle yet. Users should not be forced to install Brain Memory. |
| Brain Memory standalone | External/independent | Brain Memory remains its own backend/MCP/Gateway project and is not installed by this repo. |
| Future full one-command package | Deferred | Planned in `docs/packaging/ONE_COMMAND_CLI_PLAN.md`; not claimable yet. |

## Current Commands

Install dependencies:

```powershell
npm install
```

Create or inspect env:

```powershell
npm run studio:env -- --list
npm run studio:env -- --mode web-ui-with-hermes
npm run studio:env -- --mode web-ui-only
```

Start only the Web UI dev server:

```powershell
npm run studio:web
npm run studio:web -- --port 3002 --open --ui-smoke
```

Raw dev command remains available for experienced local use:

```powershell
npm run dev
```

Run launcher checks:

```powershell
npm run studio:launch -- --check
npm run studio:launch -- --check --base-url http://127.0.0.1:3000
```

Run safe non-browser release checks:

```powershell
npm run check:packaging
npm run release:check
```

Run route/source and browser smokes after selecting a healthy Web UI base URL:

```powershell
npm run smoke:mvp -- --base-url http://127.0.0.1:<port>
npm run smoke:ui -- --base-url http://127.0.0.1:<port>
```

Open the browser:

```powershell
npm run studio:open
```

## Release Gate Checklist

Required before claiming an MVP-ready package:

- `npm install` works on the target platform.
- `npm run build` passes.
- `npm run typecheck` passes.
- `npm audit --audit-level=moderate` passes.
- `npm run check:packaging` passes.
- `npm run check:studio-launch` passes.
- `npm run check:workspace-state` passes.
- `npm run check:brain-memory-client` passes.
- `npm run check:agent-activity` passes.
- `npm run check:agent-activity-rendering` passes.
- `npm run check-message-rendering` passes.
- `npm run check:ui-structure` passes.
- `npm run studio:launch -- --check --base-url <healthy-url>` passes against
  the intentionally selected healthy Web UI server.
- `npm run smoke:mvp -- --base-url <healthy-url>` passes.
- `npm run smoke:ui -- --base-url <healthy-url>` passes.
- No stale selected server is used for browser smokes.
- No secrets are committed.
- Brain Memory mock/unconfigured mode is clearly labelled when live Gateway is
  absent.

`npm run release:check` covers the safe source/build/audit portion of this gate.
It intentionally excludes browser smokes and live-service gates because a
healthy selected Web UI server is not guaranteed in every checkout.

## Optional Live-Service Gates

Use these only when the relevant services are intentionally live and configured:

```powershell
node scripts/mvp-smoke.mjs --require-hermes --base-url http://127.0.0.1:<port>
npm run smoke:ui:send -- --base-url http://127.0.0.1:<port>
npm run smoke:ui:stop -- --base-url http://127.0.0.1:<port>
npm run smoke:ui:replay -- --base-url http://127.0.0.1:<port>
npm run smoke:ui:memory-live -- --base-url http://127.0.0.1:<port>
npm run smoke:ui:memory-scope -- --base-url http://127.0.0.1:<port>
node scripts/mvp-smoke.mjs --require-hermes --require-brain-memory --base-url http://127.0.0.1:<port>
npm run smoke:markdown -- --base-url http://127.0.0.1:<port>
npm run smoke:markdown:long -- --base-url http://127.0.0.1:<port>
npm run smoke:memory-detail -- --base-url http://127.0.0.1:<port>
```

Hermes must be real/reachable for send, stop, and replay smokes. Brain Memory
Gateway must be real/reachable for the memory-live, memory-scope, and combined
MVP live smoke. Live Brain Memory claims should follow
`docs/product/BRAIN_MEMORY_READ_ONLY_QA_GATE_15L.md`.

## Deferred / Not Claimable Yet

Do not claim these as implemented:

- production installer;
- final one-command GitHub bundle;
- auto-install Hermes;
- auto-install Brain Memory;
- auto-start/stop Docker;
- auto-start/stop systemd;
- automatic mutation of `~/.hermes`;
- real artifact upload/download;
- real provider/model runtime switching;
- full auth/classification;
- memory admin/mutation UI;
- context compaction runtime;
- scalable infinite/progressive loading runtime;
- export/import.

## Safety Boundaries

- No auto-kill of existing processes.
- No automatic `.next` deletion.
- No Docker or systemd management by default.
- No `~/.hermes` mutation.
- No `apps/web/.env.local` mutation outside explicit `studio:env` use.
- No API key printing.
- Browser code talks only to the Next.js BFF.
- Hermes remains the agent runtime.
- Brain Memory Gateway remains the memory authority.
- Brain Memory storage is never accessed directly by the Web UI.

## What Must Not Be Claimed Yet

The project may be described as an MVP/demo-ready local Web UI when the release
gate passes and a healthy selected Web UI server is verified.

It must not be described yet as:

- a production installer;
- a one-command GitHub distribution;
- a managed Hermes installer;
- a managed Brain Memory installer;
- a Docker/systemd service manager;
- a product with durable export/import;
- a product with memory mutation/admin controls;
- a product with implemented context compaction;
- a product with implemented infinite/progressive loading.

## Next Recommended Slice

Slice 14L - Release notes and manual RC checklist.

Reason: the repository now has launcher diagnostics, Web UI-only start tooling,
and a packaging readiness gate. The next packaging slice should turn this into
a concise human release-candidate checklist and release notes draft without
adding service automation.
