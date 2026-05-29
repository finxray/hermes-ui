# One Command CLI Plan

This is a future plan, not an implemented production CLI.

## Goal

A user should eventually be able to clone or download a package, choose a mode,
and run one command that checks requirements, starts or guides services, opens
the UI, and prints a health summary.

## Future Flow

1. Clone/download Hermes UI / Brain Memory Studio.
2. Choose a mode:
   - `web-ui-only`;
   - `brain-memory-only`;
   - `bundle`;
   - `attach-brain-memory-later`.
3. Check system requirements:
   - Node/npm;
   - supported OS;
   - optional Docker;
   - required ports.
4. Check Hermes:
   - verify API server URL;
   - verify `/health`;
   - report auth/capability diagnostics.
5. Check Brain Memory only if selected:
   - verify Gateway URL;
   - verify `/health`;
   - verify read-only UI endpoints.
6. Start Web UI.
7. Open the browser.
8. Print a concise health summary.

## Future Docker Option

Docker Compose may become the recommended bundle path for users who want local
Brain Memory plus Web UI with fewer manual setup steps.

Docker should remain optional. Web UI standalone must not require Docker.

## Future npm Package Option

The Web UI can later expose a package or launcher command for users who already
have Hermes and Brain Memory running.

That package must keep secrets in local env files and must not embed API keys in
browser JavaScript.

## OS Support

The future CLI should support:

- Windows;
- WSL2;
- macOS;
- Linux.

Slice 09A starts with portable Node scripts:

- `scripts/studio-doctor.mjs`;
- `scripts/open-studio-browser.mjs`.

## Intentionally Not Implemented Yet

- production installer;
- npm package publishing;
- Docker orchestration;
- automatic Brain Memory installation;
- service manager integration;
- automatic Hermes or Brain Memory start/stop;
- memory mutation/admin actions.
