# Healthy Studio Server Recovery

Date: 2026-05-31

This runbook gets Hermes UI / Brain Memory Studio from stale or broken local
Next servers to one healthy selected Web UI server. It is manual and
non-destructive by default. The launcher may print these steps, but it does not
execute recovery commands.

## When To Use This

Use this when the launcher reports:

- `No healthy Studio server found`;
- selected base URL is `stale-or-broken-studio`;
- `/_next/static/**` chunks return HTTP `500` or fail to load;
- multiple stale Studio ports may confuse browser tabs or Playwright.

Do not run browser smokes against a stale selected base URL. First verify one
healthy selected base URL, then pass that URL to every smoke command with
`--base-url`.

## 1. Diagnose Current State

Run:

```powershell
npm run studio:launch -- --check --verbose
```

Read the `Port diagnostics` section. A healthy server is classified as
`likely-studio`. A stale server is classified as `stale-or-broken-studio` and
usually lists failing static chunks.

For a print-only recovery view:

```powershell
npm run studio:launch -- --check --print-recovery-plan
```

`--print-recovery-plan` is an alias for the launcher recovery view. It does not
start, stop, kill, delete, or modify anything.

## 2. Identify Listeners

On WSL/Linux:

```bash
ss -ltnp | grep -E ':3000|:3001|:3002|:3003|:3004|:3005|:3006|:3007'
```

On Windows:

```powershell
powershell.exe -NoProfile -Command "Get-NetTCPConnection -LocalPort 3000,3001,3002,3003,3004,3005,3006,3007 | Select-Object LocalAddress,LocalPort,State,OwningProcess"
```

If you need more detail on Windows, inspect a specific owning process manually
after verifying the PID shown by `Get-NetTCPConnection`.

## 3. Stop The Stale Server Manually

Preferred path:

1. Find the terminal that owns the stale Next server.
2. Stop that server from its terminal.
3. Re-run the launcher check.

If the terminal is unknown, use your OS process manager manually after verifying
the PID and confirming it is a local Node/Next server you own.

The launcher does not stop processes automatically.

## 4. Start A Fresh Server

Preferred optional wrapper:

```powershell
npm run studio:web
```

Explicit alternate port, useful when `3000` remains stale or occupied:

```powershell
npm run studio:web -- --port 3002 --open --ui-smoke
```

The wrapper starts only the Web UI dev server. It checks whether the selected
port is stale, broken, or occupied before starting, and it refuses to stop
existing processes. If you only want to preview the decision:

```powershell
npm run studio:web -- --port 3002 --dry-run
```

The wrapper ultimately runs the root `dev` script because it delegates to
`@hermes-ui/web`, whose `dev` script is `next dev`. You can still run
`npm run dev` manually, but `studio:web` is the safer recovery entry point.

There is currently no committed root or web `start` script for `next start`, so
production-server recovery is not documented as a runnable command in this
repo. Use the development server path above unless a future slice adds an
explicit `start` script.

## 5. Verify The Healthy Server

Replace `<port>` with the server you intentionally started:

```powershell
npm run studio:launch -- --check --base-url http://127.0.0.1:<port>
```

Only continue when the selected base URL is not stale and static chunks pass.

Then run browser and fixture smokes against the same selected base URL:

```powershell
npm run smoke:ui -- --base-url http://127.0.0.1:<port>
npm run smoke:markdown -- --base-url http://127.0.0.1:<port>
npm run smoke:markdown:long -- --base-url http://127.0.0.1:<port>
```

If you need the MVP route/BFF smoke:

```powershell
npm run smoke:mvp -- --base-url http://127.0.0.1:<port>
```

Do not run smokes without `--base-url` while `3000` is stale.

## 6. Browser Route Guidance

- The production UI is `/`.
- `/design/codex-shell` is a reference/prototype route, not the app smoke
  target.
- Keep Chrome or Edge zoom at 100%; press `Ctrl+0` before judging layout.
- If a browser looks old, confirm the selected host/port and re-check static
  chunks with the launcher.

## 7. Last-Resort `.next` Cleanup

Use this only after stopping the server and confirming the repo path. It is
manual/destructive and should not be the first recovery step.

Windows:

```powershell
Remove-Item -Recurse -Force apps\web\.next
```

WSL/Linux/macOS:

```bash
rm -rf apps/web/.next
```

Then restart the dev server and verify again:

```powershell
npm run studio:web
npm run studio:launch -- --check --base-url http://127.0.0.1:3000
```

The launcher never runs cache cleanup automatically.

The Web UI wrapper also never runs cache cleanup. When the wrapper starts a dev
server, pressing `Ctrl+C` stops only the child process that wrapper started.

## Safety Boundary

This workflow does not:

- auto-kill processes;
- auto-delete `.next`;
- auto-start or auto-stop services;
- start or stop Docker;
- modify `~/.hermes`;
- modify `apps/web/.env.local`;
- install services;
- print API keys;
- change Hermes streaming logic;
- change Brain Memory BFF logic;
- add direct browser-to-service paths;
- implement export/import.
