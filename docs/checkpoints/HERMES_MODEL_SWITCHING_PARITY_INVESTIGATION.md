# HERMES_MODEL_SWITCHING_PARITY_INVESTIGATION

**Date:** 2026-06-01
**Investigation tool:** Claude Code (claude-sonnet-4-6)
**Commit at start:** 70f90b6
**Working tree at start:** clean

---

## Summary

Investigated how Telegram `/model` works and whether the Web UI can safely support equivalent model switching. Found that the gateway supports **session-level model overrides** internally, but this mechanism is **NOT exposed via the HTTP API** that the Web UI BFF uses. Web UI model switching requires a new Hermes API endpoint.

---

## Part 1 — Telegram /model Source

### Implementation files

| File | Role |
|------|------|
| `~/.hermes/hermes-agent/gateway/run.py` | Gateway main — `_handle_model_command()` at line 10224 |
| `~/.hermes/hermes-agent/hermes_cli/model_switch.py` | Shared model-switching logic (CLI + gateway) |
| `~/.hermes/hermes-agent/gateway/platforms/telegram.py` | Telegram interactive picker — `_handle_model_picker_callback()` at line 2910 |
| `~/.hermes/hermes-agent/hermes_cli/models.py` | Curated model lists and discovery |

### Command flow (Telegram)

1. User sends `/model <name>` or picks from an interactive list
2. `gateway/run.py:_handle_model_command()` parses flags:
   - `--global` → persist to config.yaml
   - `--provider <slug>` → switch provider
   - No flags → session-scoped switch
3. `hermes_cli/model_switch.switch_model()` resolves the model name against available providers/catalogs
4. For **session-scoped** switch (no `--global`):
   - Stores override in `self._session_model_overrides[session_key]` (in-memory dict)
   - Calls `self._evict_cached_agent(session_key)` to force fresh agent creation
5. For **global** switch:
   - Writes `model.default` / `model.provider` to `~/.hermes/config.yaml`
   - Also evicts cached agent

### How override is applied

`gateway/run.py:_apply_session_model_override()` (line 15215):
```python
def _apply_session_model_override(self, session_key, model, runtime_kwargs):
    override = self._session_model_overrides.get(session_key)
    if not override:
        return model, runtime_kwargs
    model = override.get("model", model)
    for key in ("provider", "api_key", "base_url", "api_mode"):
        val = override.get(key)
        if val is not None:
            runtime_kwargs[key] = val
    return model, runtime_kwargs
```

Called before every agent creation for the session.

---

## Part 2 — How API Server Works

### `api_server.py:_create_agent()` (line 956)
- Reads model from `_resolve_gateway_model()` → reads `config.yaml` model.default
- Does NOT accept model from request body
- The `model` field in the OpenAI-compatible `/v1/chat/completions` body is:
  - Captured at line 1784: `model_name = body.get("model", self._model_name)`
  - Echoed back in response at line 1958: `"model": model_name`
  - **NOT passed to `_create_agent()` or `_run_agent()`**
  - **Cosmetic only** — the actual AI call always uses the server-configured model

### `GET /v1/models`
- Returns `hermes-agent` (or active profile name) — this is the only advertised model
- Hardcoded single entry at line 1049

### `GET /v1/capabilities`
- Reports `admin_config_rw: false`

---

## Part 3 — Why Web UI Cannot Switch Models

| Aspect | Telegram /model | Web UI / API Server |
|--------|----------------|-------------------|
| Model resolution | `model_switch.switch_model()` — full provider/alias resolution | N/A |
| Storage | In-memory dict (`_session_model_overrides`) | N/A |
| Agent override | `_apply_session_model_override()` overrides model+provider before agent creation | `_create_agent()` always reads config |
| Persistence | Per-session (lost on restart) or `--global` (writes config.yaml) | N/A |
| Endpoint | Internal gateway method | **No HTTP endpoint exists** |
| Model field in chat body | N/A (direct agent creation) | **Cosmetic only** — echoed in response, not used |

**The blocker is API-surface, not capability.** Hermes (the gateway) CAN switch models per-session. But the API server that the Web UI talks to does NOT expose this capability through any HTTP endpoint.

---

## Part 4 — What Would Be Needed

For the Web UI to support model switching, the Hermes API server would need a new endpoint. Two approaches:

### Approach A: Session-scoped model switch endpoint

```
PATCH /api/sessions/{session_id}
  body: { "model": "openai/gpt-5.5" }
```

Would store the model override for that session, similar to the gateway's `_session_model_overrides` mechanism. The `_create_agent()` method would need to check for session-level overrides.

**Pros:** Clean, scoped, no config mutation
**Cons:** Requires Hermes source change

### Approach B: Per-request model field activation

Make the `model` field in `/v1/chat/completions` actually honored — pass it through to `_create_agent()` / `_run_agent()`.

**Pros:** OpenAI-compatible, minimal change
**Cons:** Per-request model changes may surprise users; no validation against available models

### Recommended: Approach A

Safe, scoped, and explicit. The Web UI would:
1. Read available models from `GET /v1/models` (or from `/api/hermes/status` which already exposes `availableModels`)
2. POST model selection to the BFF
3. BFF calls `PATCH /api/sessions/{session_id}` on Hermes
4. BFF refreshes status
5. Next chat message uses the new model

---

## Part 5 — Updated Web UI Behavior

**No code change in this slice.** The Web UI model selector remains disabled/read-only with updated explanatory copy:

> "Hermes supports model switching via Telegram /model (per-session or global), but a Web UI-safe model switching API is not yet exposed by Hermes. The model is server-configured."

### Updated docs needed

This checkpoint document serves as the record. The previous checkpoints (HERMES_MODEL_REACTIVITY_AND_SELECTOR.md, HERMES_MODEL_REACTIVITY_VERIFICATION.md) should be updated to reference this investigation rather than the inaccurate "not supported" conclusion.

---

## Part 6 — Checks

All pre-existing checks from the repo pass (verified during investigation by checking typecheck, build, and model capabilities checks).

---

## Part 7 — Commit

If docs-only: `git commit -m "docs: investigate Hermes model switching parity"`
No runtime code changes.

---

## Part 8 — Exact Next Recommended Slice

### Short-term (Web UI only — no Hermes changes)

1. **Document the real blocker** in `docs/architecture/HERMES_API_UX_CONTRACT.md` — Web UI needs `PATCH /api/sessions/{session_id}` model field or equivalent.
2. **No code changes to Web UI** — selector stays disabled.

### Medium-term (Hermes change required)

1. Add `PATCH /api/sessions/{session_id}` to `api_server.py` that accepts `{"model": "..."}` and stores it in the session DB.
2. Modify `_create_agent()` to check session DB for model override before falling back to config.
3. Expose the session's active model in `GET /api/sessions/{session_id}` response.
4. Update Web UI BFF to add `POST /api/hermes/model/select` route that calls Hermes session API.
5. Enable `clientSelectable` in the Web UI when the new endpoint is available.

### Long-term

- Consider WebSocket/SSE push for status changes
- Add scope-aware model routing (per-user, per-project)
