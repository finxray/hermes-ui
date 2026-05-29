# Slice 09A Local Health Checks

Date: 2026-05-29

## Scope

Slice 09A prepares modular packaging and local diagnostics. It does not build a
production CLI, installer, Docker stack, or service manager.

## Files Changed

- `package.json`
- `.env.example`
- `README.md`
- `scripts/studio-doctor.mjs`
- `scripts/open-studio-browser.mjs`
- `apps/web/src/components/BrainMemoryStatusPanel.tsx`
- `docs/packaging/PACKAGING_MODES.md`
- `docs/packaging/ONE_COMMAND_CLI_PLAN.md`
- `docs/packaging/SLICE_09A_LOCAL_HEALTH_CHECKS.md`

## Commands Added

```text
npm run studio:doctor
npm run studio:open
npm run studio:dev
```

Existing commands remain:

```text
npm run dev
npm run typecheck
npm run build
```

## studio:doctor Checks

The doctor script checks:

- repo root shape;
- Node version;
- npm availability;
- package.json workspaces;
- `apps/web`;
- `.env.example`;
- `apps/web/.env.local`;
- Hermes env presence;
- Brain Memory env presence;
- inferred install mode;
- direct Hermes `/health`;
- Web UI BFF Hermes status when dev server is running;
- Web UI BFF Brain Memory status when dev server is running;
- direct Brain Memory Gateway `/health` only when real Gateway mode is enabled.

The script never prints API keys. Missing optional services do not make the
doctor fail if the repo itself is healthy.

## Packaging Modes Represented

Doctor reports one inferred mode:

- `web-ui-only`;
- `bundle-ready`;
- `brain-memory-configured`;
- `unconfigured-dev`.

The user-facing packaging docs also define:

- Web UI standalone;
- Brain Memory standalone;
- recommended bundle mode;
- attach Brain Memory later.

## studio:open

`studio:open` opens `http://127.0.0.1:3000` by default.

It supports:

```text
node scripts/open-studio-browser.mjs --url=http://127.0.0.1:3000
```

It tries a WSL-to-Windows PowerShell open path when running under WSL, then uses
the platform default opener. If automatic open fails, it prints the URL.

## Deliberately Not Implemented

- no production installer;
- no npm package publishing;
- no Docker orchestration;
- no automatic Brain Memory install;
- no automatic service start/stop;
- no memory mutation/admin actions;
- no direct storage access;
- no browser-to-Hermes or browser-to-Brain-Memory direct calls.

## Future Packaging Support

This slice makes future one-command packaging easier by centralizing:

- environment diagnostics;
- mode inference;
- service health checks;
- browser-open behavior;
- modular mode documentation.

## Known Limitations

- The doctor reads `apps/web/.env.local` directly and does not resolve every
  possible Next.js env-loading edge case.
- It checks the default dev server URL unless `STUDIO_WEB_UI_URL` is set.
- It does not start services.
- It does not verify Brain Memory Gateway endpoints unless real Gateway mode is
  enabled.

## Validation Run

Slice 09A validation:

- `npm run studio:doctor` passed.
- Doctor inferred `web-ui-only`.
- Hermes direct `/health` was reachable.
- Web UI BFF Hermes status was reachable.
- Web UI BFF Brain Memory status returned mock mode.
- Brain Memory direct Gateway health was skipped because real Gateway mode was
  disabled.
- `npm run typecheck` passed.
- `npm run build` passed.
- `npm audit --audit-level=moderate` passed with 0 vulnerabilities.
- `npm run studio:open` opened `http://127.0.0.1:3000`.

## Next Recommended Slice

Recommended next slice: Slice 09B, packaging environment templates and start
guide. That slice should add mode-specific env examples and a non-Docker local
startup checklist before adding Docker orchestration.
