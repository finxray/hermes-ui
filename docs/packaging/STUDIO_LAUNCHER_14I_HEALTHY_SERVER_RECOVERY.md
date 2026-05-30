# Studio Launcher 14I Healthy Server Recovery

Date: 2026-05-31

## Purpose

Slice 14I makes the launcher recovery story explicit for the current local
state where `3000` and `3005` are stale/broken and no healthy Studio server is
available. It adds a manual healthy-server recovery runbook, improves
print-only launcher recovery output, and clarifies that browser smokes require
a healthy selected base URL.

No service management, backend behavior, Hermes streaming, Brain Memory BFF
logic, UI product behavior, or export/import behavior changed.

## Files Changed

- `scripts/studio-launch.mjs`
- `scripts/check-studio-launch-contract.mjs`
- `docs/runbooks/HEALTHY_STUDIO_SERVER_RECOVERY.md`
- `docs/packaging/STUDIO_LAUNCHER_14I_HEALTHY_SERVER_RECOVERY.md`
- `docs/packaging/STUDIO_LAUNCHER_14H_CONTRACT_TESTS.md`
- `docs/runbooks/MVP_LOCAL_LAUNCH_RUNBOOK.md`
- `README.md`
- `ROADMAP.md`

## Recovery Output Behavior

When the selected base URL is stale and no healthy Studio server is found, the
launcher now prints:

- `No healthy Studio server found`;
- stale/broken port list;
- a manual recovery sequence;
- fresh-port example using `npm run studio:web -- --port 3002 --open --ui-smoke`;
- selected-base-url verification command;
- base-url-safe smoke example;
- `docs/runbooks/HEALTHY_STUDIO_SERVER_RECOVERY.md`.

The new flag:

```powershell
npm run studio:launch -- --check --print-recovery-plan
```

is an alias for the recovery view. It only prints guidance.

## Current Stale Server Scenario

The local audit during this slice found:

- `http://127.0.0.1:3000`: `stale-or-broken-studio`, selected, static chunks
  returning HTTP `500`;
- `http://127.0.0.1:3005`: `stale-or-broken-studio`, static chunks returning
  HTTP `500`;
- no healthy Studio server on `3000` through `3007`;
- Hermes BFF and direct `/health` reachable;
- Brain Memory Gateway mock/unconfigured.

The launcher intentionally exits non-zero in this state. That is the correct
result because browser smokes would fail or produce misleading hydration
errors.

## Healthy Server Recovery Workflow

The manual workflow is documented in
`docs/runbooks/HEALTHY_STUDIO_SERVER_RECOVERY.md`:

1. Diagnose with `npm run studio:launch -- --check --verbose`.
2. Identify listeners with `ss` or `Get-NetTCPConnection`.
3. Stop stale servers manually after verifying ownership.
4. Start only the Web UI dev server with `npm run studio:web` or
   `npm run studio:web -- --port 3002 --open --ui-smoke`.
5. Verify with
   `npm run studio:launch -- --check --base-url http://127.0.0.1:<port>`.
6. Run smokes only with the same healthy `--base-url`.
7. Use `.next` cleanup only as a last manual/destructive step after the server
   is stopped.

The repo currently has no committed root or web `start` script, so no
`npm run start` recovery command is documented.

Slice 14J later added `studio:web` as the explicit optional Web UI-only start
wrapper. It refuses stale/broken selected ports and still does not manage
Hermes, Brain Memory, Docker, systemd, env files, or cache cleanup.

## Base-Url Smoke Guidance

Browser and fixture smokes should be treated as selected-base-URL tests:

```powershell
npm run smoke:ui -- --base-url http://127.0.0.1:<port>
npm run smoke:markdown -- --base-url http://127.0.0.1:<port>
npm run smoke:markdown:long -- --base-url http://127.0.0.1:<port>
npm run smoke:mvp -- --base-url http://127.0.0.1:<port>
```

If `3000` is stale, do not run smokes without `--base-url`. Browser smokes fail
early when selected static chunks fail.

## Contract Checks

`npm run check:studio-launch` now also verifies:

- healthy-server recovery runbook exists;
- launcher help mentions `--print-recovery-plan`;
- no-healthy-server recovery wording exists;
- recovery runbook path is referenced;
- `.next` cleanup remains manual/destructive guidance only;
- destructive recovery/service commands are not executed.

## Safety Boundaries

Slice 14I does not:

- auto-kill processes;
- auto-delete `.next`;
- auto-start or auto-stop services;
- auto-start or auto-stop Docker;
- modify `~/.hermes`;
- modify `apps/web/.env.local`;
- install services;
- print API keys;
- change Hermes streaming logic;
- change Brain Memory BFF logic;
- change UI product behavior;
- add direct browser-to-service paths;
- implement export/import.

## Checks Run

Required check results are recorded in the slice final response. Launcher
commands that target stale `3000` are expected to exit non-zero until a human
manually recovers one healthy selected server.

## Remaining Limitation

The user must manually stop/start local Studio servers. The launcher can
diagnose stale ports and print a recovery plan, but it deliberately does not
repair the environment automatically.

## Next Recommended Slice

Slice 14J - Packaging Readiness Manifest And Release Gate.

Reason: the launcher now has help, contract checks, stale-server recovery, and
base-url-safe smoke guidance. The next useful packaging slice is a concise
release/readiness manifest that names the required local checks, deferred
production CLI work, and remaining manual service assumptions without adding
service automation.
