# Hermes Model Switching — Manual Test Runbook

## Prerequisites

- Hermes gateway running
- Web UI running on port 3002
- Both repos clean (no dirty stash)

## Step 1: Verify Hermes

```bash
# Check gateway status
hermes gateway status

# Check health endpoint
curl -i http://127.0.0.1:8642/health

# Check capabilities include session_model_override
curl -s http://127.0.0.1:3002/api/hermes/status | python3 -c "
import json,sys
d=json.load(sys.stdin)
caps=d.get('capabilities',{})
smo=caps.get('session_model_override',{})
print('session_model_override.supported:', smo.get('supported'))
print('Models:', len(caps.get('features',{}).get('models',[])))
"
```

Expect:
- Gateway `active (running)`
- Health returns `{"status": "ok"}`
- `session_model_override.supported: true`
- One or more models listed

## Step 2: Start Web UI (if not running)

```bash
cd C:\Users\Alexey\.cursor\projects\hermes-ui
npm run studio:web -- --port 3002
```

## Step 3: Verify Launch

```bash
npm run studio:launch -- --check --base-url http://127.0.0.1:3002
```

Expect all checks passed (especially `hermes-bff-status: real/reachable`).

## Step 4: Run Smoke Test

```bash
npm run smoke:hermes:model-switch -- --base-url http://127.0.0.1:3002 --require-hermes
```

Expect 0 failures. The smoke test:
1. Fetches BFF status (not direct Hermes)
2. Checks explicit `session_model_override.supported` capability
3. Lists available models
4. Verifies no secrets in output
5. Finds an existing session or reports session creation limitation
6. Selects model A, verifies effective model changed
7. Selects model B, verifies switch
8. Verifies invalid model rejection (400)
9. Verifies safety invariants: no config_write, no global_supported, no persistent

## Step 5: Manual UI Checks

| Check | Expected |
|---|---|
| Composer model dropdown | Shows configured models |
| Selecting a model | Calls Web UI BFF `/api/hermes/model/select` |
| Selected model updates in composer | Label changes to show selected model |
| Message send still works | Chat sends after model change |
| Page refresh | Selection preserved while Hermes is running |
| Hermes restart | In-memory override cleared |
| Telegram `/model` | Separate namespace, unaffected |

## One-Model Behavior

- Selector may be disabled or read-only
- No fake switching occurs
- Smoke exits with `single_model_configured` status

## Multi-Model Behavior

- Selector enabled
- Session-scoped switch
- No config.yaml write
- No global mode exposure

## Architecture

```
Browser UI
  -> Web UI BFF (Next.js, port 3002)
    -> Hermes API server (port 8642)
      -> POST /api/sessions/{session_id}/model (session-scoped, in-memory)
```

Production chat: `/api/hermes/chat/stream`
Telegram `/model`: separate namespace, unaffected.