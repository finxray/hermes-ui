# Studio Launcher 14B Port Diagnostics

Date: 2026-05-31

## Purpose

Slice 14B hardens the local Studio launcher around the failure modes that make
MVP demos confusing: stale Next servers, multiple occupied web ports, broken
static chunks, Windows/WSL listener ownership, browser route drift, browser
zoom, and Brain Memory Gateway URL ambiguity.

The launcher remains a non-destructive diagnostic tool. It does not install,
start, stop, kill, delete, mutate services, or implement production packaging.

## Files Changed

- `scripts/studio-launch.mjs`
- `docs/packaging/STUDIO_LAUNCHER_14A.md`
- `docs/packaging/STUDIO_LAUNCHER_14B_PORT_DIAGNOSTICS.md`
- `docs/runbooks/MVP_LOCAL_LAUNCH_RUNBOOK.md`
- `ROADMAP.md`

## Port Diagnostics

`npm run studio:launch -- --check` now probes Web UI ports `3000` through
`3007`.

For each reachable port it checks:

- root route `/`;
- whether the HTML includes `Brain Memory Studio`;
- old green UI markers;
- `/design/codex-shell` route presence;
- `/api/hermes/status` BFF reachability;
- a bounded set of referenced `/_next/static/**` assets.

Each port is classified as one of:

| Classification | Meaning |
| --- | --- |
| `likely-studio` | Root looks like the current Studio and checked static assets pass. |
| `stale-or-broken-studio` | Root looks like Studio, but old UI markers or static asset failures were detected. |
| `possible-studio-bff` | The Hermes BFF route responds, but the root does not look like Studio. |
| `unrelated-server` | A server is reachable but does not look like this app. |
| `unreachable` | No server responded inside the short port-probe timeout. |

Warnings do not auto-stop or kill processes. The operator decides which server
to stop.

## Static Chunk Diagnostics

The launcher still checks the active Web UI root assets, and now the port scan
also reports static chunk failures per occupied port. Failures include the exact
asset path and HTTP status or error.

Example:

```text
static fail: /_next/static/chunks/example.css -> 500
```

This makes stale `.next` or stale dev-server problems visible without requiring
a browser console.

Suggested manual recovery stays unchanged:

1. Stop the stale server you own.
2. Restart `npm run dev` or the known Next server.
3. Re-run `npm run studio:launch -- --check`.
4. Remove only `apps/web/.next` after confirming the path if stale assets
   persist.

The launcher does not delete `.next`.

## Cross-Platform Process Hints

The launcher now emits listener ownership hints:

- Windows: parses `Get-NetTCPConnection` for ports `3000` through `3007` and
  prints a copyable PowerShell command.
- Linux: suggests `ss -ltnp` and parses it when available.
- WSL: includes the Linux hint and an extra PowerShell command for
  Windows-owned listeners.

On Windows, listener state is normalized to readable labels such as `Listen`
and IPv6 listeners print as `[::]:3005`.

## Brain Memory URL Diagnostics

The launcher now probes common Brain Memory Gateway URLs independently from the
configured real Gateway mode:

| URL | Meaning |
| --- | --- |
| `http://127.0.0.1:8080/health` | Common compose Gateway URL. |
| `http://127.0.0.1:8765/health` | Common standalone helper URL while that helper is running. |
| configured `BRAIN_MEMORY_GATEWAY_URL` | Current configured Gateway target, when set. |

If none are reachable, this is a warning unless `--require-brain-memory` is
used. The launcher does not fake Brain Memory success and does not start Docker,
Gateway, or helper services.

## Browser Guidance

The launcher now prints explicit browser troubleshooting guidance:

- use `http://127.0.0.1:3000/` unless `STUDIO_WEB_UI_URL` points elsewhere;
- use the production root `/`, not `/design/codex-shell`, for smoke judgment;
- reset Chrome or Edge zoom to 100% with `Ctrl+0`;
- compare host and port if Codex, Playwright, and a manual browser disagree.

This is diagnostic text only. It does not modify the browser or UI.

## JSON Output

`--json` now includes structured diagnostics:

- `diagnostics.ports[]`;
- `diagnostics.processHints`;
- `diagnostics.browserGuidance[]`;
- `diagnostics.brainMemoryUrls[]`;
- `summary.passed`;
- `summary.warned`;
- `summary.failed`.

Secrets remain redacted. Environment fields report booleans such as
`apiKeySet`, not key values.

## Verified Local Result

On the Slice 14B checkpoint machine:

- `http://127.0.0.1:3000` classified as `likely-studio`;
- `http://127.0.0.1:3005` classified as `stale-or-broken-studio`;
- `3005` exposed exact failing static chunks with HTTP `500`;
- Windows process hints parsed listeners for `3000` and `3005`;
- Brain Memory common URLs `8080` and `8765` were unreachable and reported as
  warnings because live Gateway mode was not configured;
- Hermes was reachable through the Web UI BFF and direct `/health`;
- Brain Memory BFF honestly reported mock/unconfigured state.

## Safety Boundaries

Slice 14B does not:

- auto-install any service;
- auto-start or auto-stop any service;
- kill stale Next servers;
- delete `.next`;
- start Docker or systemd;
- modify Hermes streaming logic;
- modify Brain Memory BFF logic;
- modify memory scope bridge behavior;
- add direct browser-to-Hermes calls;
- add direct browser-to-Gateway calls;
- add direct storage access;
- implement auth/classification;
- implement export/import;
- add memory mutation/admin actions.

## Next Recommended Slice

Slice 14C - Launcher Guided Recovery Commands And Server Selection.

Reason: Slice 14B can identify stale or conflicting local servers. The next
increment should make recovery easier with non-destructive, copyable commands
and explicit `STUDIO_WEB_UI_URL` server selection guidance, while still avoiding
automatic service management.

## Slice 14C Follow-Up

Slice 14C completed the guided recovery pass. The launcher now supports
explicit `--base-url`, optional `--no-port-scan`, and `--recovery` print-only
guidance. It also emits structured JSON fields for `selectedBaseUrl`,
`healthyStudioPorts`, `brokenStudioPorts`, `recommendedActions`,
`recoveryCommands`, and `staticChunkFailures`.

Detailed behavior is documented in
`docs/packaging/STUDIO_LAUNCHER_14C_GUIDED_RECOVERY.md`.

The safety boundary remains unchanged: recovery commands are printed only. The
launcher still does not kill processes, remove `.next`, modify env files, start
services, stop services, change backend logic, or implement export/import.
