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

## Command Inventory

| Command | What it does |
| --- | --- |
| `npm install` | Installs workspace dependencies, including Playwright for browser smoke. |
| `npm run studio:env -- --list` | Lists available `.env.local` templates. |
| `npm run studio:env -- --mode web-ui-with-hermes` | Creates `apps/web/.env.local` for Web UI plus live Hermes. Refuses to overwrite without `--force`. |
| `npm run studio:doctor` | Checks repo shape, env, Hermes status, Brain Memory status, and BFF reachability without printing secrets. |
| `npm run dev` | Starts the Next.js Web UI on port 3000. |
| `npm run studio:open` | Opens `http://127.0.0.1:3000` in the local browser. |
| `npm run smoke:mvp` | Runs source, route, BFF, Hermes stream-if-live, and Brain Memory normalization smoke. |
| `npm run smoke:ui` | Runs browser-level interaction smoke with Playwright. |
| `npm run smoke:ui:headed` | Runs the browser smoke visibly for debugging. |
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
npm run dev
```

5. In another terminal, run the launch checks:

```powershell
npm run studio:doctor
npm run smoke:mvp
npm run smoke:ui
```

6. Open the app:

```powershell
npm run studio:open
```

The browser should open `http://127.0.0.1:3000`.

## Web UI Standalone / Mock Mode

Use this when Hermes or Brain Memory Gateway is not part of the current run:

```powershell
npm install
npm run studio:env -- --mode web-ui-only
npm run dev
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
```

If `--require-hermes` fails, check that Hermes is running, the API URL matches
`apps/web/.env.local`, and the Web UI server was restarted after env changes.

## Live Brain Memory Mode

Expected env:

```text
BRAIN_MEMORY_GATEWAY_URL=http://127.0.0.1:8080
BRAIN_MEMORY_UI_ENABLE_REAL_GATEWAY=true
BRAIN_MEMORY_GATEWAY_MEMORY_API_KEY=<redacted tenant-bound read key>
BRAIN_MEMORY_UI_API_KEY=<optional redacted UI bearer>
```

Notes:

- `BRAIN_MEMORY_GATEWAY_MEMORY_API_KEY` authorizes tenant-bound search/detail.
- `BRAIN_MEMORY_UI_API_KEY` is only the optional `/ui/**` bearer gate.
- Restart the Web UI process after changing `apps/web/.env.local`.

Verify Gateway directly:

```powershell
curl http://127.0.0.1:8080/health
```

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

## Smoke Test Matrix

| Command | Use |
| --- | --- |
| `npm run smoke:mvp` | Default route/source/BFF smoke. Accepts Brain Memory mock mode. |
| `npm run smoke:ui` | Browser interaction smoke for the MVP shell. |
| `npm run smoke:ui:headed` | Visible browser smoke for debugging layout or click issues. |
| `node scripts/mvp-smoke.mjs --require-hermes` | Live Hermes gate. |
| `node scripts/mvp-smoke.mjs --require-brain-memory` | Live Brain Memory Gateway gate. |
| `npm run check:workspace-state` | Project/session reducer and local state contract. |
| `npm run check:brain-memory-client` | Brain Memory client response shape contract. |
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
```

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

Check port 3000:

```powershell
Get-NetTCPConnection -LocalPort 3000 -State Listen | Select-Object LocalAddress,LocalPort,OwningProcess
Get-Process -Id <OwningProcess>
```

If the process is an old local `node` or `next` server you own, stop it:

```powershell
Stop-Process -Id <OwningProcess>
```

Then restart:

```powershell
npm run dev
```

If stale assets persist, stop the server, remove only the web app build cache,
then restart:

```powershell
Remove-Item -Recurse -Force apps\web\.next
npm run dev
```

Do not run broad recursive delete commands outside the repo or without checking
the path first.

## WSL / Windows Notes

- Use the Windows repo path from Windows terminals and the WSL-mounted path from
  WSL terminals; avoid mixing shells in the same command sequence.
- `127.0.0.1` usually works from both Windows and WSL2, but service ownership
  matters. Start Hermes, Gateway, and Web UI in the environment where you expect
  to reach them.
- `npm run studio:open` tries the appropriate OS browser opener, including a
  Windows browser from WSL when available.
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
