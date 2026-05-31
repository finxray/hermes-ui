# Studio Web Dev Wrapper 14J

Date: 2026-05-31

## Purpose

Slice 14J adds an explicit, optional Web UI dev-server wrapper:

```powershell
npm run studio:web -- --port 3002 --open --ui-smoke
```

The wrapper exists for local recovery and demo setup when the selected Studio
port may be stale, broken, or occupied. It starts only the Next.js Web UI dev
server and keeps `npm run studio:launch` as the diagnostics/checklist command.

## New Scripts

| Script | Purpose |
| --- | --- |
| `npm run studio:web` | Checks the selected Web UI port and starts only the Web UI dev server when safe. |
| `npm run studio:web:3002` | Convenience alias for `studio:web` on port `3002`. |

Useful forms:

```powershell
npm run studio:web -- --help
npm run studio:web -- --port 3002 --dry-run
npm run studio:web -- --port 3002 --open
npm run studio:web -- --port 3002 --open --ui-smoke
npm run studio:web -- --port 3002 --smoke --ui-smoke
```

`--json` is intentionally limited to dry-run/refusal output because the real
dev server is long-running and streams Next.js logs directly.

## What It Does

- accepts `--host` and `--port`, defaulting to `127.0.0.1:3000`;
- checks the selected root route before starting;
- checks a bounded sample of referenced `/_next/static/**` assets;
- checks `/api/hermes/status` only to classify whether the selected port looks
  like the Studio BFF;
- refuses selected stale/broken Studio ports;
- refuses occupied non-Studio ports;
- suggests a free local port in `3000` through `3007` when possible;
- starts the `apps/web` workspace Next CLI with explicit `--hostname` and
  `--port`;
- avoids `npm.cmd` for the long-running dev-server child because direct
  `spawn("npm.cmd", ...)` can fail with `EINVAL` in this automation
  environment;
- still uses `npm.cmd` when running one-shot npm smoke commands under Windows
  Node and `npm` under Linux, WSL, and macOS;
- pipes child stdout/stderr to the wrapper console instead of inheriting hidden
  automation handles;
- waits for the selected root route and sampled `/_next/static/**` chunks to
  become healthy;
- optionally opens the selected base URL after it is healthy;
- optionally runs `smoke:mvp` and/or `smoke:ui` against the selected base URL;
- forwards Ctrl+C to only the Web UI child process it started.

## What It Does Not Do

`studio:web` does not manage Hermes and does not manage Brain Memory.
`studio:web` does not implement export/import. More specifically, it does not:

- manage Hermes services;
- manage Brain Memory services;
- manage Docker or systemd services;
- modify `~/.hermes`;
- kill existing processes automatically;
- delete `.next`;
- modify env files;
- install dependencies;
- print API keys;
- change Hermes streaming logic;
- change Brain Memory BFF logic;
- add direct browser-to-Gateway calls;
- add direct browser-to-Hermes calls;
- add direct storage access;
- implement auth/classification;
- implement export/import.

## Port And Stale-Server Behavior

If the selected port is free, `studio:web` may start the Web UI there.

If the selected port is already a healthy Studio server, `studio:web` does not
start a second server. It can still run `--open`, `--smoke`, or `--ui-smoke`
against that selected base URL.

If the selected port is stale or broken, the command exits non-zero and prints
a suggested alternate port when one is available:

```powershell
npm run studio:web -- --port 3002 --open --ui-smoke
```

If the selected port is occupied by another service, the command also exits
non-zero. It never stops the listener. The user must inspect ownership and stop
old servers manually if that is appropriate.

## Port 3002

The wrapper supports port `3002` explicitly:

```powershell
npm run studio:web -- --port 3002
npm run studio:web:3002
```

Use dry-run first when recovering from stale `3000`:

```powershell
npm run studio:web -- --port 3002 --dry-run
```

## Ctrl+C Behavior

When `studio:web` starts a dev server, it keeps that child process attached to
the terminal. Pressing `Ctrl+C` sends `SIGINT` only to the child process started
by this wrapper, then exits the wrapper. Existing servers on other ports are
left alone.

Slice 14N hardened this path for Windows and WSL. The wrapper no longer relies
on inherited stdio handles, which can be invalid in hidden or redirected
automation on Windows. It still streams child logs to the console by piping
stdout/stderr, and it handles child spawn errors such as `EINVAL` with an
explicit startup failure instead of crashing. On Windows, Ctrl+C cleanup is
limited to the process tree rooted at the wrapper's own child PID so nested
`cmd.exe`/npm/Next processes do not remain orphaned.

## Windows / WSL Behavior

On Windows Node, the wrapper starts the long-running dev server as:

```powershell
cd apps/web && node ..\..\node_modules\next\dist\bin\next dev --hostname 127.0.0.1 --port <port>
```

On WSL/Linux/macOS, the command shape is the same with the platform's Node
binary:

```bash
cd apps/web && node ../../node_modules/next/dist/bin/next dev --hostname 127.0.0.1 --port <port>
```

This avoids both the Windows/npm argument-forwarding caveat seen when the root
workspace script was used during the Slice 14M RC dry run and the reproduced
direct `spawn("npm.cmd", ...)` `EINVAL` under hidden automation. It still keeps
service ownership simple: the wrapper starts one Web UI child process and only
signals that child on shutdown.

Dry-run output prints the exact command shape for the current platform, and
`--json` exposes the same redacted command string for dry-run/refusal checks.

## Relationship To Existing Launcher

`npm run studio:launch` remains the safe checklist for diagnostics, route/BFF
checks, stale static chunk detection, selected base URL validation, and print-only
recovery guidance.

`npm run studio:web` is the explicit opt-in start command for only the Web UI.
It is not the deferred production one-command CLI and does not orchestrate live
Hermes or Brain Memory.

## Checks

The launcher contract check now covers the wrapper:

```powershell
npm run check:studio-launch
```

It verifies script wiring, supported flags, stale-server refusal, selected-base
smoke commands, Ctrl+C child-process behavior, documentation, and safety
boundaries.

## Next Recommended Slice

Slice 14K - Packaging readiness manifest and release gate.

Reason: the local launcher now diagnoses, the recovery runbook is explicit, and
the optional Web UI-only start wrapper exists. The next useful packaging slice
is to capture a concise readiness manifest and release gate without adding
service orchestration.
