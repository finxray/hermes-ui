# Local Bundle Checklist 14O

Date: 2026-05-31

## Purpose

This is the current local MVP / RC checklist for Hermes UI / Brain Memory
Studio. It consolidates the startup, recovery, packaging, and release docs into
one operator path.

This checklist is not a production installer and not the final one-command
GitHub bundle. It does not install, start, stop, or mutate Hermes, Brain
Memory, Docker, systemd, `~/.hermes`, or local secret files.

## Supported Modes Now

| Mode | Current status | Notes |
| --- | --- | --- |
| Web UI standalone / mock Brain Memory | Supported for MVP/demo | Brain Memory may honestly report mock, disabled, or unconfigured. |
| Web UI + Hermes | Supported when Hermes is already running | Hermes is expected at `http://127.0.0.1:8642` unless local env overrides it. |
| Web UI + attach-later Brain Memory | Supported as a manual attach path | Gateway is expected at `http://127.0.0.1:8080` when live and requires a tenant-bound read key. |
| Web UI + Brain Memory bundle | Future target | Not implemented as an installer or service orchestrator. |
| Brain Memory standalone | External project | Use the Brain Memory repository instructions; this repo does not install it. |

## Quick Path For Current Local MVP

Start with diagnostics:

```powershell
npm install
npm run studio:launch -- --check
```

If no healthy Web UI server is running, start only the Web UI on a clean
alternate port:

```powershell
npm run studio:web -- --port 3002 --open
```

Verify that selected server before running smokes:

```powershell
npm run studio:launch -- --check --base-url http://127.0.0.1:3002
```

Then run smokes against the same selected base URL:

```powershell
npm run smoke:ui -- --base-url http://127.0.0.1:3002
npm run smoke:mvp -- --base-url http://127.0.0.1:3002
```

Use `3002` as the local recovery path when `3000` is stale, occupied, or
confusing. If `3000` is already healthy, it is fine to use
`http://127.0.0.1:3000` consistently instead.

## Hermes Live Path

Expected default:

```text
HERMES_API_BASE_URL=http://127.0.0.1:8642
HERMES_UI_ENABLE_REAL_HERMES=true
```

Verify Hermes directly:

```powershell
curl http://127.0.0.1:8642/health
```

Verify through the Web UI BFF and browser path after a healthy Web UI server is
selected:

```powershell
npm run studio:launch -- --check --base-url http://127.0.0.1:<port>
npm run smoke:ui:send -- --base-url http://127.0.0.1:<port>
npm run smoke:ui:stop -- --base-url http://127.0.0.1:<port>
node scripts/mvp-smoke.mjs --require-hermes --base-url http://127.0.0.1:<port>
```

If Hermes is not running, record it as not configured or unreachable. Do not
fake a live Hermes pass.

## Brain Memory Attach-Later Path

Brain Memory Gateway is optional for the Web UI + Hermes MVP path. It is
acceptable for the UI and checks to report Brain Memory as mock, disabled, or
unconfigured when Gateway is absent.

Expected live Gateway default:

```text
BRAIN_MEMORY_GATEWAY_URL=http://127.0.0.1:8080
BRAIN_MEMORY_UI_ENABLE_REAL_GATEWAY=true
BRAIN_MEMORY_GATEWAY_MEMORY_API_KEY=<redacted tenant-bound read key>
BRAIN_MEMORY_UI_API_KEY=<optional redacted UI bearer>
BRAIN_MEMORY_MCP_API_KEY_SET=<optional redacted diagnostics boolean>
```

`BRAIN_MEMORY_GATEWAY_MEMORY_API_KEY` authorizes tenant-bound read-only memory
search. `BRAIN_MEMORY_UI_API_KEY` is only the optional `/ui/**` bearer gate.
Both remain server-side BFF concerns; browser JavaScript must not receive API
keys.

For Runs + Brain Memory smokes, the selected Web UI server must have the same
live Brain Memory BFF env as the Brain Memory console. Hermes MCP also needs
its own Brain Memory Gateway URL, default tenant `local-dev`, API key, and
caller label. A 401 points at the optional UI bearer; a 403 points at the
tenant-bound memory key or tenant authorization. Do not fake a live pass when
the marker write succeeds but BFF search/inspect readback is unauthorized.

Run live Brain Memory gates only after Gateway and the tenant read key are
configured:

```powershell
curl http://127.0.0.1:8080/health
npm run studio:doctor
node scripts/mvp-smoke.mjs --require-brain-memory --base-url http://127.0.0.1:<port>
npm run smoke:hermes:runs:memory -- --base-url http://127.0.0.1:<port> --require-hermes --require-brain-memory
```

## Stale Server Recovery

Use the launcher first:

```powershell
npm run studio:launch -- --check --verbose
npm run studio:launch -- --check --print-recovery-plan
```

If `3000` or `3005` is stale or broken, do not use that server as the selected
base URL for browser smokes. Start or select one healthy server, often `3002`,
then pass that same `--base-url` to every launcher and smoke command.

Detailed manual recovery is in
`docs/runbooks/HEALTHY_STUDIO_SERVER_RECOVERY.md`. It explains listener
ownership, manual stale-server stopping, selected-base verification, and
last-resort manual `.next` cleanup. The launcher and wrapper do not delete
`.next` automatically and do not stop unrelated processes.

## Release Gate

Safe source/build/audit release gate:

```powershell
npm run release:check
```

`release:check` includes packaging, launcher contract, workspace state, Brain
Memory client, activity rendering, message rendering, UI structure, typecheck,
build, and moderate audit checks. It intentionally does not require browser
smokes or live services.

Browser smokes require a healthy selected Web UI server:

```powershell
npm run studio:launch -- --check --base-url http://127.0.0.1:<port>
npm run smoke:ui -- --base-url http://127.0.0.1:<port>
npm run smoke:markdown -- --base-url http://127.0.0.1:<port>
npm run smoke:markdown:long -- --base-url http://127.0.0.1:<port>
```

Use `docs/release/MANUAL_RC_CHECKLIST.md` for full RC dry runs and
`docs/release/MVP_RC_NOTES.md` for the current release-candidate posture.

## Safety Boundaries

This local bundle path does not:

- auto-install Hermes;
- auto-install Brain Memory;
- auto-start or auto-stop Hermes;
- auto-start or auto-stop Brain Memory;
- auto-start or auto-stop Docker;
- auto-start or auto-stop systemd;
- modify `~/.hermes`;
- write `apps/web/.env.local` except through explicit `studio:env` use;
- delete `.next` automatically;
- kill unrelated processes;
- add direct browser-to-Hermes paths;
- add direct browser-to-Brain-Memory paths;
- access Brain Memory storage directly;
- print API keys;
- implement export/import.

## Deferred / Not Claimable

Do not claim these as implemented:

- production installer;
- final one-command GitHub bundle;
- export/import;
- real artifact upload/download;
- real provider/model runtime switching;
- full auth/classification;
- memory admin/mutation UI;
- cross-channel Telegram/CLI run discovery;
- Docker/systemd service automation;
- managed Hermes or Brain Memory installers.

## Reference Map

- `docs/packaging/README.md` - packaging docs index.
- `docs/packaging/PACKAGING_READINESS_14K.md` - readiness manifest.
- `docs/packaging/PACKAGING_MODES.md` - modular mode definitions.
- `docs/runbooks/MVP_LOCAL_LAUNCH_RUNBOOK.md` - detailed local runbook.
- `docs/runbooks/HEALTHY_STUDIO_SERVER_RECOVERY.md` - stale-server recovery.
- `docs/release/MANUAL_RC_CHECKLIST.md` - manual release-candidate checklist.

## Next Recommended Slice

Slice 14P - Final RC decision refresh after 14N/14O docs and launcher
hardening.

Reason: the local bundle checklist is consolidated, while production installer,
one-command distribution, export/import, and service automation remain
explicitly deferred.
