# Slice 09B Env Templates

Date: 2026-05-29

## Scope

Slice 09B adds modular env templates and local startup guidance. It does not
implement a production installer, Docker orchestration, service manager, or
Brain Memory installation.

## Files Changed

- `env/web-ui-only.env.example`
- `env/web-ui-with-hermes.env.example`
- `env/bundle-with-brain-memory.env.example`
- `env/attach-brain-memory-later.env.example`
- `scripts/studio-env.mjs`
- `scripts/studio-doctor.mjs`
- `apps/web/src/components/BrainMemoryStatusPanel.tsx`
- `package.json`
- `README.md`
- `docs/packaging/LOCAL_STARTUP_GUIDE.md`
- `docs/packaging/SLICE_09B_ENV_TEMPLATES.md`

## Env Templates Added

- `web-ui-only`: UI shell with Hermes disabled and Brain Memory disabled.
- `web-ui-with-hermes`: Web UI + real Hermes, Brain Memory disabled.
- `bundle`: Web UI + real Hermes + Brain Memory Gateway enabled.
- `attach-brain-memory-later`: Web UI + Hermes, with Brain Memory URL prepared
  but Gateway flag still disabled until reachable.

## Commands Added

```text
npm run studio:env
```

Examples:

```powershell
npm run studio:env -- --list
npm run studio:env -- --mode web-ui-with-hermes
npm run studio:env -- --mode bundle
npm run studio:env -- --mode attach-brain-memory-later
```

## How the Env Helper Works

`scripts/studio-env.mjs` copies the selected template into
`apps/web/.env.local`.

Safety behavior:

- refuses to overwrite an existing `apps/web/.env.local`;
- requires `--force` to replace it;
- never prints secrets;
- prints next recommended commands;
- uses repo-relative paths.

## Deliberately Not Implemented

- no final production CLI;
- no package publishing;
- no installer;
- no Docker Compose;
- no automatic Brain Memory install;
- no automatic Hermes or Brain Memory start/stop;
- no memory mutation/admin actions;
- no direct storage access.

## Checks Run

```powershell
npm run studio:env -- --list
npm run studio:env -- --mode web-ui-only
npm run studio:doctor
npm run typecheck
npm run build
npm audit --audit-level=moderate
npm run studio:open
```

`apps/web/.env.local` already existed. The `studio:env -- --mode web-ui-only`
check refused to overwrite it and preserved the current live Hermes env. This is
the expected safety behavior.

Validation result:

- `studio:env -- --list` listed all templates.
- `studio:doctor` inferred `web-ui-only`.
- Hermes direct `/health` was reachable.
- Web UI BFF Hermes status was reachable.
- Web UI BFF Brain Memory status returned mock mode.
- Brain Memory direct Gateway health was skipped because real Gateway mode was
  disabled/unconfigured.
- `studio:open` opened `http://127.0.0.1:3000`.

## Known Limitations

- The helper copies templates only; it does not merge env files.
- `bundle` is a template alias for `bundle-with-brain-memory`, not an installer.
- Users must still start Hermes and Brain Memory themselves.

## Next Recommended Slice

Recommended next slice: Slice 09C, non-Docker local startup checklist and
troubleshooting matrix. That should document common Windows/WSL/macOS/Linux
failure modes before adding any Docker orchestration.
