# Studio Launcher 14H Contract Tests

Date: 2026-05-31

## Purpose

Slice 14H adds explicit launcher usage help and a lightweight contract check for
the local Studio launcher. The goal is to keep future launcher changes from
silently breaking argument handling, selected base URL behavior, JSON output,
stale-server guidance, or the non-destructive safety boundary.

No Web UI product behavior, Hermes streaming logic, Brain Memory BFF logic, or
service management behavior changed.

## Files Changed

- `scripts/studio-launch.mjs`
- `scripts/check-studio-launch-contract.mjs`
- `package.json`
- `docs/packaging/STUDIO_LAUNCHER_14A.md`
- `docs/packaging/STUDIO_LAUNCHER_14H_CONTRACT_TESTS.md`
- `docs/runbooks/MVP_LOCAL_LAUNCH_RUNBOOK.md`
- `README.md`
- `ROADMAP.md`

## Help Output

The launcher now supports:

```powershell
node scripts/studio-launch.mjs --help
npm run studio:launch -- --help
```

Help exits before live diagnostics. It documents:

- purpose and usage;
- `--check`;
- `--open`;
- `--smoke`;
- `--ui-smoke`;
- `--require-hermes`;
- `--require-brain-memory`;
- `--base-url`;
- `--no-port-scan`;
- `--json`;
- `--verbose`;
- `--dev-command`;
- `--recovery`;
- examples for checks, selected base URL, recovery, browser open, and smoke;
- safety boundaries.

## Contract Check

Slice 14H adds:

```powershell
npm run check:studio-launch
```

The check is safe and bounded. It runs `--help` and performs source-level
assertions over the launcher, smoke base URL helper, and root package scripts.

Coverage includes:

- `--help` exits successfully and does not run live diagnostics;
- help/source contains the expected launcher flags;
- selected base URL parsing and reporting remain present;
- smoke base URL helper keeps the localhost default and trims selected URLs;
- JSON report source includes expected fields;
- key status fields remain boolean presence checks instead of raw secret values;
- `sanitizeBody` remains present for fetched bodies and command details;
- recovery commands remain data only and print-only;
- destructive cache cleanup examples remain marked `destructive: true`;
- the launcher has no file mutation calls;
- the launcher does not execute destructive recovery or service commands;
- `package.json` exposes both `studio:launch` and `check:studio-launch`.

## JSON Contract

The launcher JSON report must continue to expose:

- top-level `selectedBaseUrl`;
- `diagnostics.ports[]`;
- `diagnostics.healthyStudioPorts[]`;
- `diagnostics.brokenStudioPorts[]`;
- `diagnostics.staticChunkFailures[]`;
- `diagnostics.recommendedActions[]`;
- `diagnostics.recoveryCommands[]`;
- `summary.warnings[]`;
- `summary.failures[]`.

Secret-bearing env values are represented by booleans such as `apiKeySet`,
`gatewayMemoryApiKeySet`, `uiApiKeySet`, and `legacyApiKeySet`. The launcher
must not print API key values.

## Safety Contract

The launcher remains a diagnostic/checklist tool. It does not:

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
- change UI product behavior;
- add direct browser-to-service paths;
- implement export/import.

Recovery commands are printed for the operator. The launcher does not execute
them.

## Current Local Stale Server State

During this slice, the launcher correctly reported the selected
`http://127.0.0.1:3000` server as stale/broken because sampled Next static
chunks returned HTTP `500`. It also reported `http://127.0.0.1:3005` as
stale/broken. Ports `3001`, `3002`, `3003`, `3004`, `3006`, and `3007` were
unreachable.

Hermes was reachable through both the Web UI BFF and direct `/health`. Brain
Memory Gateway was not configured/reachable, and the BFF honestly reported
mock/unconfigured state.

The selected stale server failure is intentional and should not be treated as a
false success.

## Limitations

- The contract check is source-level and CLI-help focused; it does not replace
  browser, route, type, build, or audit checks.
- It does not start, stop, or repair stale local servers.
- It verifies that destructive recovery commands are print-only, not that an
  operator has executed them safely.

## Next Recommended Slice

Slice 14I - Launcher Browser Smoke Stabilization And Healthy-Server Recovery
Runbook.

Reason: Slice 14H protects the launcher contract. The next useful increment is
to stabilize local browser smoke execution around a known healthy selected
server and document the manual stale-server recovery path, without adding
automatic process killing, `.next` deletion, or service management.

## Slice 14I Follow-Up

Slice 14I extended the contract check to cover the healthy-server recovery
runbook and launcher recovery wording. `npm run check:studio-launch` now also
verifies:

- `docs/runbooks/HEALTHY_STUDIO_SERVER_RECOVERY.md` exists;
- launcher help includes `--print-recovery-plan`;
- no-healthy-server recovery wording is present;
- the recovery runbook is referenced by launcher output;
- base-url smoke guidance requires a healthy selected server;
- `.next` cleanup remains manual/destructive guidance only;
- no destructive recovery or service commands are executed.

Detailed behavior is documented in
`docs/packaging/STUDIO_LAUNCHER_14I_HEALTHY_SERVER_RECOVERY.md`.
