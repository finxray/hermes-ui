# MVP Local Launch Runbook

Date: 2026-05-30

This runbook is for local development and MVP demo use of Hermes UI / Brain
Memory Studio. It documents the current manual startup path. It does not replace
the deferred production one-command CLI.

## Known Local URLs

| Service | Default URL | Notes |
| --- | --- | --- |
| Web UI | `http://127.0.0.1:3000` | Next.js app and BFF routes. |
| Hermes API | `http://127.0.0.1:8642` | Expected Hermes Agent API server URL. |
| Brain Memory Gateway | `http://127.0.0.1:8080` | Expected live Gateway URL when attached. |
| Brain Memory helper | `http://127.0.0.1:8765` | Common standalone helper URL while that helper is running. |

## Command Inventory

| Command | What it does |
| --- | --- |
| `npm install` | Installs workspace dependencies, including Playwright for browser smoke. |
| `npm run studio:env -- --list` | Lists available `.env.local` templates. |
| `npm run studio:env -- --mode web-ui-with-hermes` | Creates `apps/web/.env.local` for Web UI plus live Hermes. Refuses to overwrite without `--force`. |
| `npm run studio:doctor` | Checks repo shape, env, Hermes status, Brain Memory status, and BFF reachability without printing secrets. |
| `npm run studio:launch` | Safe launcher/checklist for env, Web UI, Hermes, Brain Memory mock/live state, stale static chunks, optional smoke, and browser open. |
| `npm run studio:launch -- --help` | Prints launcher usage, examples, flags, and safety boundaries without running diagnostics. |
| `npm run studio:launch -- --check --print-recovery-plan` | Prints the healthy-server recovery plan without executing it. |
| `npm run studio:launch:smoke` | Runs launcher checks plus route/BFF and browser smokes. |
| `npm run check:studio-launch` | Verifies the launcher help, base URL, JSON, redaction, recovery, and safety contract. |
| `npm run studio:web` | Optional explicit wrapper that starts only the Web UI dev server after checking the selected port. |
| `npm run studio:web:3002` | Convenience wrapper for starting only the Web UI on port `3002`. |
| `npm run dev` | Starts the Next.js Web UI on port 3000. |
| `npm run studio:open` | Opens `http://127.0.0.1:3000` in the local browser. |
| `npm run smoke:mvp` | Runs source, route, BFF, Hermes stream-if-live, and Brain Memory normalization smoke. |
| `npm run smoke:ui` | Runs browser-level interaction smoke with Playwright. |
| `npm run smoke:ui:headed` | Runs the browser smoke visibly for debugging. |
| `npm run smoke:ui:send` | Opt-in live composer send smoke. Requires real, reachable Hermes. |
| `npm run smoke:ui:send:headed` | Visible live composer send smoke for debugging. |
| `npm run smoke:ui:memory-live` | Opt-in live Brain Memory timeline smoke. Requires real Hermes and Brain Memory Gateway. |
| `npm run smoke:ui:memory-live:headed` | Visible live Brain Memory timeline smoke for debugging. |
| `npm run smoke:ui:memory-scope` | Opt-in live multi-session Brain Memory scope isolation smoke. Requires real Hermes and Brain Memory Gateway. |
| `npm run smoke:ui:memory-scope:headed` | Visible live multi-session scope isolation smoke for debugging. |
| `node scripts/mvp-smoke.mjs --require-hermes` | Requires Hermes BFF status and stream to be live. |
| `node scripts/mvp-smoke.mjs --require-brain-memory` | Requires live Brain Memory Gateway search/inspect through the BFF. |

## Quick Start: Web UI + Hermes

1. Install dependencies:

```powershell
npm install
```

2. Create or review the env template:

```powershell
npm run studio:env -- --list
npm run studio:env -- --mode web-ui-with-hermes
```

If `apps/web/.env.local` already exists, the command preserves it. Use `--force`
only when you intentionally want to replace local settings.

3. Start Hermes Agent API server if it is not already running. Then verify:

```powershell
curl http://127.0.0.1:8642/health
```

4. Start the Web UI:

```powershell
npm run studio:web
```

5. In another terminal, run the launch checks:

```powershell
npm run studio:launch -- --check
npm run studio:doctor
npm run smoke:mvp
npm run smoke:ui
```

6. Open the app:

```powershell
npm run studio:open
```

The browser should open `http://127.0.0.1:3000`.

## Local Studio Launcher

Slice 14A adds:

```powershell
npm run studio:launch
```

The launcher is a non-destructive local checklist. By default it:

- prints the inferred mode;
- checks Node/npm and `apps/web/.env.local`;
- checks the Web UI root at `http://127.0.0.1:3000`;
- checks referenced `/_next/static/**` assets to catch stale Next servers;
- checks Hermes through the Web UI BFF when the server is running;
- checks direct Hermes `/health` when `HERMES_API_BASE_URL` is configured;
- checks Brain Memory through the Web UI BFF when the server is running;
- checks direct Brain Memory `/health` only when live Gateway mode is enabled;
- scans Web UI ports `3000` through `3007` for likely/stale Studio servers;
- reports exact failing `/_next/static/**` assets when a stale server is found;
- probes common Brain Memory Gateway URLs `8080` and `8765` as warnings unless
  live Brain Memory is required;
- prints Windows/WSL/Linux process-hint commands for listener ownership;
- prints non-destructive guided recovery commands when stale or conflicting
  Studio servers are detected;
- accepts `--base-url` to make one Web UI URL the primary check and smoke
  target while still scanning nearby ports for confusion;
- accepts `--no-port-scan` when a narrow single-target check is needed;
- reminds the operator to use the production root `/` and 100% browser zoom;
- prints next commands.

Useful variants:

```powershell
npm run studio:launch -- --help
npm run studio:launch -- --check --verbose
npm run studio:launch -- --check --base-url http://127.0.0.1:3000
npm run studio:launch -- --check --recovery
npm run studio:launch -- --check --print-recovery-plan
npm run studio:launch -- --check --require-hermes
npm run studio:launch -- --smoke
npm run studio:launch -- --ui-smoke
npm run studio:launch -- --open
npm run studio:launch -- --dev-command
npm run studio:launch:smoke
```

The launcher does not start long-running services, install Hermes, install
Brain Memory, start Docker, stop Docker, modify `~/.hermes`, kill stale Next
processes, delete `.next`, print API keys, or implement export/import. See
`docs/packaging/STUDIO_LAUNCHER_14A.md` and
`docs/packaging/STUDIO_LAUNCHER_14B_PORT_DIAGNOSTICS.md`. Guided recovery is
documented in `docs/packaging/STUDIO_LAUNCHER_14C_GUIDED_RECOVERY.md`.
Launcher help and contract checks are documented in
`docs/packaging/STUDIO_LAUNCHER_14H_CONTRACT_TESTS.md`. Manual recovery from
stale/broken servers to one healthy selected server is documented in
`docs/runbooks/HEALTHY_STUDIO_SERVER_RECOVERY.md`.

When you explicitly want tooling to start only the Web UI, use:

```powershell
npm run studio:web -- --port 3002 --open --ui-smoke
```

`studio:web` refuses stale/broken or occupied selected ports, starts the Web UI
workspace Next CLI from `apps/web`, avoids `npm.cmd` for the long-running
dev-server child, never kills existing processes, never deletes `.next`, never
modifies env files, and does not manage Hermes, Brain Memory, Docker, or systemd
services. See `docs/packaging/STUDIO_WEB_DEV_14J.md` and
`docs/packaging/STUDIO_WEB_DEV_WINDOWS_HARDENING_14N.md`.

## Web UI Standalone / Mock Mode

Use this when Hermes or Brain Memory Gateway is not part of the current run:

```powershell
npm install
npm run studio:env -- --mode web-ui-only
npm run studio:web
npm run studio:doctor
npm run smoke:mvp
npm run smoke:ui
```

In this mode:

- project/session state remains local and usable;
- Brain Memory status/search/detail can report `mock`, `unconfigured`, or
  `disabled`;
- `npm run smoke:mvp` should pass with a Brain Memory mock/unconfigured warning;
- `npm run smoke:ui` should pass with the optional send-click warning;
- `node scripts/mvp-smoke.mjs --require-brain-memory` should fail honestly.

## Live Hermes Mode

Expected env:

```text
HERMES_API_BASE_URL=http://127.0.0.1:8642
HERMES_UI_ENABLE_REAL_HERMES=true
HERMES_API_KEY=<redacted if required by Hermes>
```

Verify Hermes directly:

```powershell
curl http://127.0.0.1:8642/health
```

Verify through the Web UI BFF:

```powershell
npm run studio:doctor
node scripts/mvp-smoke.mjs --require-hermes
npm run smoke:ui:send
```

If `--require-hermes` fails, check that Hermes is running, the API URL matches
`apps/web/.env.local`, and the Web UI server was restarted after env changes.

`npm run smoke:ui:send` opens an isolated Playwright browser context, types one
unique smoke message into the composer, clicks Send, waits for a new non-empty
assistant message, and verifies the BFF stream route returned HTTP 200. It does
not use the user's existing browser profile or localStorage.

## Live Brain Memory Mode

Expected env:

```text
BRAIN_MEMORY_GATEWAY_URL=http://127.0.0.1:8080
BRAIN_MEMORY_UI_ENABLE_REAL_GATEWAY=true
BRAIN_MEMORY_GATEWAY_MEMORY_API_KEY=<redacted tenant-bound read key>
BRAIN_MEMORY_UI_API_KEY=<optional redacted UI bearer>
BRAIN_MEMORY_MCP_API_KEY_SET=<optional redacted boolean for diagnostics>
```

Notes:

- `BRAIN_MEMORY_GATEWAY_MEMORY_API_KEY` authorizes tenant-bound search/detail
  from the Web UI BFF and is required for reliable Runs + Brain Memory live
  smokes unless Gateway local-dev bypass is intentionally enabled.
- `BRAIN_MEMORY_UI_API_KEY` is only the optional `/ui/**` bearer gate. A 401
  usually means this optional bearer is missing or invalid.
- A 403 on search/detail usually means the tenant-bound memory key is missing,
  wrong, or not authorized for the active tenant/scope.
- `BRAIN_MEMORY_MCP_API_KEY_SET` is a redacted diagnostics-only boolean. Hermes
  MCP still needs its own Brain Memory API key posture; do not copy the key
  value into docs or browser-visible config.
- Restart the Web UI process after changing `apps/web/.env.local`.

Verify Gateway directly:

```powershell
curl http://127.0.0.1:8080/health
```

For the sibling Brain Memory repository used during local development, the
documented Compose Gateway recovery command is:

```powershell
cd <brain-memory-repo>
powershell -ExecutionPolicy Bypass -File .\scripts\start-brain-memory.ps1
Invoke-RestMethod http://127.0.0.1:8080/health
Invoke-RestMethod http://127.0.0.1:8080/ready
```

If the Gateway key lives in Brain Memory's `GATEWAY_MEMORY_API_KEYS`, map a
tenant-authorized read key into the Web UI server process as
`BRAIN_MEMORY_GATEWAY_MEMORY_API_KEY`. Do not print the key, commit it, or send
it to browser JavaScript. Prefer a temporary process env when verifying a live
reconnect so `apps/web/.env.local` does not need to change.

For the local MVP contract, the canonical tenant is `local-dev`. The Web UI
local/mock workspace, Hermes MCP default tenant, and Gateway read/search
context should agree on `local-dev`. Legacy browser-local workspaces that used
the old default `tenant-local` are normalized on load when they match the old
default stable-key pattern.

Verify through the Web UI BFF:

```powershell
npm run studio:doctor
node scripts/mvp-smoke.mjs --require-brain-memory
```

Expected auth failure meanings:

- `401` / `unauthorized`: optional UI bearer is missing or invalid.
- `403` / `forbidden`: tenant-bound memory key is missing or unauthorized for
  the active smoke scope.

The UI must still access Brain Memory only through the Web UI BFF and Gateway.
Do not add direct browser-to-Gateway calls or direct storage access.

## Runs + Brain Memory Live Env Posture

Hermes Runs memory smokes use the same BFF readback path as the Brain Memory
console plus the Hermes MCP write path:

```text
script -> Web UI BFF /api/hermes/runs/memory-probe
  -> Hermes /v1/runs
  -> Hermes Brain Memory MCP -> Brain Memory Gateway
  -> Web UI BFF Brain Memory search/inspect readback
```

Required Web UI BFF env:

```text
HERMES_API_BASE_URL=http://127.0.0.1:8642
HERMES_UI_ENABLE_REAL_HERMES=true
BRAIN_MEMORY_GATEWAY_URL=http://127.0.0.1:8080
BRAIN_MEMORY_UI_ENABLE_REAL_GATEWAY=true
BRAIN_MEMORY_GATEWAY_MEMORY_API_KEY=<redacted tenant-bound read key>
BRAIN_MEMORY_UI_API_KEY=<optional redacted UI bearer if Gateway requires it>
```

Required Hermes MCP posture:

```text
BRAIN_MEMORY_GATEWAY_URL=http://127.0.0.1:8080
BRAIN_MEMORY_DEFAULT_TENANT_ID=local-dev
BRAIN_MEMORY_API_KEY=<redacted MCP/Gateway key>
BRAIN_MEMORY_CALLER_LABEL=<local caller label>
```

The canonical local MVP tenant is `local-dev`; Web UI project/session stable
keys, Hermes MCP default tenant, and Gateway key authorization should agree on
that tenant.

Verification:

```powershell
npm run smoke:hermes:runs:memory -- --base-url http://127.0.0.1:3002 --require-hermes --require-brain-memory
node scripts/mvp-smoke.mjs --require-hermes --require-brain-memory --base-url http://127.0.0.1:3002
```

The Runs memory probe prints redacted env posture and a normalized blocker
category when it fails. Categories include `hermes_unreachable`,
`brain_memory_disabled`, `brain_memory_gateway_unreachable`,
`brain_memory_key_missing`, `brain_memory_key_unauthorized`,
`brain_memory_ui_bearer_unauthorized`, `marker_not_stored`,
`marker_not_found`, `scope_mismatch`, `runs_mcp_failure`, and `unknown`.

## Smoke Test Matrix

| Command | Use |
| --- | --- |
| `npm run smoke:mvp` | Default route/source/BFF smoke. Accepts Brain Memory mock mode. |
| `npm run smoke:ui` | Browser interaction smoke for the MVP shell. |
| `npm run smoke:ui:headed` | Visible browser smoke for debugging layout or click issues. |
| `npm run smoke:ui:send` | Optional live composer send smoke. Requires real Hermes and sends one message. |
| `npm run smoke:ui:send:headed` | Visible optional live composer send smoke. |
| `npm run smoke:ui:memory-live` | Optional live Brain Memory timeline smoke. Requires real Hermes and Brain Memory Gateway. |
| `npm run smoke:ui:memory-live:headed` | Visible optional live Brain Memory timeline smoke. |
| `npm run smoke:ui:memory-scope` | Optional live multi-session Brain Memory scope isolation smoke. Requires real Hermes and Brain Memory Gateway. |
| `npm run smoke:ui:memory-scope:headed` | Visible optional live multi-session scope isolation smoke. |
| `node scripts/mvp-smoke.mjs --require-hermes` | Live Hermes gate. |
| `node scripts/mvp-smoke.mjs --require-brain-memory` | Live Brain Memory Gateway gate. |
| `npm run check:tenant-scope` | Verifies local MVP tenant/scope diagnostics, redaction, and strict same-tenant smoke boundaries. |
| `npm run check:workspace-state` | Project/session reducer and local state contract. |
| `npm run check:brain-memory-client` | Brain Memory client response shape contract. |
| `npm run check:studio-launch` | Studio launcher help, JSON shape, base URL, redaction, recovery, and safety contract. |
| `npm run check:packaging` | Packaging readiness source/docs/script contract. |
| `npm run release:check` | Safe non-browser release gate: packaging, launcher contract, state/client/activity/rendering/UI checks, typecheck, build, and audit. |
| `npm run check:ui-structure` | UI component structure and accessibility markers. |
| `npm run typecheck` | TypeScript validation. |
| `npm run build` | Production Next.js build. |
| `npm audit --audit-level=moderate` | Dependency vulnerability gate. |

Default MVP demo gate:

```powershell
npm run studio:doctor
npm run smoke:mvp
npm run smoke:ui
```

Bundle-ready gate when both services are live:

```powershell
node scripts/mvp-smoke.mjs --require-hermes --require-brain-memory
npm run smoke:ui
npm run smoke:ui:send
```

Packaging readiness gate:

```powershell
npm run check:packaging
npm run release:check
```

`release:check` intentionally excludes browser smokes and live-service gates.
Run those separately after `studio:launch -- --check --base-url <healthy-url>`
passes for the selected Web UI server.

## Browser Troubleshooting

### Browser Zoom / Scaling

If the UI looks too small, too large, or oddly cropped, check browser zoom first.
Use 100% zoom before judging layout. In Chrome or Edge, press `Ctrl+0` to reset.

### Playwright Browser Install

If `npm run smoke:ui` cannot launch a browser, install Chromium for Playwright:

```powershell
npx playwright install chromium
```

The harness tries Microsoft Edge first and then Playwright Chromium.

### Stale Dev Server Symptoms

Symptoms:

- old UI appears after a code change;
- browser smoke sees old ARIA labels or old click behavior;
- composer typing does not enable Send even though source/build changed;
- Next reports another dev server is already running.

Check the launcher first:

```powershell
npm run studio:launch -- --check
```

The launcher scans ports `3000` through `3007`, classifies reachable servers as
`likely-studio`, `stale-or-broken-studio`, `possible-studio-bff`,
`unrelated-server`, or `unreachable`, and prints exact failing static assets.

If the launcher finds stale or conflicting servers, ask it for print-only
recovery commands:

```powershell
npm run studio:launch -- --check --recovery
npm run studio:launch -- --check --print-recovery-plan
```

If no healthy Studio server is found, follow
`docs/runbooks/HEALTHY_STUDIO_SERVER_RECOVERY.md`: identify listener ownership,
stop stale servers manually after verifying ownership if needed, start only the
Web UI with `studio:web`, then verify a selected base URL before running
browser smokes.

If port `3000` is stale, start a fresh server on an unused explicit port such
as `3002`:

```powershell
npm run studio:web -- --port 3002 --open --ui-smoke
npm run studio:launch -- --check --base-url http://127.0.0.1:3002
```

If port `3000` is healthy and another port is stale, pin follow-up checks and
smokes to `3000`. If the healthy server is on another port, replace the URL
with that healthy selected base URL:

```powershell
npm run studio:launch -- --check --base-url http://127.0.0.1:3000
npm run studio:launch -- --check --smoke --ui-smoke --base-url http://127.0.0.1:3000
```

All smoke commands accept the same explicit base URL form:

```powershell
npm run smoke:mvp -- --base-url http://127.0.0.1:3000
npm run smoke:ui -- --base-url http://127.0.0.1:3000
npm run smoke:ui:memory-scope -- --base-url http://127.0.0.1:3000
npm run smoke:markdown -- --base-url http://127.0.0.1:3000
npm run smoke:markdown:long -- --base-url http://127.0.0.1:3000
```

Browser smokes check a bounded sample of `/_next/static/**` chunks before deep
interaction. If the selected server has stale chunks, the smoke fails early and
prints the selected base URL plus manual recovery guidance. Markdown smokes test
the selected base URL directly; they do not silently switch to another port. Do
not run browser smokes without `--base-url` while the default `3000` server is
stale.

If you need to inspect ownership manually on Windows:

```powershell
$ports = @(3000,3001,3002,3003,3004,3005,3006,3007)
Get-NetTCPConnection -ErrorAction SilentlyContinue | Where-Object { $ports -contains $_.LocalPort -and $_.State -eq 'Listen' } | Select-Object LocalAddress,LocalPort,State,OwningProcess
Get-Process -Id <OwningProcess>
```

If the process is an old local `node` or `next` server you own, stop it
manually from the terminal that owns it, or use your OS process manager after
verifying the PID. Then restart:

```powershell
npm run studio:web
```

If stale assets persist, stop the server, confirm the repo path, remove only the
web app build cache as a last manual/destructive step, then restart:

```powershell
Remove-Item -Recurse -Force apps\web\.next
npm run studio:web
```

Do not run broad recursive delete commands outside the repo or without checking
the path first.

The launcher may print cache removal commands as guarded manual recovery
options. It never executes them.

If the browser shows a good app in one place and an old or broken app in
another, confirm both browsers are using the same host/port and the production
root route `/`, not `/design/codex-shell`. Reset Chrome or Edge zoom to 100%
with `Ctrl+0` before judging layout.

## WSL / Windows Notes

- Use the Windows repo path from Windows terminals and the WSL-mounted path from
  WSL terminals; avoid mixing shells in the same command sequence.
- `127.0.0.1` usually works from both Windows and WSL2, but service ownership
  matters. Start Hermes, Gateway, and Web UI in the environment where you expect
  to reach them.
- `npm run studio:open` tries the appropriate OS browser opener, including a
  Windows browser from WSL when available.
- `npm run studio:web -- --dry-run` prints the exact Web UI dev command.
- `studio:web` invokes the long-running Next CLI with Node to avoid Windows
  `npm.cmd` `spawn EINVAL`, pipes child logs instead of inheriting hidden
  Windows automation stdio handles, then forwards `Ctrl+C` only to the child
  process it started.
- On Windows the launcher uses PowerShell `Get-NetTCPConnection` to parse
  listeners on ports `3000` through `3007`.
- On Linux the launcher suggests `ss -ltnp` and parses it when available.
- On WSL the launcher also prints a PowerShell listener command for checking
  Windows-owned servers.
- Do not hardcode personal absolute paths in committed docs or scripts.

## Secrets Safety

- Do not commit `apps/web/.env.local`.
- Do not print API keys in logs, docs, screenshots, or issue comments.
- Use `<redacted>` placeholders in docs.
- Prefer env templates under `env/*.env.example` for shareable settings.
- The BFF may read secrets server-side; browser JavaScript must not receive API
  keys.

## Known Deferred Features

- Real stop/cancel streaming.
- Provider/model selector polish.
- Durable evidence/supersession storage.
- Production one-command CLI.
- Full auth/classification model.
- Memory mutation/admin actions.
