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

Quick MVP path:

```powershell
npm install
npm run studio:env -- --mode web-ui-with-hermes
npm run dev
npm run studio:launch -- --check
npm run check:studio-launch
npm run studio:launch -- --open
```

The local launcher is a safe checklist for daily use. It checks env, Web UI,
Hermes, optional Brain Memory state, stale Next static chunks, and prints next
commands. It does not install or start Hermes/Brain Memory, does not kill
servers, and does not implement export/import. Use
`npm run studio:launch -- --help` for launcher flags and
`npm run check:studio-launch` for the launcher help/JSON/safety contract.

Manual smoke path:

```powershell
npm run studio:doctor
npm run smoke:mvp
npm run smoke:ui
npm run studio:open
```

When more than one local Studio server is running, pin checks and smokes to the
intended server:

```powershell
npm run studio:launch -- --check --base-url http://127.0.0.1:3000
npm run smoke:ui -- --base-url http://127.0.0.1:3000
```

Browser smokes fail early on stale Next static chunks and print manual recovery
guidance instead of continuing into misleading click failures.
If no healthy Studio server is detected, follow
`docs/runbooks/HEALTHY_STUDIO_SERVER_RECOVERY.md`, start a fresh server on an
unused port such as `npm run dev -- --port 3002`, verify it with
`npm run studio:launch -- --check --base-url http://127.0.0.1:3002`, then run
smokes with the same `--base-url`.

The app opens at `http://127.0.0.1:3000`. The expected Hermes API URL is
`http://127.0.0.1:8642`; Brain Memory Gateway is optional and usually expected
at `http://127.0.0.1:8080` when live.

For the full local launch flow, service modes, smoke matrix, stale-server
troubleshooting, browser scaling notes, and secrets guidance, see
`docs/runbooks/MVP_LOCAL_LAUNCH_RUNBOOK.md`.

For the launcher details, flags, safety boundaries, and relationship to the
future one-command CLI, see `docs/packaging/STUDIO_LAUNCHER_14A.md` and
`docs/packaging/STUDIO_LAUNCHER_14H_CONTRACT_TESTS.md`. For stale-server
recovery, see `docs/runbooks/HEALTHY_STUDIO_SERVER_RECOVERY.md`.

1. Install dependencies:

```powershell
npm install
```

2. Choose an env template:

```powershell
npm run studio:env -- --list
npm run studio:env -- --mode web-ui-with-hermes
```

Use `web-ui-only` if Hermes is not running yet. Existing `apps/web/.env.local`
is preserved unless `--force` is passed.

3. Enable or verify Hermes API server, then check:

```powershell
curl http://127.0.0.1:8642/health
```

4. Run the local doctor:

```powershell
npm run studio:doctor
```

5. Start the Web UI:

```powershell
npm run dev
```

6. Run the MVP smoke harness:

```powershell
npm run smoke:mvp
npm run smoke:ui
```

When Hermes is intentionally live and reachable, run the opt-in composer send
gate:

```powershell
npm run smoke:ui:send
```

Use `npm run smoke:mvp:live` only when both Hermes and Brain Memory Gateway are
configured and expected to be reachable.

7. Open the app:

```powershell
npm run studio:open
```

The app opens at `http://127.0.0.1:3000`.

For mode-specific setup paths, see `docs/packaging/LOCAL_STARTUP_GUIDE.md`.

## Boundary

The UI is not the agent runtime and not the memory authority.

```text
Browser UI -> Next.js BFF -> Hermes API server
Browser UI -> Next.js BFF -> Brain Memory Gateway UI/read-only endpoints
```

Hermes remains the agent runtime. Brain Memory Gateway remains the memory
authority.
