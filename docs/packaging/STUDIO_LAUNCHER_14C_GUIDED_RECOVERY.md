# Studio Launcher 14C Guided Recovery

Date: 2026-05-31

## Purpose

Slice 14C makes the local Studio launcher more useful after it detects stale or
conflicting Web UI servers. It adds print-only recovery guidance and explicit
base URL selection while preserving the launcher as a safe diagnostic/checker.

The launcher still does not install, start, stop, kill, delete, mutate, or
configure external services.

## Files Changed

- `scripts/studio-launch.mjs`
- `docs/packaging/STUDIO_LAUNCHER_14B_PORT_DIAGNOSTICS.md`
- `docs/packaging/STUDIO_LAUNCHER_14C_GUIDED_RECOVERY.md`
- `docs/runbooks/MVP_LOCAL_LAUNCH_RUNBOOK.md`
- `ROADMAP.md`

## Recovery Guidance Behavior

When a stale or broken Studio server is detected, the launcher now prints:

- affected base URL and port;
- exact failing `/_next/static/**` chunk paths and status codes;
- likely causes: stale Next server after a build, old static chunks, or the
  wrong process serving Studio;
- print-only listener ownership commands;
- restart/recheck commands;
- guarded `.next` removal commands clearly marked manual/destructive.

Example:

```powershell
npm run studio:launch -- --check --recovery
```

The `--recovery` flag does not execute recovery commands. It only changes the
section title to make the recovery section easier to spot in terminal output.

## Base URL Selection

The launcher now accepts:

```powershell
npm run studio:launch -- --check --base-url http://127.0.0.1:3000
```

The selected base URL is the primary target for:

- `/`;
- active root static asset check;
- `/api/hermes/status`;
- `/api/brain-memory/status`;
- direct launcher smoke command targets;
- browser open command.

The launcher still scans localhost ports `3000` through `3007` by default so it
can detect stale or confusing nearby servers. Use `--no-port-scan` only for a
narrow single-target diagnostic.

When multiple healthy Studio-like servers are found, the launcher recommends a
canonical target:

1. prefer healthy `http://127.0.0.1:3000`;
2. otherwise use the first healthy Studio-like server found;
3. ask the operator to pass `--base-url` explicitly for follow-up checks.

## Smoke Command Wiring

`--smoke` and `--ui-smoke` now pass the selected base URL to the existing smoke
scripts:

```powershell
npm run studio:launch -- --check --smoke --ui-smoke --base-url http://127.0.0.1:3000
```

This uses:

- `scripts/mvp-smoke.mjs --base-url <selected-url>`;
- `scripts/ui-interaction-smoke.mjs --base-url <selected-url>`.

No smoke script behavior was changed beyond using the already-supported
`--base-url` option.

## Stale Server Example

On the Slice 14C checkpoint machine:

- `http://127.0.0.1:3000` was the selected and healthy Studio server;
- `http://127.0.0.1:3005` was stale/broken;
- `3005` returned HTTP `500` for two CSS chunks;
- the launcher recommended keeping follow-up checks on `3000` and manually
  inspecting the process that owns `3005`.

## WSL And Windows Commands

Windows listener ownership example:

```powershell
powershell.exe -NoProfile -Command "$ports = @(3005); Get-NetTCPConnection -ErrorAction SilentlyContinue | Where-Object { $ports -contains $_.LocalPort -and $_.State -eq 'Listen' } | Select-Object LocalAddress,LocalPort,State,OwningProcess"
```

WSL/Linux listener ownership example:

```bash
ss -ltnp | grep ':3005'
```

The launcher prints these as manual hints only. It does not call
`Stop-Process`, `kill`, Docker, or systemd.

## JSON Output Changes

`--json` now includes:

- top-level `selectedBaseUrl`;
- `diagnostics.selectedBaseUrl`;
- `diagnostics.healthyStudioPorts[]`;
- `diagnostics.brokenStudioPorts[]`;
- `diagnostics.staticChunkFailures[]`;
- `diagnostics.recommendedActions[]`;
- `diagnostics.recoveryCommands[]`;
- `summary.warnings[]`;
- `summary.failures[]`.

Secrets remain redacted. Recovery commands are plain strings intended for
display or future tooling, not commands that the launcher executes.

## Safety Boundaries

Slice 14C does not:

- auto-kill processes;
- delete `.next`;
- start or stop Docker;
- start or stop systemd;
- install Hermes;
- install Brain Memory;
- modify `~/.hermes`;
- modify `apps/web/.env.local`;
- print API keys;
- change Hermes streaming logic;
- change Brain Memory BFF logic;
- change memory scope bridge behavior;
- change UI product behavior;
- add direct browser-to-Hermes calls;
- add direct browser-to-Gateway calls;
- add direct storage access;
- implement export/import.

## Example Commands

Default check:

```powershell
npm run studio:launch -- --check
```

Focused recovery output:

```powershell
npm run studio:launch -- --check --recovery
```

Select healthy port `3000` while still scanning nearby ports:

```powershell
npm run studio:launch -- --check --base-url http://127.0.0.1:3000
```

Run launcher and smokes against selected port:

```powershell
npm run studio:launch -- --check --smoke --ui-smoke --base-url http://127.0.0.1:3000
```

Narrow single-target check:

```powershell
npm run studio:launch -- --check --base-url http://127.0.0.1:3000 --no-port-scan
```

## Next Recommended Slice

Slice 14D - Launcher Safety Tests And Help Output.

Reason: Slice 14C adds new CLI flags and structured recovery output. The next
increment should add a lightweight script-level contract test for argument
parsing, base URL propagation, JSON shape, and `--help`/usage text without
adding service management.
