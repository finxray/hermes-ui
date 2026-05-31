# Hermes Runs Experimental Mode 16G

Date: 2026-05-31

## Purpose

Slice 16G adds an explicit, disabled-by-default experimental Hermes Runs
execution gate. The production composer still uses the current session stream
path by default:

```text
Browser UI -> Next.js BFF /api/hermes/chat/stream -> Hermes /api/sessions/{session_id}/chat/stream
```

The experimental path is BFF-only and is intended for local/dev testing before
any default migration decision.

## Feature Flag

Flag:

```text
HERMES_UI_EXPERIMENTAL_RUNS_MODE=true
```

Default: disabled.

The flag is documented in env templates only as a commented local/dev example.
No env template enables it by default. When the flag is off, the experimental
route returns a normalized disabled response and does not create a Hermes run.

## Route And Script

Route:

```text
POST /api/hermes/runs/experimental-chat
```

Script:

```text
npm run smoke:hermes:runs:experimental-chat
```

The script posts only to the Web UI BFF. Browser code was not changed and no
direct browser-to-Hermes, browser-to-Brain Memory, or browser-to-storage path
was added.

The route validates bounded project/session context, uses the existing
memory-scope bridge instruction when enabled, passes the project stable key as
the Runs memory scope key, creates one Hermes Run through the server-side
Hermes client, reads `/v1/runs/{run_id}/events`, polls status, and returns a
normalized JSON summary for script testing. It does not stream into the
production UI yet.

## Disabled Behavior

Command:

```text
npm run smoke:hermes:runs:experimental-chat -- --base-url http://127.0.0.1:3002 --expect-disabled
```

Result:

| Field | Value |
| --- | --- |
| HTTP status | HTTP 403 |
| Mode | `disabled` |
| Flag | `HERMES_UI_EXPERIMENTAL_RUNS_MODE` |
| Default enabled | `false` |
| Production chat untouched | `true` |

No run was created in disabled mode.

## Enabled Live Result

Command:

```text
npm run smoke:hermes:runs:experimental-chat -- --base-url http://127.0.0.1:3002 --require-hermes
```

Prompt:

```text
Reply exactly: HERMES_RUNS_EXPERIMENTAL_CHAT_OK
```

Result:

| Field | Value |
| --- | --- |
| Mode | `success` |
| Run id | `run_6a1dd54df8574373be1d7d19b09b48b4` |
| Hermes session id | `hermes-session-session-runs-experimental-16g` |
| Project stable key | `studio:local-dev:project:project-runs-experimental-16g` |
| Session stable key | `studio:local-dev:project:project-runs-experimental-16g:session:session-runs-experimental-16g` |
| Final status | `completed` |
| Assistant preview | `HERMES_RUNS_EXPERIMENTAL_CHAT_OK` |
| Output preview | `HERMES_RUNS_EXPERIMENTAL_CHAT_OK` |

Observed event types:

- `message.delta`
- `reasoning.available`
- `run.completed`

Counts:

- events: 10
- message delta events: 8
- tool events: 0
- Brain Memory tool events: 0
- approval events: 0

Brain Memory/tools involved: no for the basic experimental chat prompt.

## Existing Runs Regression Results

The existing harmless Runs probe passed against the same temporary Web UI:

- run id: `run_2a6bd1dbe08a4c58885971ef140192bb`
- final status: `completed`
- event types: `message.delta`, `reasoning.available`, `run.completed`
- tool events: 0
- Brain Memory tool events: 0
- approval events: 0

The existing approval probe passed:

- run id: `run_cd264640c4694aafa783df5306b1d64f`
- outcome: `approval_denied_and_reconciled`
- approval HTTP status: 200
- resolved: 1
- event types included `approval.request`, `approval.responded`,
  `tool.started`, `tool.completed`, `message.delta`, `reasoning.available`,
  and `run.completed`
- no raw secret rendered

The existing Brain Memory Runs parity probe reached live Hermes and live Brain
Memory Gateway but failed in this local environment because the Brain Memory
search/inspect BFF calls lacked a valid UI bearer. The second retry produced
the expected Hermes acknowledgement and 2 Brain Memory tool events, but BFF
search returned an unauthorized normalized error for the marker readback. This
was documented as a live environment auth/config issue, not faked as success.

## UI Readout

No production UI readout was changed in this slice.

No composer Runs selector was added. The composer Agent access selector was not implemented.
No approval buttons were added to the production composer.

## Files Changed

- `.env.example`
- `env/web-ui-with-hermes.env.example`
- `env/web-ui-only.env.example`
- `env/bundle-with-brain-memory.env.example`
- `env/attach-brain-memory-later.env.example`
- `apps/web/src/app/api/hermes/runs/experimental-chat/route.ts`
- `packages/hermes-client/src/index.ts`
- `packages/hermes-client/src/types.ts`
- `scripts/hermes-runs-experimental-chat.mjs`
- `scripts/check-ui-structure.mjs`
- `package.json`
- `docs/checkpoints/HERMES_RUNS_EXPERIMENTAL_MODE_16G.md`
- `docs/architecture/HERMES_RUNS_MIGRATION_ASSESSMENT_16A.md`
- `docs/product/AGENT_ORCHESTRATION_SLICE_PLAN.md`
- `ROADMAP.md`

## Limitations

- The experimental route returns a normalized JSON summary, not a production UI
  stream.
- It does not replace `/api/hermes/chat/stream`.
- It does not add server-side stop to the composer.
- It does not add approval buttons to the composer.
- It does not add a composer Agent access selector.
- It does not prove reconnect/replay correlation for a full Runs migration.
- It does not implement provider/model switching.
- Brain Memory readback requires the local Gateway UI bearer and tenant-bound
  key configuration to be valid.

## Boundaries Confirmed

- Production chat still uses `/api/hermes/chat/stream`.
- No direct browser-to-Hermes path was added.
- No direct browser-to-Brain Memory Gateway path was added.
- No direct browser-to-storage path was added.
- No Brain Memory BFF logic was changed.
- No memory mutation/admin UI was added.
- No project/session stable keys were changed.
- No Hermes source or Brain Memory source was modified.
- No secrets were committed.

## Next Recommended Slice

Slice 16H: Runs default migration decision.

Reason: the Studio now has a disabled-by-default experimental Runs execution
gate that proves a basic run can execute through the BFF without disrupting the
session stream. The next slice should decide, with the new evidence and the
Brain Memory readback auth caveat, whether to keep Runs experimental, expand
the gated path toward streaming/replay parity, or plan a guarded default
migration later.
