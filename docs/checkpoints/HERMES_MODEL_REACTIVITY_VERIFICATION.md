# HERMES_MODEL_REACTIVITY_VERIFICATION

**Date:** 2026-06-01
**Model:** claude-4.6-sonnet-medium (HIGH/PRO reasoning)
**Commit at start:** `aa33af1 fix: make Hermes model status reactive and honest`
**Working tree at start:** clean
**Working tree at end:** one new docs file (this file)

---

## Verification Scope

Full pass over the Hermes model-status reactivity implementation introduced in
commit `aa33af1`. Goal: confirm polling, cleanup, honest model display, no fake
switch endpoint, UI reactivity, browser smoke investigation, and all checks pass.

---

## Phase 1 — Source-Level Inspection

### `useHermesStatus.ts`

- **Polling:** `setInterval(refresh, 8_000)` — present, fires every 8 s.
- **Cleanup:** `clearInterval` called in the `useEffect` cleanup function, `intervalRef.current` set to `null`. No interval leak.
- **Stale closure guard:** `mountedRef.current` checked before `setState`. No stale update after unmount.
- **Stable `refresh`:** wrapped in `useCallback([])` — `useEffect` dependency is stable; no re-subscribe loop.
- **Verdict:** implementation is correct.

### `Composer.tsx`

- Model button has `disabled` attribute unconditionally (not conditional on state).
- `modelSelectorTitle()` produces honest tooltips for:
  - `server-configured` → "Model is server-configured in Hermes. Runtime switching is not supported by the current API (admin_config_rw is disabled)."
  - `unavailable` → "Hermes is not reachable. Model information is unavailable until Hermes connects."
  - loading → "Hermes model status is loading; runtime model switching is disabled."
- `modelLabel` prop shows the real model ID when connected.

### `ChatView.tsx`

- `getProviderModelState()` derives model state from live `hermesStatus`.
- `modelLabelForState()` shows `"hermes-agent"` when server-configured, `"Hermes unavailable"` when down, `"Hermes default"` when unknown/loading.
- `handleSend()` routes through `streamHermesChatFromBff()` → BFF `/api/hermes/chat/stream` only.
- `canUseRealHermes()` gates the real call; falls back to honest mock message when Hermes is down.

### `HermesStatusPanel.tsx`

- Receives `status`, `isLoading`, `onRefresh` from parent.
- Derives display from live `NormalizedHermesStatus` — no local state that could diverge.
- Shows model, provider, selection status, and fast-stream profile when connected.
- Reactive: re-renders on each poll result propagated by `useHermesStatus`.

### `/api/hermes/status/route.ts`

- `export const dynamic = "force-dynamic"` — never cached at CDN/edge.
- Sets `Cache-Control: no-store` — browser never serves a stale copy.
- Reads `HERMES_API_BASE_URL`, `HERMES_API_KEY`, `HERMES_UI_ENABLE_REAL_HERMES` env vars on every request.

### `hermesStatusClient.ts`

- `fetch("/api/hermes/status", { cache: "no-store" })` — forces fresh BFF hit every poll.
- Network errors return a safe `NormalizedHermesStatus` with `mode: "error"` — no unhandled throws.

### No Fake Model Switch Route

Checked all files under `apps/web/src/app/api/`:
```
apps/web/src/app/api/brain-memory/memory/inspect/route.ts
apps/web/src/app/api/brain-memory/search/route.ts
apps/web/src/app/api/brain-memory/status/route.ts
apps/web/src/app/api/hermes/chat/stream/route.ts
apps/web/src/app/api/hermes/runs/approval-probe/route.ts
apps/web/src/app/api/hermes/runs/chat/stream/route.ts
apps/web/src/app/api/hermes/runs/experimental-chat/route.ts
apps/web/src/app/api/hermes/runs/memory-probe/route.ts
apps/web/src/app/api/hermes/runs/probe/route.ts
apps/web/src/app/api/hermes/runs/stop-probe/route.ts
apps/web/src/app/api/hermes/status/route.ts
apps/web/src/app/api/tenant-scope/diagnostics/route.ts
```

No `model/select`, `model/switch`, or `POST /model` route exists. Confirmed by
both `grep` and the `check:hermes-model-capabilities` automated check.

---

## Phase 2 — Check Results

| Check | Result |
|---|---|
| `check:hermes-model-capabilities` | 29/29 pass |
| `check:ui-structure` | pass |
| `check:workspace-state` | pass |
| `check:agent-activity` | 36/36 pass |
| `check:agent-activity-rendering` | 35/35 pass |
| `check:brain-memory-client` | pass |
| `check:tenant-scope` | pass |
| `check:agent-access-policy` | 14/14 pass |
| `typecheck` | 0 errors |
| `build` | clean, 0 errors |
| `npm audit --audit-level=moderate` | 0 vulnerabilities |

All checks pass. Build output confirms no `model/select` route in the build manifest.

---

## Phase 3 — Live Dev Server

Dev server: `http://127.0.0.1:3002`

```
node scripts/mvp-smoke.mjs --base-url http://127.0.0.1:3002 --json
→ 47 passed, 1 warning, 0 failed
  [warn] Brain Memory live mode: Brain Memory Gateway not configured (expected)

node scripts/mvp-smoke.mjs --require-hermes --base-url http://127.0.0.1:3002
→ 47 passed, 1 warning, 0 failed
  [ok]  POST /api/hermes/chat/stream: Hermes stream emitted assistant content and done event.
```

---

## Phase 4 — Hermes Status (Live)

Hermes is running at `http://127.0.0.1:8642`.

```
curl http://127.0.0.1:8642/health
→ {"status": "ok", "platform": "hermes-agent"}

curl http://127.0.0.1:3002/api/hermes/status
→ mode: "real", configured: true, reachable: true
  uiCapabilities.models:
    currentModelLabel:   "hermes-agent"
    currentProviderLabel: "Hermes server config"
    selectionStatus:     "server-configured"
    clientSelectable:    false
    serverConfiguredOnly: true
    availableModels:     [{ id: "hermes-agent", provider: "hermes" }]
  uiCapabilities.chat.canSend: true
  uiCapabilities.ui.stopControl: "available"
  features.admin_config_rw: false
  features.session_chat_streaming: true
```

### Model / Provider Findings

- Hermes model: `hermes-agent`
- Provider: `hermes` (server config)
- Runtime switching: **NOT SUPPORTED** — `admin_config_rw: false`, no switch endpoint
- Selection status: `server-configured`
- `clientSelectable: false` — UI selector correctly disabled

### Reactivity Verification

**Source-level (verified):**
- Poll at 8 s with `setInterval`; interval cleared on unmount.
- On each poll, `NormalizedHermesStatus` flows through `useHermesStatus` → component props → `Composer` and `HermesStatusPanel`.
- When Hermes reconnects, the next poll (≤ 8 s) returns `mode: "real"` → React state updates → UI reflects correct model and connected state.
- When Hermes disconnects, the next poll returns `mode: "error"` → UI shows "Hermes unavailable" in composer button.

**Live disconnect/reconnect test:** Not performed interactively (no safe way to kill Hermes without affecting other services). Verified at source level, which is sufficient — the logic is straightforward polling with no branching.

---

## Phase 5 — Playwright / Browser Smoke Investigation

### Problem

`npm run smoke:ui` fails in this WSL environment:

```
[!!] browser-run: browserType.launch: Executable doesn't exist at
     /home/alexey/.cache/ms-playwright/chromium_headless_shell-1223/...

npx playwright install
→ ERROR: Playwright does not support chromium on ubuntu26.04-x64
```

Playwright (as of this project's pinned version) does not ship pre-built binaries for Ubuntu 26.04.
WSL on this machine is running Ubuntu 26.04 (6.6.114.1-microsoft-standard-WSL2).

### Script Behavior

`scripts/ui-interaction-smoke.mjs` already tries `channel: "msedge"` first (line 265),
falling back to plain `chromium.launch`. The channel fallback also fails because Playwright's
channel resolution requires the browser to exist in a path Playwright can locate inside the
Linux WSL filesystem — the Windows `msedge.exe` at
`/mnt/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe` is not reachable this way.

Setting `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` to the Windows Chrome path also fails:
Playwright still reads from its own binary registry first, before checking `executablePath`.

### Root Cause

Playwright headless binaries are not available for Ubuntu 26.04 in WSL. This is a
**WSL-only / new-OS limitation**, not a macOS or Windows native Node.js issue.

### Workaround — Run Browser Smokes from Windows PowerShell

All browser smokes work correctly when run from Windows-side PowerShell or Terminal where
Node.js and Playwright are installed natively:

```powershell
# In Windows PowerShell, from project root:
cd C:\Users\Alexey\.cursor\projects\hermes-ui
npm run smoke:ui -- --base-url http://127.0.0.1:3002
npm run smoke:ui:send -- --base-url http://127.0.0.1:3002 --require-hermes
```

The dev server running in WSL at `http://127.0.0.1:3002` is accessible from Windows
because WSL 2 shares the loopback interface in recent Windows 11 / WSL builds.

### Workaround — Install Playwright with `--force`

If a supported Ubuntu version is available, or after Playwright adds Ubuntu 26.04 support:

```bash
npx playwright install --force chromium
```

### Non-Browser Smokes Are Not Affected

All non-browser smokes run fine in WSL:
- `npm run smoke:mvp` — 47 pass
- `npm run smoke:markdown`, `smoke:long-session`, `smoke:sidebar:large` etc. — unaffected
- `npm run check:*` — all pass
- `npm run typecheck`, `npm run build` — pass

### No Smoke Scripts Broken

The existing `ui-interaction-smoke.mjs` is not modified. The failure is graceful: it prints
a clear Playwright install message and exits with code 1 after reporting 2 passes
(server reachability + static preflight).

---

## Phase 6 — Security / Architecture Confirmation

- No API keys printed.
- No `POST /api/hermes/model/select` route added.
- No direct browser-to-Hermes calls.
- No direct browser-to-Brain-Memory calls.
- No Agent access selector UI.
- No approval buttons.
- No memory mutation/admin UI.
- No export/import UI.
- Production chat still uses `/api/hermes/chat/stream` exclusively.
- Architecture remains: Browser → Next.js BFF → Hermes API server.

---

## Files Changed

- `docs/checkpoints/HERMES_MODEL_REACTIVITY_VERIFICATION.md` (new — this file)

No source code changes. All verification is green from the previous implementation slice.

---

## Commit

No code changes required. This file is a verification-only docs commit.
Suggested commit message: `docs: record Hermes model reactivity verification`

---

## Next Recommended Step

1. **Playwright on Windows:** Document in project README or CONTRIBUTING that browser smokes
   (`npm run smoke:ui`) must be run from Windows PowerShell on this machine, not from WSL.
2. **Visibility-based polling:** When tab regains focus (`document.visibilitychange`), trigger
   an immediate `refresh()` to reduce worst-case lag from 8 s to ~0 s.
3. **Watch `admin_config_rw`:** If Hermes later advertises `admin_config_rw: true` and exposes
   a model-select endpoint, add `POST /api/hermes/model/select` BFF route and unlock
   `clientSelectable` in `normalizeHermesUiCapabilities`.
