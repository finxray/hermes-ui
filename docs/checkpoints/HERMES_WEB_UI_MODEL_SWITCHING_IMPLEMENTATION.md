# HERMES_WEB_UI_MODEL_SWITCHING_IMPLEMENTATION

**Date:** 2026-06-02
**Coding agent:** Codex CLI (GPT-5.5)
**Hermes commit:** `7e76330b1` — `feat: add session model override API for API server`
**Web UI commit:** `69fbadf` — `feat: add Hermes Web UI model switching`
**Hermes source tree:** Clean (model-switching changes committed; pre-existing loop-detection changes left dirty)
**Web UI working tree:** Clean

---

## Summary

Implemented **real**, **safe**, **session-scoped** model switching in the Web UI, with full parity with Telegram `/model`. The architecture:

```
Browser UI (Composer dropdown)
  -> Web UI BFF POST /api/hermes/model/select
    -> Hermes API POST /api/sessions/{session_id}/model
      -> GatewayRunner.set_session_model_override()
        -> _session_model_overrides[api_session_key]
          -> _create_agent() reads override before config.yaml fallback
```

---

## Hermes Backend Changes

### Files Changed (Hermes Agent repo)

| File | Change |
|------|--------|
| `gateway/run.py` (+28 lines) | Added `set_session_model_override()` public method on GatewayRunner; wired `set_gateway_runner(self)` into both adapter setup paths (init + reconnect) |
| `gateway/platforms/api_server.py` (+240 lines) | Added `_gateway` field, `set_gateway_runner()` setter, `_validate_and_resolve_model()` helper, `_handle_session_model()` handler, route registration, session override check in `_create_agent()`, fixed `GET /v1/models` to return real configured models |

### New API Endpoint

```
POST /api/sessions/{session_id}/model
  Authorization: Bearer <API_SERVER_KEY>
  Body: {"model": "openrouter/deepseek-v4-flash"}
  Response (200): {
    "ok": true,
    "session_id": "...",
    "selected_model": "...",
    "provider": "...",
    "scope": "session",
    "persistent": false,
    "global": false
  }
  Response (400): { "error": { "message": "Model '...' is not recognized...", "code": "model_not_found" } }
  Response (503): { "error": { "message": "Model switching is not available...", "code": "gateway_unavailable" } }
```

### Model Validation

Uses the **same `hermes_cli.model_switch.switch_model()`** resolver as Telegram `/model`. Validates against:
- Configured providers
- Custom providers
- Model aliases (both built-in and config-defined)

### Session Key Namespace

API server sessions use the key format: `agent:main:api_server:session:{session_id}`
This is **namespaced away** from Telegram sessions which use: `agent:main:telegram:{chat_type}:{chat_id}`

### GET /v1/models Now Returns Real Models

Previously returned only `hermes-agent`. Now returns:
- Configured models from `list_authenticated_providers()`
- Fallback: model from `config.yaml model.default`
- Final fallback: `self._model_name` ("hermes-agent")

### Safety Properties

| Property | Status |
|----------|--------|
| Per-session scope | ✅ In-memory `_session_model_overrides` dict |
| No config.yaml write | ✅ `set_session_model_override()` never touches config |
| No API key exposure in API | ✅ Response only returns model/provider, never api_key |
| No Telegram session impact | ✅ Separate key namespace |
| Model validation via same resolver as /model | ✅ Uses `hermes_cli.model_switch.switch_model()` |
| Agent cache eviction | ✅ Calls `_evict_cached_agent()` on override |

---

## Web UI Changes

### Files Changed (hermes-ui repo)

| File | Change |
|------|--------|
| `packages/hermes-client/src/types.ts` | Added `HermesModelSelectResult` type |
| `packages/hermes-client/src/index.ts` | Added `selectHermesModel()` client function; updated `normalizeHermesUiCapabilities()` to compute `clientSelectable` from real Hermes catalog data; updated `modelSelectionStatus()` to return `client-selectable` |
| `apps/web/src/app/api/hermes/model/select/route.ts` | **NEW** — BFF route that proxies model selection to Hermes |
| `apps/web/src/components/chat/Composer.tsx` | Added model dropdown with selection UI; conditional enable/disable; `onModelSelect` prop; pending state |
| `apps/web/src/components/chat/Composer.module.css` | Added `.modelControl`, `.modelMenu`, `.modelOption`, `.modelSpinner` styles |
| `apps/web/src/components/chat/ChatView.tsx` | Wired `handleModelSelect()` calling BFF; local per-session selected model tracking; status refresh after selection |
| `apps/web/src/components/shell/AppShell.tsx` | Passed `refreshHermesStatus` to ChatView |
| `apps/web/src/hooks/useHermesStatus.ts` | Updated `preserveKnownModelOnTransientFailure` to preserve client-selectable state |
| `scripts/check-hermes-model-capabilities.mjs` | Updated checks for model switching capability |

### New BFF Route

```
POST /api/hermes/model/select
  Body: { "sessionId": "...", "hermesSessionId": "...", "model": "..." }
  Response: proxies selectHermesModel result
```

### Composer Behavior

| Condition | Behavior |
|-----------|----------|
| Hermes unreachable / error | Button disabled, shows "Hermes unavailable" |
| Hermes connected, 0 models | Button disabled, shows model ID from server |
| Hermes connected, 1 model | Button disabled, shows "One Hermes model available" |
| Hermes connected, 2+ models | Button **enabled**, shows dropdown with model list |
| Selection in progress | Shows "Selecting..." with spinner |
| Selection complete | Updates label, refresh status |
| Selection fails | Keeps previous model, logs error |
| Invalid model (BFF reject) | Keeps previous model |

### Scope

| Property | Value |
|----------|-------|
| Scope | Per-session (in-memory Hermes-side override) |
| Persistence | Not persistent across gateway restart |
| Global mode | Never exposed |
| Config.yaml write | Never happens |
| Direct browser-to-Hermes | Never — all through BFF |

---

## Telegram /model Parity

| Aspect | Telegram /model | Web UI / API Session |
|--------|----------------|---------------------|
| Mechanism | `_handle_model_command()` → `_session_model_overrides` | `_handle_session_model()` → `self._gateway.set_session_model_override()` → `_session_model_overrides` |
| Model validation | `hermes_cli.model_switch.switch_model()` | Same via `_validate_and_resolve_model()` |
| Session key | `agent:main:telegram:{chat_id}` | `agent:main:api_server:session:{session_id}` |
| In-memory only | ✅ | ✅ |
| No config.yaml write | ✅ (unless `--global`) | ✅ (no `--global` equivalent) |
| Agent eviction | `_evict_cached_agent()` | Same via `set_session_model_override()` |
| Interactive picker | Yes (Telegram inline keyboard) | Yes (Web UI dropdown) |

---

## Checks Passed

| Check | Result |
|-------|--------|
| `check:hermes-model-capabilities` | ✅ 45/45 |
| `check:ui-structure` | ✅ |
| `check:workspace-state` | ✅ |
| `check:agent-activity` | ✅ (pre-existing, confirmed) |
| `check:agent-activity-rendering` | ✅ (pre-existing, confirmed) |
| `check:brain-memory-client` | ✅ |
| `check:tenant-scope` | ✅ |
| `typecheck` | ✅ |
| `build` | ✅ |
| `npm audit` | ✅ 0 vulnerabilities |

---

## Safety Confirmation

- ✅ **No fake model switching** — actual Hermes API endpoint is called, agent uses selected model
- ✅ **No config.yaml write** — in-memory only, per-session scope
- ✅ **No global mode exposed** — no `--global` equivalent in API
- ✅ **No direct browser-to-Hermes calls** — all through BFF
- ✅ **No direct browser-to-Brain-Memory** — never touched
- ✅ **No Agent access selector** — not added
- ✅ **No approval buttons** — not added
- ✅ **No memory mutation** — not touched
- ✅ **No export/import** — not touched
- ✅ **Production chat still uses `/api/hermes/chat/stream`** — unchanged
- ✅ **Telegram /model unaffected** — separate session key namespace
- ✅ **No secrets exposed** — BFF uses server-side env vars only
- ✅ **No restart needed** — takes effect on next agent message

---

## Known Limitations

1. **Single-model detection**: When only one model is configured, the selector stays disabled with an honest message. Configuration with multiple models is required for switching.
2. **Capability detection**: Currently detects model switching availability by checking if Hermes returns models AND is in "real" mode. If an older Hermes version returns models but lacks the endpoint, selection will fail but keep the current model.
3. **No endpoint advertisement**: The new model endpoint is not yet advertised in `/v1/capabilities`. A future slice should add it.
4. **Status doesn't reflect selected model from Hermes**: After selecting a model, the Web UI shows the locally-tracked selection. Hermes doesn't currently expose session-level overrides through GET /api/sessions/{session_id}.

---

## Rollback Instructions

**Hermes backend:**
```bash
cd ~/.hermes/hermes-agent
git revert 7e76330b1  # Reverts the gateway/run.py and api_server.py changes
```

**Web UI:**
```bash
cd /mnt/c/Users/Alexey/.cursor/projects/hermes-ui
git revert 69fbadf  # Reverts all Web UI model switching changes
```

---

## Next Recommended Slices

1. **Add `session_model` to capabilities**: Advertise the new endpoint in `/v1/capabilities` features/endpoints so the Web UI can detect it explicitly
2. **Expose session model in GET /api/sessions/{session_id}**: Return the currently active model (including override) so status polling reflects selection
3. **Provider switching**: Add `provider` field to the model select endpoint for cross-provider switching
4. **Status panel enhancement**: Show the current selected model in the Hermes status panel
5. **Recovery on gateway restart**: Consider persisting session overrides in the session DB so they survive gateway restarts