# Packaging Docs

Use this index to choose the right packaging or local-run document.

## Start Here

- `LOCAL_BUNDLE_CHECKLIST_14O.md` - current local MVP / RC checklist. Use this
  first for the supported local bundle path, healthy server selection, Hermes
  verification, attach-later Brain Memory, release gates, and deferred items.
- `PACKAGING_READINESS_14K.md` - readiness manifest and safe release gate.
- `PACKAGING_MODES.md` - supported and future packaging modes.

## Local Startup And Recovery

- `LOCAL_STARTUP_GUIDE.md` - modular startup examples by mode.
- `STUDIO_WEB_DEV_14J.md` - optional Web UI-only dev-server wrapper.
- `STUDIO_WEB_DEV_WINDOWS_HARDENING_14N.md` - Windows/WSL wrapper hardening and
  process lifecycle notes.
- `../runbooks/MVP_LOCAL_LAUNCH_RUNBOOK.md` - detailed local launch runbook.
- `../runbooks/HEALTHY_STUDIO_SERVER_RECOVERY.md` - manual stale-server
  recovery workflow.

## Launcher Reference

- `STUDIO_LAUNCHER_14A.md` - launcher foundation.
- `STUDIO_LAUNCHER_14B_PORT_DIAGNOSTICS.md` - port and stale-static diagnostics.
- `STUDIO_LAUNCHER_14C_GUIDED_RECOVERY.md` - print-only recovery guidance and
  selected base URL behavior.
- `STUDIO_LAUNCHER_14H_CONTRACT_TESTS.md` - help and launcher contract checks.
- `STUDIO_LAUNCHER_14I_HEALTHY_SERVER_RECOVERY.md` - healthy-server recovery
  checkpoint.

## Future Packaging

- `ONE_COMMAND_CLI_PLAN.md` - future one-command CLI plan. This is not
  implemented yet.

## Release Docs

- `../release/MANUAL_RC_CHECKLIST.md` - manual RC dry-run checklist.
- `../release/MVP_RC_NOTES.md` - current MVP RC posture.
- `../release/RELEASE_DECISION_14M.md` - recorded Slice 14M dry run.

## Safety Boundary

The current packaging path does not implement a production installer, final
one-command GitHub bundle, export/import, Docker/systemd orchestration, managed
Hermes or Brain Memory installation, memory admin/mutation UI, or direct
browser-to-Hermes/Brain-Memory access.
