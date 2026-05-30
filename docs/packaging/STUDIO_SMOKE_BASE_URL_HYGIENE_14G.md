# Studio Smoke Base URL Hygiene 14G

Date: 2026-05-31

## Purpose

Slice 14G tightens stale-server recovery and smoke base URL behavior after
repeated false failures from old Next servers on local ports. It keeps the
launcher and smoke scripts non-destructive: no process killing, no `.next`
deletion, no service startup, and no backend behavior changes.

## Files Changed

- `scripts/smoke-base-url.mjs`
- `scripts/studio-launch.mjs`
- `scripts/ui-interaction-smoke.mjs`
- `scripts/mvp-smoke.mjs`
- `scripts/markdown-fixture-smoke.mjs`
- `scripts/markdown-long-fixture-smoke.mjs`
- `scripts/open-studio-browser.mjs`
- `docs/packaging/STUDIO_SMOKE_BASE_URL_HYGIENE_14G.md`
- `docs/packaging/STUDIO_LAUNCHER_14C_GUIDED_RECOVERY.md`
- `docs/runbooks/MVP_LOCAL_LAUNCH_RUNBOOK.md`
- `README.md`
- `ROADMAP.md`

## Base URL Standardization

Smoke and browser-related scripts now consistently use:

```powershell
--base-url http://127.0.0.1:3000
```

The default remains:

```text
http://127.0.0.1:3000
```

The scripts print the selected base URL at the start of non-JSON runs:

- `npm run smoke:mvp`
- `npm run smoke:ui`
- `npm run smoke:markdown`
- `npm run smoke:markdown:long`
- `npm run studio:open -- --base-url ...`

Markdown smokes no longer silently auto-discover another local port when the
default server is stale. They test the selected base URL and fail with recovery
guidance if that server is stale or missing the fixture route.

## Static Chunk Preflight

Browser smokes now run a lightweight preflight before deep interaction:

1. request `/` from the selected base URL;
2. parse a bounded sample of `/_next/static/**` CSS/JS references;
3. verify the sampled chunks return HTTP 2xx;
4. fail early if chunks fail.

Failure messages include:

- selected base URL;
- failing chunk paths/status;
- likely stale Next server wording;
- manual recovery guidance;
- an example of running against a healthy server with `--base-url`.

This prevents hydration and click failures from being misread as UI regressions.

## Launcher Coordination

`studio:launch` still scans ports `3000` through `3007` unless
`--no-port-scan` is passed.

Selected server behavior:

- selected stale/broken server: required failure with explicit
  "You are testing against stale server ..." guidance;
- selected healthy server plus other stale servers: warning only;
- stale non-selected servers: warning only, because they can still confuse
  browser tabs;
- healthy server found elsewhere: recommended explicit `--base-url` command.

`studio:launch:smoke` now passes the selected base URL to:

- `smoke:mvp`;
- `smoke:ui`;
- `smoke:markdown`;
- `smoke:markdown:long`.

The markdown smoke commands are included only when their scripts exist.

## Recovery Guidance

Printed recovery guidance is manual and safe. It may include:

```powershell
powershell.exe -NoProfile -Command "$ports = @(3000,3005); Get-NetTCPConnection -ErrorAction SilentlyContinue | Where-Object { $ports -contains $_.LocalPort -and $_.State -eq 'Listen' } | Select-Object LocalAddress,LocalPort,State,OwningProcess"
```

```bash
ss -ltnp | grep ':3000' ; ss -ltnp | grep ':3005'
```

```powershell
npm run smoke:ui -- --base-url http://127.0.0.1:3002
```

```powershell
npm run dev
npm run studio:launch -- --check
```

Guarded cache cleanup remains printed only and should be used only after the
server is stopped and the repo path is confirmed:

```powershell
Remove-Item -Recurse -Force apps\web\.next
```

```bash
rm -rf apps/web/.next
```

## Examples

Check the selected default:

```powershell
npm run studio:launch -- --check
```

Check a known healthy server:

```powershell
npm run studio:launch -- --check --base-url http://127.0.0.1:3002
```

Run smokes against a selected server:

```powershell
npm run studio:launch:smoke -- --base-url http://127.0.0.1:3002
```

Run direct smokes:

```powershell
npm run smoke:mvp -- --base-url http://127.0.0.1:3002
npm run smoke:ui -- --base-url http://127.0.0.1:3002
npm run smoke:markdown -- --base-url http://127.0.0.1:3002
npm run smoke:markdown:long -- --base-url http://127.0.0.1:3002
```

## Safety Boundaries

Slice 14G does not:

- auto-kill Node or Next processes;
- auto-delete `.next`;
- auto-start or auto-stop services;
- modify `~/.hermes`;
- change UI design;
- change Hermes streaming;
- change Brain Memory BFF logic;
- change memory scope bridging;
- add direct browser-to-Hermes or browser-to-Brain-Memory calls;
- add direct storage access;
- implement auth/classification;
- implement export/import;
- add memory mutation/admin actions.

## Known Limitations

- The launcher cannot know which terminal the operator intends to keep.
- Static preflight samples a bounded set of chunks rather than every possible
  asset.
- A stale selected server is now a real failure; run against a healthy base URL
  or restart the selected server.

## Next Recommended Slice

Slice 14H - Launcher Contract Tests And Help Output.

Reason: Slice 14G tightens runtime diagnostics. The next useful increment is a
small source-level contract test for launcher/smoke CLI parsing, JSON shape,
and help/usage output, without adding service management.
