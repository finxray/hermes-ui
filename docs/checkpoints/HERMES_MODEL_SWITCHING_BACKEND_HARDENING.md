# Hermes Model Switching Backend Hardening

> **✅ Status:** Implemented and live verified as of 2026-06-04. See `docs/checkpoints/HERMES_MODEL_SWITCHING_FEATURE_CLOSURE.md` for full closure report.

## Summary

Added explicit capability discovery, effective session model exposure, BFF-level capability detection, smoke tests, and source checks for the Hermes Web UI model-switching feature. The model-switching implementation was already in place (Hermes commit `8661e3620`, Web UI commit `69fbadf`); this hardening makes it explicitly discoverable and verifiable.

## Hermes Files Changed

| File | Change |
|---|---|
| `gateway/platforms/api_server.py` | Added `session_model_override` to `GET /v1/capabilities` response, added `session_model` endpoint entry, extended `_session_response()` with effective-model fields, added `_api_session_override_key()` helper, added `_gateway_model_defaults()` helper, enriched `POST /api/sessions/{session_id}/model` response. |

## Web UI Files Changed

| File | Change |
|---|---|
| `packages/hermes-client/src/types.ts` | Added `sessionModelOverrideCapable` and `explicitOverrideSupported` to `HermesUiCapabilities.models` |
| `packages/hermes-client/src/index.ts` | Updated `normalizeHermesUiCapabilities` to read `session_model_override.supported` from capabilities; updated `clientSelectable` to use explicit capability flag; enriched `models` block with new fields |
| `scripts/hermes-model-switch-smoke.mjs` | New smoke script for live model selection testing through BFF |
| `scripts/check-hermes-model-capabilities.mjs` | Added 6 new checks for explicit capability, smoke script, no direct Hermes calls |
| `package.json` | Added `smoke:hermes:model-switch` NPM script |
| `docs/checkpoints/HERMES_MODEL_SWITCHING_BACKEND_HARDENING.md` | This file |

## Capability Fields Added

### Hermes `GET /v1/capabilities`

```json
{
  "session_model_override": {
    "supported": true,
    "scope": "session",
    "persistent": false,
    "global_supported": false,
    "config_write": false,
    "description": "Per-session model override via POST /api/sessions/{session_id}/model. Stored in memory only. Does not write config.yaml. Telegram /model uses a separate namespace and is unaffected."
  },
  "endpoints": {
    "session_model": {"method": "POST", "path": "/api/sessions/{session_id}/model"}
  }
}
```

### Web UI `HermesUiCapabilities.models`

- `sessionModelOverrideCapable: boolean` — mirrors `session_model_override.supported` from Hermes
- `explicitOverrideSupported: boolean` — parsed from capabilities response

## Effective Session Model Behavior

### `GET /api/sessions/{session_id}`

Extended with:
- `effective_model` — override model if active, else config default
- `effective_provider` — override provider if active, else config provider
- `model_override_active` — true when session has an active override
- `model_override_scope` — `"session"` if active, null otherwise
- `model_override_persistent` — always `false`

### `POST /api/sessions/{session_id}/model` Response

Extended with:
- `model` — the resolved model ID
- `api_mode` — the API mode for the selected model
- `effective_model` — same as selected model
- `effective_provider` — resolved provider
- `model_override_active` — always `true` on successful override

## Smoke Script Behavior

`scripts/hermes-model-switch-smoke.mjs`:
1. Fetches BFF `/api/hermes/status` (not direct Hermes)
2. Checks explicit `session_model_override.supported` capability
3. Lists available models from status
4. Verifies no secrets in output
5. If 2+ models: selects model A → B, verifies response
6. If 1 model: reports single-model configured, tests invalid model rejection
7. Verifies `config_write: false`, `global_supported: false`, `persistent: false`

## Safety Invariants

- No `config.yaml` write path
- No global model switching exposure
- No API keys or secrets returned in session responses
- Telegram `/model` uses separate namespace (`agent:main:telegram:*` vs `agent:main:api_server:*`)
- Wire protocol: browser → Web UI BFF → Hermes (`POST /api/sessions/{session_id}/model`)
- Production chat uses `/api/hermes/chat/stream`
- Effective model is in-memory only — lost on gateway restart

## Known Limitations

- Effective session model state is in memory only (disappears on gateway restart)
- Global status cannot identify the active model for every UI session — clients must query the specific session or use model-select response
- Full live smoke coverage depends on running Web UI + Hermes API server
- `clientSelectable` requires >=2 models + explicit capability + session_model endpoint
