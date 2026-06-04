# Hermes Model Switching — Live Verification

**Date:** 2026-06-04
**Hermes commit:** `c52f05653` — session model override capability/effective model
**Web UI commit:** `9d4a905` — harden model switching capability detection

## Service Status

| Service | Status | URL |
|---|---|---|
| Hermes Gateway | ✅ Running (PID 339, 7h uptime) | http://127.0.0.1:8642 |
| Web UI | ✅ Running | http://127.0.0.1:3002 |

## Capability Result

BFF status returned `session_model_override.supported: true` after gateway restart.

## Model List

**33 models available** including claude-opus-4.7, claude-opus-4.6, claude-sonnet-4.6, kimi-k2.6, gpt-5.5, gpt-5.4, qwen3.7-max, and others.

## Smoke Test Result

**13 passed, 0 failed, 0 skipped**

| Step | Result |
|---|---|
| BFF status reachable | PASS |
| Explicit `session_model_override` supported | PASS |
| Available models: 33 | PASS |
| No secrets in status output | PASS |
| Using existing session | PASS |
| Select model A — response ok | PASS |
| Select model A — effective model confirmed | PASS |
| Select model B — response ok | PASS |
| No secrets in select response | PASS |
| `config_write` is false | PASS |
| `global_supported` is false | PASS |
| `persistent` is false | PASS |

## One-Model vs Multi-Model

Multi-model behavior verified (33 models). Model A (`anthropic/claude-opus-4.7`) selected and confirmed. Model B (`anthropic/claude-opus-4.6`) selected. Session-scoped, in-memory only.

## Manual Runbook

Created at `docs/runbooks/HERMES_MODEL_SWITCHING_MANUAL_TEST.md`

## Checks Run

- `check:hermes-model-capabilities`: 51 passed
- `check:ui-structure`: passed
- `check:workspace-state`: passed
- `check:agent-activity`: 36 passed
- `check:agent-activity-rendering`: 35/36 passed (1 pre-existing notes discrepancy)
- `check:brain-memory-client`: passed
- `check:tenant-scope`: passed
- `typecheck`: 0 errors
- `build`: 0 errors
- `npm audit`: 0 vulnerabilities

## Safety Invariants Confirmed

- ✅ No fake model switching
- ✅ No config.yaml write (`config_write: false`)
- ✅ No global mode (`global_supported: false`)
- ✅ No direct browser-to-Hermes path
- ✅ Production chat still uses `/api/hermes/chat/stream`
- ✅ Telegram `/model` unaffected (separate namespace)
- ✅ Model override is session-scoped, in-memory only

## Known Limitations

- Session-scoped model override resets on gateway restart (in-memory)
- BFF has no session creation endpoint — smoke reuses existing sessions
- Live smoke requires both Web UI and Hermes gateway running