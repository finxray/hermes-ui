# Packaging Modes

Hermes UI / Brain Memory Studio must stay modular. Users should not be forced
to install Brain Memory to use Hermes UI, and Brain Memory should remain useful
without the Web UI.

## Current Status

Slice 14K records the current packaging readiness baseline in
`docs/packaging/PACKAGING_READINESS_14K.md`.

- Web UI standalone is safe for MVP/demo use after the release gate passes and
  a healthy selected Web UI server is verified.
- Web UI + Hermes is safe for MVP/demo use when Hermes is already running and
  reachable through the BFF.
- Brain Memory attach-later remains optional and manual.
- Recommended bundle mode is a future target and not implemented as an
  installer or service orchestrator yet.
- The final one-command package remains deferred.

## Web UI Standalone

Use this when a user wants the Studio Web UI for Hermes but does not want Brain
Memory installed yet.

Requires:

- this repository;
- Node/npm;
- Hermes API server if real chat/status is desired.

Enables:

- project/session UI;
- local browser persistence;
- Hermes status and streaming through the BFF when configured;
- Brain Memory console in disabled/mock/attach-later mode.

Disables:

- real Brain Memory Gateway search;
- evidence detail, audit, supersession, and future memory admin actions.

Recommended env:

```text
HERMES_UI_ENABLE_REAL_HERMES=true
BRAIN_MEMORY_UI_ENABLE_REAL_GATEWAY=false
```

## Brain Memory Standalone

Use this when a user wants Brain Memory as its own backend/MCP/Gateway project
without the Studio Web UI.

This repository does not install Brain Memory standalone yet. The mode is
documented here so the future bundle does not make Brain Memory depend on the
Web UI.

Requires:

- the Brain Memory project/package;
- its own Gateway/MCP/storage configuration.

Enables:

- Brain Memory as an independent backend and MCP/Gateway service.

Disables:

- Studio Web UI unless this repository is also installed.

## Recommended Bundle Mode

Use this when a user wants Web UI + Brain Memory together.

This is the future recommended path for users who want persistent
project/session memory, but it is not implemented as a production installer or
service orchestrator yet.

Requires:

- this repository;
- Hermes API server;
- Brain Memory Gateway HTTP UI/read-only endpoint;
- future setup/start orchestration.

Enables:

- Hermes UI;
- Brain Memory console real status/search;
- future Gateway-approved evidence, audit, supersession, and admin actions.

Recommended env:

```text
HERMES_UI_ENABLE_REAL_HERMES=true
BRAIN_MEMORY_UI_ENABLE_REAL_GATEWAY=true
BRAIN_MEMORY_UI_API_KEY=
BRAIN_MEMORY_GATEWAY_MEMORY_API_KEY=<tenant-bound read key>
```

`BRAIN_MEMORY_UI_API_KEY` is an optional UI/BFF bearer gate. Tenant memory
search authorization comes from `BRAIN_MEMORY_GATEWAY_MEMORY_API_KEY`, which
the BFF sends as `X-Gateway-Memory-Api-Key` for `/ui/memory/search`.

## Attach Brain Memory Later

Use this when a user installs the Web UI first and later decides to add Brain
Memory.

Current path:

1. Keep the Web UI running in standalone mode.
2. Install/start Brain Memory using its own project instructions.
3. Configure `apps/web/.env.local` with `BRAIN_MEMORY_GATEWAY_URL`.
4. Set `BRAIN_MEMORY_UI_API_KEY` if the Gateway has the optional `/ui/**`
   bearer gate enabled.
5. Set `BRAIN_MEMORY_GATEWAY_MEMORY_API_KEY` for tenant-authorized read-only
   memory search unless explicit local-dev bypass is enabled.
6. Set `BRAIN_MEMORY_UI_ENABLE_REAL_GATEWAY=true`.
7. Run `npm run studio:doctor`.

Future path:

- a helper command can guide or automate the attach flow;
- the command should validate health without reading storage directly.

## Boundary Rule

The Web UI and BFF must never connect directly to Brain Memory storage such as
Postgres, Redis, Qdrant, RAGLight, filesystem internals, or any storage adapter.

The only UI observability/admin path is:

```text
Browser UI -> Next.js BFF -> Brain Memory Gateway UI/Admin API
```

Brain Memory remains the memory authority and must remain usable without this
Web UI.
