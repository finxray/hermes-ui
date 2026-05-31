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

## Slice 16M Runs Approval Contract Update

Slice 16M defines the future Runs approval action contract without adding
buttons. A future Runs-backed composer may enter `waiting_for_approval` after
the BFF observes `approval.request`. The browser may submit a choice only to
the Web UI BFF, and the BFF must validate run ownership, project/session scope,
allowed choices, and Agent access policy before calling
`/v1/runs/{run_id}/approval`.

Approval controls remain unavailable on the current session-stream composer.
The Agent access selector is documented as future-only and must not appear
enabled until enforcement exists. See
`docs/architecture/HERMES_RUNS_EXECUTION_STATE_MACHINE_16M.md`.

## Slice 16N Approval Envelope Update

Slice 16N defines the future BFF approval envelope for a route such as
`POST /api/hermes/runs/{localRunId}/approval`. The browser would send
`projectId`, `sessionId`, `localRunId`, `hermesRunId`, `approvalId`, and one
of `once`, `session`, `always`, or `deny`; the BFF would validate ownership,
active waiting state, allowed choices, and Agent access policy before calling
Hermes.

This remains contract-only. No production approval action route, approval
buttons, composer Runs route, or Agent access selector was implemented. See
`docs/architecture/HERMES_RUNS_BFF_EVENT_CONTRACT_16N.md`.

## Slice 16R Agent Access Policy Update

Slice 16R adds
`docs/architecture/AGENT_ACCESS_APPROVAL_POLICY_16R.md` as the future approval
and access-mode policy contract. The documented request values are
`chat_only`, `read_only_tools`, `ask_before_tools`, `full_access`, and
`custom`. These are policy metadata only until the BFF can validate the mode,
Hermes Runs can enforce tool/approval behavior, and source checks prove the UI
selector is not decorative.

The disabled production-shaped Runs route now echoes redacted validation
posture for `agentAccessMode` while still returning HTTP 501. No approval
buttons, BFF approval action route, production Runs execution, composer Runs
switch, or composer Agent access selector UI was implemented.

## Next Recommended Slice

Slice 16S - disabled Runs policy fixture matrix and source-only Agent access
rendering guard.

Reason: approval display and future access semantics are documented, but still
not enforceable from the composer. The next safe step is a pure fixture matrix
that proves each future mode maps to allowed, blocked, and approval-required
behavior before any selector UI appears.
