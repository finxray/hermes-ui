# Local Startup Guide

This guide covers modular local startup paths. None of these paths install
Brain Memory automatically or start external services for you.

## A. Web UI Standalone With Hermes

Use this when Hermes API server is running and Brain Memory is not required.

1. Enable/start Hermes API server.
2. Verify Hermes health:

```powershell
curl http://127.0.0.1:8642/health
```

3. Install dependencies:

```powershell
npm install
```

4. Create local env:

```powershell
npm run studio:env -- --mode web-ui-with-hermes
```

5. Check the setup:

```powershell
npm run studio:doctor
```

6. Start the Web UI:

```powershell
npm run dev
```

7. Open the app:

```powershell
npm run studio:open
```

## B. Web UI Standalone Without Live Hermes

Use this when you only want the UI shell and local mock/unconfigured states.

```powershell
npm install
npm run studio:env -- --mode web-ui-only
npm run dev
npm run studio:open
```

Hermes and Brain Memory will show disabled/mock/unconfigured states. Local
project/session persistence still works in the browser.

## C. Web UI + Brain Memory Bundle Planned Path

The recommended future path is Web UI + Hermes + Brain Memory Gateway together.
Slice 09B only adds the env template and docs. It does not install or start
Brain Memory.

Template:

```powershell
npm run studio:env -- --mode bundle
```

Before using this mode, make sure:

- Hermes API server is reachable;
- Brain Memory Gateway HTTP UI/read-only endpoint is reachable;
- `BRAIN_MEMORY_UI_ENABLE_REAL_GATEWAY=true` is intentional.

## D. Attach Brain Memory Later

Use this after starting in Web UI standalone mode.

1. Install/start Brain Memory using its own project instructions.
2. Prepare attach env:

```powershell
npm run studio:env -- --mode attach-brain-memory-later
```

3. Edit `apps/web/.env.local`:

```text
BRAIN_MEMORY_GATEWAY_URL=http://127.0.0.1:8765
BRAIN_MEMORY_UI_ENABLE_REAL_GATEWAY=true
```

4. Run:

```powershell
npm run studio:doctor
```

When Gateway is reachable, the Brain Memory console should switch from
attach-later/mock to real status/search.

## E. Brain Memory Standalone

Brain Memory remains a separate standalone backend/MCP/Gateway project. This
Web UI is optional and does not install Brain Memory yet.

Use Brain Memory standalone when you only need its backend/MCP/Gateway behavior.
Use this Web UI when you want a ChatGPT-like Studio surface on top of Hermes and
Gateway-approved Brain Memory inspection.
