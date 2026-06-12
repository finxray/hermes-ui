# Hermes Web UI Model Switching — Feature Closure

**Date:** 2026-06-04
**Status:** **IMPLEMENTED AND LIVE VERIFIED**

---

## Feature Summary

Hermes Web UI model switching allows users to select among configured Hermes models at the session level through the Web UI BFF. The feature is session-scoped, in-memory only, and does not write config.yaml or affect other sessions/platforms.

---

## Commits

### Hermes

| Hash | Message | Area |
|---|---|---|
| `8661e3620` | feat: add session model override API for API server | `POST /api/sessions/{session_id}/model` endpoint |
| `c52f05653` | feat: expose session model override capability and effective session model | Capability discovery, session response enrichment |
| `aa8567b02` | fix(security): add allow_config_write guard with timestamped backup for config.yaml | Safety — prevents accidental config.yaml writes |
| `9c3cf9a53` | fix(agent): strip reasoning replay fields for strict OpenAI-compatible APIs (Cerebras) | Provider compatibility |
| `fa1405b9f` | docs: migrate MESSAGING_CWD references to terminal.cwd across docs, migration, and config examples | Docs consistency |

### Web UI

| Hash | Message | Area |
|---|---|---|
| `69fbadf` | feat: add Hermes Web UI model switching | Initial implementation |
| `ef1316b` | docs: record Hermes Web UI model switching implementation | Documentation |
| `9d4a905` | test: harden Hermes model switching capability detection | Source checks + smoke |
| `2cc3df9` | docs: verify Hermes model switching live path | Live verification docs |
| `983c92b` | test: update MVP smoke for model switching status | MVP smoke validator |
| `ef49d03` | style: align main background contract with Codex-like gradient | Visual polish |
| *this commit* | docs: close Hermes Web UI model switching feature | Feature closure |

---

## Endpoint Summary

### Hermes API Endpoints

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/v1/capabilities` | Returns `session_model_override.supported: true`, scope, persistence, safety flags |
| `GET` | `/v1/models` | Returns configured model list. `owned_by` is a catalog/routing owner, not always the final runtime provider |
| `POST` | `/api/sessions/{session_id}/model` | Set session-scoped model override; body: `{ model: string, provider?: string, scope?: "session" }` |
| `GET` | `/api/sessions/{session_id}` | Returns `effective_model`, `effective_provider`, `model_override_active`, override scope |

### Web UI BFF Routes

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/hermes/status` | Normalized status with `uiCapabilities.models.clientSelectable` |
| `POST` | `/api/hermes/model/select` | Proxies model selection to Hermes through BFF |
| `POST` | `/api/hermes/chat/stream` | Production chat (unchanged) |

---

## Behavior

| Property | Value |
|---|---|
| **Scope** | Session-scoped only |
| **Persistence** | In-memory only (lost on gateway restart) |
| **Config write** | Never — config.yaml is not written from the Web UI path |
| **Global mode** | Never exposed |
| **Telegram** | Unaffected — uses separate `agent:main:telegram:*` namespace |
| **Client selection enabled** | Only when: mode === "real", session_model_override.supported, ≥2 models available, session_model endpoint present |
| **Single model** | Selection disabled; selector shows server-configured model |
| **Multi-model** | Full selection enabled; model A ↔ model B verified |
| **Browser-to-Hermes** | Never — all calls go through Web UI BFF |
| **Production chat** | `/api/hermes/chat/stream` — unchanged |
| **Invalid model** | Rejected with 400 |
| **Secrets** | Never returned in status or model select responses |
| **Provider display** | Raw routing keys are preserved for Hermes, but UI displays the selected catalog provider family such as `Cerebras` or `OpenRouter` |
| **Provider truth** | After selection, `effective_model` from Hermes session detail is authoritative; `effective_provider` may be a lower-level backend route |
| **UI-provided models** | Additional OpenRouter models are discovered through the Web UI BFF and sent through Hermes as per-turn OpenRouter overrides |

### Provider Resolution Notes

Live Hermes may resolve a model through a provider that differs from the `/v1/models[*].owned_by` catalog owner. The Web UI must not treat that as a failure when Hermes verifies the requested `effective_model`.

Observed examples:

- `gpt-oss-120b` and `zai-glm-4.7` advertise `owned_by: cerebras-gpt-oss-120b`, but user-facing UI should show provider `Cerebras`.
- `moonshotai/kimi-k2.6` can advertise `owned_by: openrouter` while session detail verifies `effective_provider: nvidia`. This should settle as `Kimi K2.6 / OpenRouter` in user-facing UI, not flash a failed OpenRouter warning.
- Claude models can appear as both routed OpenRouter ids such as `anthropic/claude-sonnet-4.6` and direct Anthropic aliases such as `claude-sonnet-4-6`. When both are present, the Composer should keep the OpenRouter entry and hide the direct duplicate alias.
- `qwen/qwen3.7-max` verifies cleanly through `OpenRouter`.

### Extended Model Browser

The Composer model control opens a large tinted glass model browser instead of a narrow dropdown. It includes search and separates:

- `Hermes config`: models returned by Hermes `/v1/models`.
- `UI OpenRouter catalog`: models returned by the Web UI BFF route `/api/model-catalog/openrouter`, backed by OpenRouter `/api/v1/models`.

`Hermes config` order is stable: `DeepSeek V4 Flash` is first as the project default, followed by `GPT OSS 120B`, then `Zai GLM 4.7`, then the remaining configured models by label/id. DeepSeek is synthesized into this section if Hermes does not advertise it in `/v1/models`; it still routes through OpenRouter as a per-turn model when used.

Selecting a Hermes-configured model uses the full session path: Composer -> Web UI BFF -> Hermes session model select -> Hermes session readback.

Selecting a UI OpenRouter catalog model uses a turn-scoped path because Hermes currently rejects non-`/v1/models` entries from `/api/sessions/{session_id}/model`: Composer -> Web UI BFF -> Hermes session chat stream with `model` and `provider: openrouter` in the body. The browser never calls OpenRouter or Hermes directly.

---

## Live Verification Result

**Date:** 2026-06-04
**Services:** Hermes Gateway @ `http://127.0.0.1:8642`, Web UI @ `http://127.0.0.1:3002`
**Models:** 33 configured via OpenRouter

**Model-switch smoke:** **13/13 passed, 0 failed, 0 skipped**

| Step | Result |
|---|---|
| BFF status endpoint reachable | ✅ |
| Explicit `session_model_override` supported | ✅ |
| Available models: 33 | ✅ |
| No secrets in status output | ✅ |
| Using existing session | ✅ |
| Select model A — response ok | ✅ |
| Select model A — effective model confirmed | ✅ |
| Select model B — response ok | ✅ |
| No secrets in model select response | ✅ |
| `config_write` is false | ✅ |
| `global_supported` is false | ✅ |
| `persistent` is false | ✅ |

**MVP smoke:** **47 passed, 0 failed, 1 warned** (Brain Memory mock — expected)

---

## Source Checks

| Check | Result |
|---|---|
| `check:hermes-model-capabilities` | ✅ 51 passed |
| `check:ui-structure` | ✅ passed |
| `check:workspace-state` | ✅ passed |
| `check:agent-activity` | ✅ 36 passed |
| `check:agent-activity-rendering` | ✅ 35/36 (1 pre-existing notes discrepancy) |
| `check:brain-memory-client` | ✅ passed |
| `check:tenant-scope` | ✅ passed |
| `typecheck` | ✅ 0 errors |
| `build` | ✅ 0 errors |
| `npm audit` | ✅ 0 vulnerabilities |

---

## Safety Invariants (All Confirmed)

- ✅ No fake model switching
- ✅ No config.yaml write (`config_write: false`)
- ✅ No global mode (`global_supported: false`)
- ✅ No direct browser-to-Hermes path
- ✅ Production chat still uses `/api/hermes/chat/stream`
- ✅ Telegram `/model` unaffected (separate namespace)
- ✅ Model override is session-scoped, in-memory only
- ✅ Stashes not restored (Web UI `stash@{0}` dropped; Hermes `stash@{0}` dropped)
- ✅ Secrets never leaked

---

## Manual Testing

See `docs/runbooks/HERMES_MODEL_SWITCHING_MANUAL_TEST.md` for full manual test runbook covering:
- Service verification (Hermes gateway + Web UI)
- Smoke execution
- Manual UI composer dropdown checks
- One-model behavior
- Multi-model behavior
- Safety checklist

---

## Known Limitations

1. **In-memory only** — model override resets on Hermes gateway restart
2. **Session-scoped only** — no global/static model switching
3. **No session creation BFF endpoint** — model-select smoke reuses existing Hermes sessions
4. **Live smoke requires both services** — Web UI + Hermes gateway must be running
5. **BFF no-cache** — status polling (8s interval) detects capability changes; not instant

---

## Related Documents

- `docs/runbooks/HERMES_MODEL_SWITCHING_MANUAL_TEST.md` — Manual test runbook
- `docs/checkpoints/HERMES_MODEL_SWITCHING_BACKEND_HARDENING.md` — Backend hardening details
- `docs/checkpoints/HERMES_MODEL_SWITCHING_LIVE_VERIFICATION.md` — Live verification report
- `docs/checkpoints/HERMES_MODEL_REACTIVITY_AND_SELECTOR.md` — Reactivity/selector foundations (see update note)
- `docs/architecture/HERMES_API_UX_CONTRACT.md` — Architecture contract (section 11 updated)
