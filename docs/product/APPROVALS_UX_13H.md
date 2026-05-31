# Slice 13H - Hermes Approvals UX

Date: 2026-05-30

## Goal

Represent Hermes approval events safely in the current production UI without
adding direct browser-to-Hermes calls or pretending that run-scoped approval
responses are available on the current session-stream chat path.

## Hermes Approval Surface Discovered

Current Hermes source and docs expose approvals through the Runs API:

| Surface | Status | Notes |
| --- | --- | --- |
| `GET /v1/capabilities` | available | Advertises `approval_events` and `run_approval_response`. |
| `POST /v1/runs` | available | Creates a run id and registers the active approval session key. |
| `GET /v1/runs/{run_id}/events` | available | Streams run lifecycle events, including approval events. |
| `POST /v1/runs/{run_id}/approval` | available | Resolves the pending approval for an active run. |
| `approval.request` | available on run stream | Payload is augmented with `run_id`, `timestamp`, and choices. |
| `approval.responded` | available on run stream | Emitted after successful approval resolution. |

Verified approval choices:

- `once`
- `session`
- `always`
- `deny`

Hermes also accepts `approve`, `approved`, and `allow` as aliases for `once`.
The approval action body may include `all` or `resolve_all`.

## Current Session Stream Path

Production chat currently uses:

```text
Browser -> /api/hermes/chat/stream -> Hermes /api/sessions/{session_id}/chat/stream
```

The inspected session-stream handler emits `run.started`,
`message.started`, `assistant.delta`, `assistant.completed`, `run.completed`,
`error`, `done`, and selected tool events. It does not register a run approval
session or forward `approval.request` from the approval gateway.

Because approval responses are run-scoped and require an active run tracked by
Hermes' `/v1/runs` control plane, this slice did not add approval action
buttons or a BFF approval action route.

## UI Behavior

Slice 13H adds a tolerant approval event model:

- `HermesChatStreamEvent` now preserves `approval.*` SSE frames as
  `approval_event`.
- `AgentActivityEvent` now has an optional `approval` object with id, choices,
  decision, prompt, action, risk, response time, and action availability fields.
- `approval.request` maps to `type: "approval"` and
  `status: "waiting_for_approval"`.
- `approval.responded` maps to `status: "completed"` unless the decision is a
  denial/rejection.
- Denied/rejected approval responses map to `status: "cancelled"` so the
  transcript does not imply that a risky action was approved.
- Approval details are redacted with the same rules used for tool and memory
  events.

Approval rows render in the transcript activity block with:

- title such as `Approval required` or `Approval responded`;
- status label `waiting`, `completed`, or `cancelled`;
- approval id, decision, risk, and run id when available;
- raw redacted details behind the existing collapsed details control;
- display-only safety copy: `Approval action unavailable in current stream path`.

No approve/reject controls are shown in this slice.

## BFF Approval Route Decision

No BFF approval action route was added.

Reason:

- The current production chat path is session-stream based, not run-submission
  based.
- Hermes' approval resolution endpoint is run-scoped:
  `/v1/runs/{run_id}/approval`.
- The session-stream handler creates a local `run_id` for event metadata, but it
  does not register that id in the Runs API approval session tables.
- Sending an approval action without the Runs API control plane would be
  unreliable and could produce false-success UX.

Future approval actions should be added only after the BFF owns the
`/v1/runs` lifecycle for chat turns or can otherwise prove that a current stream
approval is backed by an active run approval session.

Slice 16A update:

`docs/architecture/HERMES_RUNS_MIGRATION_ASSESSMENT_16A.md` rechecked current
Hermes Runs API behavior and confirmed that approval responses remain
run-scoped through `POST /v1/runs/{run_id}/approval`. The recommendation is to
keep approvals display-only on the current session-stream path and add approval
actions only after an experimental BFF-owned Runs path proves event and Brain
Memory scope parity.

## Safety Boundaries

Unchanged boundaries:

- Browser code still calls only the Web UI BFF.
- No browser-to-Hermes direct calls were added.
- No browser-to-Gateway direct calls were added.
- No Brain Memory mutation or admin actions were added.
- No direct storage access was added.
- No auth/classification model was implemented.
- No secrets were committed.

## Verification

Focused checks added or updated:

- `npm run check:agent-activity`
- `npm run check:agent-activity-rendering`

These checks cover approval request mapping, approval response mapping, denial
status, missing approval id handling, redaction, display-only rendering, and the
absence of approval action handlers in the activity component.

Broader regression checks should still run before merging each slice:

- `npm run check:workspace-state`
- `npm run check:brain-memory-client`
- `npm run studio:doctor`
- `npm run check:ui-structure`
- `npm run typecheck`
- `npm run build`
- `npm audit --audit-level=moderate`
- `npm run smoke:ui`
- `npm run smoke:ui:send` when Hermes is reachable
- `npm run smoke:ui:stop` when Hermes is reachable

## Deferred

- BFF run-submission path for chat turns.
- BFF approval action route.
- Approval buttons for `once`, `session`, `always`, and `deny`.
- Durable approval audit history.
- Auth/classification policy for approval-sensitive actions.
- Gateway-mediated Brain Memory admin/mutation actions.

## Next Recommended Slice

Slice 13I - Files/Artifacts Panel.

Reason: approvals are now safely represented as display-only events, while
actionable approvals should wait for a future run-backed chat path. The next
roadmap slice can add artifact visibility without changing Hermes streaming,
Brain Memory mutation, or approval control-plane behavior.
