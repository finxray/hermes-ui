# Studio Launcher 14A

Date: 2026-05-31

## Purpose

Slice 14A adds a lightweight local launcher foundation for daily development
and MVP demo use:

```powershell
npm run studio:launch
```

The launcher is a safe orchestrator/checklist. It checks the local environment,
Web UI server, Hermes status, optional Brain Memory state, stale Next static
assets, and optional smoke commands. It does not install, start, stop, mutate,
or configure external services.

This is not the future production one-command installer.

## Files Changed

- `scripts/studio-launch.mjs`
- `package.json`
- `docs/packaging/STUDIO_LAUNCHER_14A.md`
- `docs/runbooks/MVP_LOCAL_LAUNCH_RUNBOOK.md`
- `README.md`
- `ROADMAP.md`

## Current Script Inventory

Existing commands remain unchanged:

| Command | Role |
| --- | --- |
| `npm run studio:doctor` | Repo/env/service diagnostic. |
| `npm run studio:env` | Creates local env from committed templates. |
| `npm run studio:open` | Opens the local Web UI URL. |
| `npm run smoke:mvp` | Source, route, BFF, Hermes-if-live, Brain Memory normalization smoke. |
| `npm run smoke:ui` | Browser interaction smoke without live send. |
| `npm run smoke:ui:send` | Opt-in live Hermes send smoke. |
| `npm run smoke:ui:stop` | Opt-in live stop/abort smoke. |
| `npm run smoke:ui:replay` | Opt-in live reload replay smoke. |
| `npm run check:*` | Shape, state, activity, client, and UI structure checks. |
| `npm run dev` | Starts the Next.js Web UI dev server. |
| `npm run build` | Builds the production Web UI. |

Slice 14A adds:

| Command | Role |
| --- | --- |
| `npm run studio:launch` | Safe local launcher/checklist. |
| `npm run studio:launch:smoke` | Launcher plus route/BFF and browser smoke. |

## Gaps Addressed

The launcher gives one daily entry point for:

- current mode;
- Node/npm checks;
- env file presence;
- Web UI server reachability;
- Next static chunk freshness;
- Hermes BFF status;
- direct Hermes `/health`;
- Brain Memory BFF status;
- optional direct Brain Memory `/health`;
- optional route/browser smokes;
- browser open flow;
- clear next commands.

## Flags

```text
--check
--base-url <url>
--no-port-scan
--open
--recovery
--smoke
--ui-smoke
--require-hermes
--require-brain-memory
--json
--verbose
--dev-command
```

Examples:

```powershell
npm run studio:launch -- --check
npm run studio:launch -- --check --base-url http://127.0.0.1:3000
npm run studio:launch -- --check --recovery
npm run studio:launch -- --check --verbose
npm run studio:launch -- --check --require-hermes
npm run studio:launch -- --smoke
npm run studio:launch -- --ui-smoke
npm run studio:launch -- --open
npm run studio:launch -- --dev-command
npm run studio:launch:smoke
```

`--check` is intentionally explicit but non-destructive; the default launcher
also performs the same checks.

`--dev-command` prints `npm run dev` as the command to run in another terminal.
It does not spawn a long-running dev server.

## Default Behavior

By default the launcher:

- prints current inferred mode;
- reports configured Hermes and Brain Memory URLs without printing API keys;
- checks Node and npm;
- checks `apps/web/.env.local`;
- checks `http://127.0.0.1:3000/`;
- checks Next static assets referenced by the root HTML;
- checks `/api/hermes/status` through the Web UI BFF when the Web UI is running;
- checks direct Hermes `/health` when `HERMES_API_BASE_URL` is configured;
- checks `/api/brain-memory/status` through the Web UI BFF when the Web UI is
  running;
- checks direct Brain Memory `/health` only when real Gateway mode is enabled;
- prints next commands.

The launcher does not run smoke tests or open the browser unless requested.

## Stale Server And Static Chunk Handling

The launcher fetches the root page and then checks up to eight referenced
`/_next/static/**` assets. If the root route returns HTTP 200 but one or more
static chunks fail, it warns that the running Next server may be stale.

Suggested recovery:

1. Restart the running `npm run dev` or `next start` process.
2. Re-run `npm run studio:launch -- --check`.
3. If stale assets persist, stop the server and remove only `apps/web/.next`
   after confirming the path.

The launcher does not kill processes and does not delete `.next`.

## Hermes Behavior

Hermes checks are two-layered:

- direct `/health` against `HERMES_API_BASE_URL` when configured;
- BFF `/api/hermes/status` when the Web UI server is reachable.

Without `--require-hermes`, missing/unreachable Hermes is a warning so Web UI
mock/unconfigured development can continue.

With `--require-hermes`, the launcher fails unless the BFF reports:

```text
mode=real
reachable=true
```

The launcher never calls Hermes from browser JavaScript and never changes
Hermes configuration.

## Brain Memory Behavior

Brain Memory remains optional.

When `BRAIN_MEMORY_UI_ENABLE_REAL_GATEWAY` is not `true`, direct Gateway checks
are skipped and BFF mock/unconfigured state is accepted.

When real Gateway mode is enabled, the launcher checks direct Gateway health
using the optional UI bearer header if configured. It reports whether the BFF
status is mock, real, unreachable, unauthorized, or disabled without printing
secrets.

With `--require-brain-memory`, mock/unconfigured Brain Memory is a failure.

The launcher does not install Brain Memory, start Docker, stop Docker, touch
systemd, access storage directly, or add memory mutation/admin actions.

## Smoke Behavior

`--smoke` runs the existing route/BFF smoke:

```powershell
npm run smoke:mvp
```

If `--require-hermes` or `--require-brain-memory` is present, those flags are
passed through to the MVP smoke.

`--ui-smoke` runs:

```powershell
npm run smoke:ui
```

The launcher captures the command result and prints a compact pass/fail summary.
It does not replace the underlying smoke scripts.

## Relationship To Future One-Command CLI

This script is the local launcher foundation for MVP development. The future
one-command CLI may later add guided service startup, packaging, Docker modes,
install checks, and release-grade distribution flows.

Those future behaviors remain deferred. Slice 14A deliberately avoids automatic
service management.

## Safety Boundaries

The launcher does not:

- implement export/import;
- install Hermes;
- install Brain Memory;
- modify `~/.hermes`;
- start/stop systemd services;
- start/stop Docker;
- start/stop Brain Memory;
- kill stale Next processes;
- delete `.next`;
- print API keys;
- call Hermes or Brain Memory directly from browser code;
- change Hermes streaming;
- change Brain Memory BFF logic;
- add memory mutation/admin actions;
- add production packaging or installer behavior.

## Export/Import Decision

Export/import is explicitly deferred after Slice 13O. The local export preview
remains display-only and is not turned into a file export/import feature in
Slice 14A.

## Next Recommended Slice

Slice 14B - Launcher Smoke Hardening And Cross-Platform Port Diagnostics.

Reason: Slice 14A adds a safe local launcher/checklist. The next useful step is
to harden diagnostics around port ownership, Windows/WSL/macOS differences, and
stale server recovery without adding automatic service management.

## Slice 14B Follow-Up

Slice 14B completed the first launcher hardening pass. The launcher now scans
local Web UI ports `3000` through `3007`, classifies likely Studio servers,
flags stale/broken Studio instances, reports exact failing `/_next/static/**`
chunks, probes common Brain Memory Gateway URLs `8080` and `8765`, emits
cross-platform process-hint commands, and includes browser-route and zoom
guidance.

Detailed behavior is documented in
`docs/packaging/STUDIO_LAUNCHER_14B_PORT_DIAGNOSTICS.md`.

The Slice 14A safety boundary remains unchanged: the launcher still does not
install, start, stop, kill, delete, mutate external services, change backend
logic, or implement export/import.
