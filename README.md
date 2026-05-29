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

## Local Development

1. Install dependencies:

```powershell
npm install
```

2. Enable or verify Hermes API server, then check:

```powershell
curl http://127.0.0.1:8642/health
```

3. Create `apps/web/.env.local` from `.env.example`.

Recommended Web UI standalone defaults:

```text
HERMES_API_BASE_URL=http://127.0.0.1:8642
HERMES_API_KEY=
HERMES_UI_ENABLE_REAL_HERMES=true
BRAIN_MEMORY_GATEWAY_URL=http://127.0.0.1:8765
BRAIN_MEMORY_API_KEY=
BRAIN_MEMORY_UI_ENABLE_REAL_GATEWAY=false
```

4. Run the local doctor:

```powershell
npm run studio:doctor
```

5. Start the Web UI:

```powershell
npm run dev
```

6. Open the app:

```powershell
npm run studio:open
```

The app opens at `http://127.0.0.1:3000`.

## Boundary

The UI is not the agent runtime and not the memory authority.

```text
Browser UI -> Next.js BFF -> Hermes API server
Browser UI -> Next.js BFF -> Brain Memory Gateway UI/read-only endpoints
```

Hermes remains the agent runtime. Brain Memory Gateway remains the memory
authority.
