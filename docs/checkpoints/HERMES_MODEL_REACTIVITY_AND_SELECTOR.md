# HERMES_MODEL_REACTIVITY_AND_SELECTOR

**Date:** 2026-06-01
**Slice:** Hermes model status reactivity + honest model selector

> **⚠️ Update 2026-06-04:** This checkpoint was written before Hermes model switching was implemented. Runtime model switching now IS supported through `POST /api/sessions/{session_id}/model`. The Web UI BFF route `POST /api/hermes/model/select` and client function `selectHermesModel` are live. See `docs/checkpoints/HERMES_MODEL_SWITCHING_FEATURE_CLOSURE.md` for current status. The reactivity fix, type contract, and polling logic documented here remain accurate and unchanged.

---

## Summary

Fixed the UI not updating when Hermes connects/disconnects after page load.
Made model display honest about server-configured status.
Documented that runtime model switching is NOT supported by the current Hermes API.

---

## Phase 1 — Audit Findings

### BFF Status Response (live Hermes)

```json
{
  "mode": "real",
  "configured": true,
  "reachable": true,
  "baseUrl": "http://127.0.0.1:8642",
  "uiCapabilities": {
    "models": {
      "availableModels": [{ "id": "hermes-agent", "label": "hermes-agent", "provider": "hermes" }],
      "clientSelectable": false,
      "currentModelLabel": "hermes-agent",
      "currentProviderLabel": "Hermes server config",
      "selectionStatus": "server-configured",
      "serverConfiguredOnly": true,
      "uiState": "deferred"
    }
  }
}
```

### Why UI Did Not Update on Hermes Connect

`useHermesStatus` called `refresh()` once on mount via `useEffect`, but had **no polling loop**.
When Hermes started later, no periodic fetch fired, so React state was never updated.
The fix: add `setInterval(refresh, 8000)` with cleanup on unmount.

### Hermes Runtime Model Switching — NOT Supported

Inspected `/home/alexey/.hermes/hermes-agent/gateway/platforms/api_server.py`.
Routes registered:
- `GET /v1/models` — read-only model list
- `GET /v1/capabilities` — reports `admin_config_rw: false`
- No `PUT /model`, `POST /model/select`, `PATCH /config` or equivalent

Capabilities response explicitly shows:
```json
"admin_config_rw": false
```

**Conclusion:** Hermes does not support runtime model switching through any API endpoint.
The model is server-configured in `~/.hermes/config.yaml`. Changing it requires restarting Hermes.
The Web UI **must not** fake a switch. The selector must remain disabled.

---

## Phase 2 — Typed Model Capability Contract

Already present in `HermesUiCapabilities.models`:
- `clientSelectable: boolean` — always `false` (server-configured only)
- `serverConfiguredOnly: boolean` — always `true`
- `selectionStatus: HermesModelSelectionStatus` — `"server-configured"` when Hermes is reachable
- `currentModelLabel: string` — `"hermes-agent"` from `/v1/models`
- `availableModels: HermesModelDescriptor[]` — populated from `/v1/models`
- `reason: string` — explains why switching is disabled

No changes needed to the type contract. All fields were already correct.

---

## Phase 3 — Reactivity Fix

**File:** `apps/web/src/hooks/useHermesStatus.ts`

**Change:** Added polling interval of 8 seconds with proper cleanup:

```typescript
const POLL_INTERVAL_MS = 8_000;

useEffect(() => {
  mountedRef.current = true;
  void refresh();

  intervalRef.current = setInterval(() => {
    void refresh();
  }, POLL_INTERVAL_MS);

  return () => {
    mountedRef.current = false;
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };
}, [refresh]);
```

- `mountedRef` prevents setState after unmount (stale state guard)
- `intervalRef` is cleared on cleanup
- `refresh` is stable (wrapped in `useCallback([])`)
- No duplicate intervals (single `useEffect` with single `setInterval`)

**Behavior after fix:**
- On mount: immediate fetch
- Every 8s: automatic re-fetch of `/api/hermes/status`
- On unmount: interval cleared, no memory leak
- When Hermes connects: next poll (≤8s) detects `mode: "real"`, `reachable: true` → Composer/status panel update without page refresh
- When Hermes disconnects: next poll detects `mode: "error"`, `reachable: false` → UI shows disconnected state

---

## Phase 4 — Model Switching Decision

**Result: NOT IMPLEMENTED — Hermes does not support runtime switching**

The Composer model button remains:
- Always `disabled`
- Shows current model name from Hermes (`hermes-agent`) when connected
- Shows `"Hermes default"` when status is unknown/loading
- Shows `"Hermes unavailable"` when Hermes is unreachable
- Tooltip explains: `"Model is server-configured in Hermes. Runtime switching is not supported by the current API (admin_config_rw is disabled)."`

**No fake switch route was added.** No `POST /api/hermes/model/select` BFF route exists.

---

## Phase 5 — UI Changes

**`ChatView.tsx` — `modelLabelForState` function updated:**

| selectionStatus | Label shown |
|---|---|
| `server-configured` | model ID (e.g. `hermes-agent`) |
| `unavailable` | `Hermes unavailable` |
| `unknown` or no label | `Hermes default` |

**`Composer.tsx` — `modelSelectorTitle` function updated:**

| selectionStatus | Tooltip |
|---|---|
| `server-configured` | "Model is server-configured in Hermes. Runtime switching is not supported..." |
| `unavailable` | "Hermes is not reachable. Model information is unavailable until Hermes connects." |
| others | reason string from capability contract |

---

## Phase 6 — Checks Added

**New script:** `scripts/check-hermes-model-capabilities.mjs`

29 source-level checks covering:
1. Type contract completeness (6 checks)
2. `normalizeHermesUiCapabilities` always produces `clientSelectable: false` (4 checks)
3. `useHermesStatus` polling with cleanup (5 checks)
4. No fake model switch route exists (2 checks)
5. Composer model button is disabled (3 checks)
6. ChatView model label computation (4 checks)
7. BFF route is force-dynamic + no-store (2 checks)
8. Status client uses no-cache fetch (2 checks)

Result: **29/29 pass**

**Added to `package.json`:** `check:hermes-model-capabilities`

---

## Simulation: Hermes Disconnect → Reconnect

Without polling (before fix):
- App loads, Hermes disconnected → shows "not connected" ✓
- Hermes starts → UI still shows "not connected" ✗ (requires page refresh)

With polling (after fix):
- App loads, Hermes disconnected → shows "not connected" ✓
- Hermes starts → within ≤8 seconds, poll fires → BFF returns `mode: "real"` → React state updates → Composer/status panel update automatically ✓

This is verified by the `useHermesStatus` polling logic and the source-level check confirming `setInterval` is present.

---

## Live Hermes Test

- BFF `/api/hermes/status` returns `mode: "real"`, `reachable: true`
- Model: `hermes-agent` (provider: `hermes`)
- Capabilities: `admin_config_rw: false` (confirmed from source)
- Available models from `/v1/models`: `[{ id: "hermes-agent" }]`
- `clientSelectable: false` — correct, switching disabled in UI

---

## Checks Passed

All pre-existing checks still pass (run in Phase 8).
New check `check:hermes-model-capabilities` passes 29/29.

---

## Production Chat Unchanged

- Production chat still uses `/api/hermes/chat/stream` (BFF path)
- No direct browser-to-Hermes path added
- No Agent access selector, approval buttons, or memory mutation UI added
- Runs remains disabled/deferred

---

## Known Limitations

1. Polling interval is 8s — users may see a delay of up to 8s before UI reflects Hermes state change.
   Acceptable for a status indicator; would need WebSocket/SSE for instant update.
2. Model list only shows `hermes-agent` — Hermes does not expose per-provider model catalogs through `/v1/models`.
3. Runtime switching requires Hermes restart and `~/.hermes/config.yaml` edit — out of scope for the Web UI.

---

## Next Recommended Slice

- If Hermes adds `admin_config_rw: true` and a model-switch endpoint, wire `POST /api/hermes/model/select` BFF route
- Consider reducing poll to 5s or adding visibility-based refresh (`document.visibilitychange`)
- Consider debouncing manual refresh button to prevent rapid re-polls
