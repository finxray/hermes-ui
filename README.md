# Hermes UI + Brain Memory Studio

Local ChatGPT-like workspace for Hermes Agent with optional, Gateway-mediated
Brain Memory inspection.

## Current Shape

- Next.js/React Web UI in `apps/web`.
- Server-side BFF routes for Hermes and Brain Memory status/search.
- Hermes chat streaming through the BFF.
- Brain Memory console foundation, read-only and optional.
- No direct browser-to-Hermes or browser-to-Brain-Memory calls.
- No direct Postgres, Redis, Qdrant, RAGLight, or storage access.

## Packaging Modes

- **Web UI standalone:** run the Web UI with Hermes. Brain Memory is optional
  and can stay disabled.
- **Brain Memory standalone:** Brain Memory remains usable as its own
  backend/MCP/Gateway project without this Web UI.
- **Recommended bundle mode:** future Web UI + Brain Memory setup for users who
  want persistent project/session memory.
- **Attach Brain Memory later:** start with Web UI standalone, then configure a
  Brain Memory Gateway URL when ready.

See `docs/packaging/PACKAGING_MODES.md`.

Brain Memory `/ui/**` may use two auth layers: an optional
`BRAIN_MEMORY_UI_API_KEY` bearer gate, and a tenant-bound
`BRAIN_MEMORY_GATEWAY_MEMORY_API_KEY` for read-only memory search. The UI sends
both only from the server-side BFF.

## Local Development

Local MVP quick start:

```powershell
npm install
npm run studio:launch -- --check
npm run studio:web -- --port 3002 --open
npm run studio:launch -- --check --base-url http://127.0.0.1:3002
npm run smoke:ui -- --base-url http://127.0.0.1:3002
npm run smoke:mvp -- --base-url http://127.0.0.1:3002
```

Use `3002` when the default `3000` server is stale, occupied, or confusing. If
`3000` is already healthy, use `http://127.0.0.1:3000` consistently instead.

The app opens at `http://127.0.0.1:3000`. The expected Hermes API URL is
`http://127.0.0.1:8642`; Brain Memory Gateway is optional and usually expected
at `http://127.0.0.1:8080` when live.

Start with `docs/packaging/LOCAL_BUNDLE_CHECKLIST_14O.md` for the current local
bundle checklist. For the detailed launch flow, service modes, smoke matrix,
stale-server troubleshooting, browser scaling notes, and secrets guidance, see
`docs/runbooks/MVP_LOCAL_LAUNCH_RUNBOOK.md`. For packaging status, see
`docs/packaging/PACKAGING_READINESS_14K.md` and `docs/packaging/README.md`.

## Packaging Readiness

The current packaging posture is MVP/demo-ready for local Web UI use after the
release gate passes, but it is not a production installer or final one-command
GitHub distribution yet.

Safe release gate:

```powershell
npm run check:packaging
npm run release:check
```

Browser and live-service smokes remain separate because they require a healthy
selected Web UI base URL and, for live gates, already-running Hermes or Brain
Memory services.

For release preparation, see `docs/release/MANUAL_RC_CHECKLIST.md` and
`docs/release/RELEASE_NOTES_TEMPLATE.md`. Current MVP candidate notes live in
`docs/release/MVP_RC_NOTES.md`. Read-only Brain Memory release claims should
also follow `docs/product/BRAIN_MEMORY_READ_ONLY_QA_GATE_15L.md`.

## Boundary

The UI is not the agent runtime and not the memory authority.

```text
Browser UI -> Next.js BFF -> Hermes API server
Browser UI -> Next.js BFF -> Brain Memory Gateway UI/read-only endpoints
```

Hermes remains the agent runtime. Brain Memory Gateway remains the memory
authority.
