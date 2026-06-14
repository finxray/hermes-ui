# Local Startup Guide

This guide covers modular local startup paths. None of these paths install
Brain Memory automatically or start external services for you.

For the current MVP demo runbook, smoke-test matrix, stale dev-server recovery,
browser scaling notes, and secrets checklist, see
`docs/runbooks/MVP_LOCAL_LAUNCH_RUNBOOK.md`.

For the consolidated local MVP / RC bundle path, start with
`docs/packaging/LOCAL_BUNDLE_CHECKLIST_14O.md`.

## A. Web UI Standalone With Hermes

Use this when Hermes API server is running and Brain Memory is not required.

1. Enable/start Hermes API server.
2. Verify Hermes health:

```powershell
curl http://127.0.0.1:8642/health
```

3. Install dependencies:

```powershell
npm install
```

4. Create local env:

```powershell
npm run studio:env -- --mode web-ui-with-hermes
```

5. Check the setup:

```powershell
npm run studio:doctor
```

6. Start the Web UI:

```powershell
npm run studio:web
```

7. Open the app:

```powershell
npm run studio:open
```

## B. Web UI Standalone Without Live Hermes

Use this when you only want the UI shell and local mock/unconfigured states.

```powershell
npm install
npm run studio:env -- --mode web-ui-only
npm run studio:web
npm run studio:open
```

Hermes and Brain Memory will show disabled/mock/unconfigured states. Local
project/session persistence still works in the browser.

## C. Web UI + Brain Memory Bundle Planned Path

The recommended future path is Web UI + Hermes + Brain Memory Gateway together.
Slice 09B only adds the env template and docs. It does not install or start
Brain Memory.

Template:

```powershell
npm run studio:env -- --mode bundle
```

Before using this mode, make sure:

- Hermes API server is reachable;
- Brain Memory Gateway HTTP UI/read-only endpoint is reachable;
- if the Gateway protects `/ui/**`, `BRAIN_MEMORY_UI_API_KEY` is set;
- for real memory search, `BRAIN_MEMORY_GATEWAY_MEMORY_API_KEY` matches a
  tenant-bound read key in Brain Memory `GATEWAY_MEMORY_API_KEYS`;
- `BRAIN_MEMORY_UI_ENABLE_REAL_GATEWAY=true` is intentional.

## D. Attach Brain Memory Later

Use this after starting in Web UI standalone mode.

1. Install/start Brain Memory using its own project instructions.
2. Prepare attach env:

```powershell
npm run studio:env -- --mode attach-brain-memory-later
```

3. Edit `apps/web/.env.local`:

```text
BRAIN_MEMORY_GATEWAY_URL=http://127.0.0.1:8765
BRAIN_MEMORY_UI_API_KEY=
BRAIN_MEMORY_GATEWAY_MEMORY_API_KEY=<tenant-bound read key>
BRAIN_MEMORY_UI_ENABLE_REAL_GATEWAY=true
```

4. Run:

```powershell
npm run studio:doctor
```

When Gateway is reachable, the Brain Memory console should switch from
attach-later/mock to real status/search.

`BRAIN_MEMORY_UI_API_KEY` is only an optional UI/BFF bearer gate. It does not
authorize tenant memory reads by itself. `/ui/memory/search` uses
`X-Gateway-Memory-Api-Key`, sourced from `BRAIN_MEMORY_GATEWAY_MEMORY_API_KEY`,
and the active project tenant comes from the UI context contract.

## E. Brain Memory Standalone

Brain Memory remains a separate standalone backend/MCP/Gateway project. This
Web UI is optional and does not install Brain Memory yet.

Use Brain Memory standalone when you only need its backend/MCP/Gateway behavior.
Use this Web UI when you want a ChatGPT-like Studio surface on top of Hermes and
Gateway-approved Brain Memory inspection.

## F. Full Local Stack (Windows + WSL + Docker)

When Hermes runs in WSL, Brain Memory uses Docker Desktop, and the Web UI runs
on Windows, use the stack launcher from the Hermes UI repo root:

```powershell
npm run studio:stack
```

Dry run (planned actions only):

```powershell
npm run studio:stack -- -DryRun
```

The launcher:

1. starts Docker Desktop when the engine is down and waits for `docker info`;
2. runs Brain Memory's sanctioned `scripts/start-brain-memory.ps1` from the
   sibling `../brain-memory` repo (override with `STUDIO_BRAIN_MEMORY_REPO`);
3. starts Hermes gateway in WSL via `hermes gateway start` when
   `http://127.0.0.1:8642/health` is down (distro default `Ubuntu`, override
   with `STUDIO_WSL_DISTRO`);
4. starts or verifies the Web UI with `npm run studio:web` on port `3000`;
5. probes Brain Memory `/health` and `/ready`, Hermes `/health`, and the Web UI.

It does **not** modify `.env.local`, print API keys, or install services.

If Docker Desktop stalls on login, license, update, or WSL prompts, complete
those in the GUI and re-run the command.

After the stack is up:

```powershell
npm run studio:launch -- --check --base-url http://127.0.0.1:3000
npm run studio:doctor
```
