# Hermes Runs Replay UI Hydration 16L

Date: 2026-05-31

Base commit before this slice: `e7aff01 feat: prototype Runs RunRecord replay shape`

## Purpose

Slice 16L proves that the experimental Hermes Runs `runRecordPreview` and
`activityReplayPreview` can hydrate the existing Web UI Run history and
persisted replay surfaces without changing the production composer.

This is an experiment-only checkpoint. It does not switch production chat to
Runs and does not add production UI controls.

## Hydration Strategy

Chosen strategy: Option A, test-only browser smoke hydration.

Flow:

1. `npm run smoke:hermes:runs:replay-ui` calls the Web UI BFF route
   `POST /api/hermes/runs/experimental-chat`.
2. With `HERMES_UI_EXPERIMENTAL_RUNS_MODE` off, the script expects HTTP 403
   `mode=disabled`, creates no run, and performs no UI hydration.
3. With the flag on and live Hermes available, the script validates
   `runRecordPreview` and `activityReplayPreview`.
4. The script seeds an isolated Playwright browser context through
   `localStorage` key `hermes-ui.workspace.v1`.
5. The script reloads `/` and verifies the normal Context rail Run history and
   Persisted replay UI render the Runs-backed record.

The production browser code still does not call Hermes directly. The script is
a Node/Playwright diagnostic that calls only the Web UI BFF.

## Feature Flag Behavior

Flag: `HERMES_UI_EXPERIMENTAL_RUNS_MODE=true`

| State | Expected behavior |
| --- | --- |
| Flag off | `POST /api/hermes/runs/experimental-chat` returns HTTP 403 `mode=disabled`; no run is created; no localStorage hydration happens. |
| Flag on | BFF-only experimental route may create one live Hermes Runs chat and return preview data. |
| Production composer | Continues to use `/api/hermes/chat/stream`. |

## UI Verification Matrix

| Surface | Expected result |
| --- | --- |
| Root `/` | App loads from the selected Web UI base URL. |
| Run history | Existing Context rail Run history displays the hydrated Runs-backed run. |
| Hermes run id | `hermesRunId` from the preview is visible in selected-run detail. |
| Status | Hydrated run displays `completed`. |
| Activity summary | Tool/memory/command/approval counts render through the existing metrics. |
| Persisted replay | Existing Persisted replay section displays bounded rows from `activityReplayPreview`. |
| `message.delta` | Not shown as per-token replay rows. |
| Hidden reasoning | No hidden/private reasoning text is visible. |
| Secrets | No bearer/API-key/token-like values are visible. |
| Layout | No horizontal overflow at 1440px smoke viewport. |

## Route Matrix

| Route | Role in 16L |
| --- | --- |
| `/` | Browser hydration target. |
| `/api/hermes/runs/experimental-chat` | Existing feature-flagged BFF route that returns `runRecordPreview` and `activityReplayPreview`. |
| `/api/hermes/chat/stream` | Production chat route; unchanged and still the default composer path. |
| Direct Hermes `/v1/runs` | Not called by browser code; only the Web UI BFF may call Hermes. |

## Script Matrix

| Script | Purpose |
| --- | --- |
| `npm run smoke:hermes:runs:replay-ui` | New Option A hydration smoke. |
| `npm run smoke:hermes:runs:experimental-chat` | Existing BFF response/data-shape smoke. |
| `npm run check:workspace-state` | Confirms Runs preview-shaped run records normalize/persist without changing stable keys. |
| `npm run check:ui-structure` | Guards the 16L smoke/doc contract. |

## Current Result

Results for this slice were gathered against the local Web UI during Slice 16L.

| Check | Result |
| --- | --- |
| Disabled-state replay UI smoke | Passed: flag-off route returned HTTP 403 `mode=disabled`; no UI hydration attempted. |
| Enabled live replay UI smoke | Passed when run against flag-on Web UI and live Hermes. |
| Run history UI | Passed: hydrated Runs-backed record displayed in existing Run history. |
| Persisted replay UI | Passed: bounded replay rows displayed through existing Persisted replay section. |
| Production chat default | Unchanged: `/api/hermes/chat/stream`. |

## Safety Boundaries

- Production chat still uses `/api/hermes/chat/stream`.
- Experimental Runs remains flag-gated.
- No direct browser-to-Hermes path was added.
- No direct browser-to-Brain Memory Gateway path was added.
- No direct browser-to-storage path was added.
- No Brain Memory mutation/admin UI was added.
- No approval buttons were added.
- The composer Agent access selector was not implemented.
- No provider/model switching was implemented.
- No project/session stable keys were changed.
- No Hermes source or Brain Memory source was modified.
- No secrets were printed or committed.

## Known Remaining Issues

- Hydration is test-only through Playwright-local `localStorage`; production UI
  does not yet write Runs previews into workspace state.
- The experiment validates completed runs only; in-flight Runs reconnect and
  pending approval hydration remain future work.
- Stop/cancel reconciliation is still separate from the production composer.
- Replay completeness still depends on bounded BFF preview data, not a durable
  Hermes event replay contract.

## Deferred Features

- Full auth/classification model.
- Production one-command CLI.
- Durable evidence/supersession storage.
- Memory mutation/admin actions.
- Real stop/cancel streaming through the Runs control plane.
- Provider/model selector polish.
- Further UI polish.
- Composer Agent access selector.
- Approval action UI.
- Export/import.

## Next Recommended Slice

Slice 16M: design the gated production Runs execution state machine contract,
without enabling it by default.

Reason: Slice 16L proves the existing UI can render a Runs-backed record after
test hydration. The next safe step is a contract slice for how a future
flag-gated production Runs path would create, update, complete, stop, and
reconcile `RunRecord` state while keeping session stream as the default.
