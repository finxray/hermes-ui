# Thinking And Elapsed UX 13F

Date: 2026-05-30

## Purpose

Slice 13F tightens the progress affordances around live Hermes runs without
changing Hermes streaming behavior, Brain Memory behavior, project/session
stable keys, or any memory mutation/admin surface.

The goal is simple: the UI should feel alive while work is happening, show
honest elapsed-time markers when timing is known, and avoid exposing hidden or
private chain-of-thought.

## Files Changed

- `apps/web/src/components/chat/AgentActivityBlock.tsx`
- `apps/web/src/components/chat/ChatView.tsx`
- `apps/web/src/lib/agentActivityEvents.ts`
- `scripts/check-agent-activity-events.mjs`
- `scripts/check-agent-activity-rendering.mjs`
- `docs/product/THINKING_ELAPSED_UX_13F.md`
- `docs/product/AGENT_ACTIVITY_EVENT_MODEL.md`
- `docs/architecture/HERMES_EVENT_NORMALIZATION_PLAN.md`
- `docs/product/AGENT_ORCHESTRATION_SLICE_PLAN.md`
- `ROADMAP.md`

## Thinking And Shimmer Behavior

The transcript can still show a generic `Thinking...` row while a live Hermes
send is active and no assistant text has arrived.

If the latest live activity event is more specific and active, such as a
running tool, memory event, queued event, or approval wait, that specific
activity row replaces the generic thinking row. This keeps the UI from showing
only a vague thinking label when Hermes has already provided a safer public
status signal.

Running activity rows keep the existing subtle shimmer. No visual redesign was
made in this slice.

## No Chain-Of-Thought Policy

This slice does not render hidden/private chain-of-thought, does not invent
reasoning text, and does not add public reasoning summaries.

Allowed generic labels remain:

- `Thinking...`
- `Working...`
- `Running tool...`
- `Searching memory...`
- `Worked for 14s`

Current implementation uses `Thinking...` and event-specific public titles such
as `Searched memory`, `Run Started`, or `Ran shell` when those events are
available. If a future Hermes release provides explicit public reasoning
summaries, that should be handled in a separate capability-gated slice.

## Duration Formatting

`formatActivityDuration` now normalizes elapsed durations consistently:

| Duration | Label |
| --- | --- |
| `0ms` | `0s` |
| `1ms` to `999ms` | `<1s` |
| seconds | `12s` |
| minutes | `2m 14s` |
| hours | `1h 2m 3s` |

Negative, missing, or invalid timestamp pairs do not produce elapsed markers.

## Elapsed Separators

For real Hermes sends, `ChatView` captures a UI-local send start timestamp
immediately before opening the existing BFF stream. When the stream finishes or
reports an error through the existing stream event channel, the UI appends an
informational `elapsed` activity event such as `Worked for 3s`.

This is a display-only marker. It does not change the Hermes request, stream
parser, Brain Memory route, memory scope bridge, or persisted workspace schema.

Run/status groups can also derive durations when start and completion
timestamps are available on adjacent activity events with the same Hermes run
id.

## Activity Block Interaction

Activity blocks still use native `details`/`summary` and remain collapsed by
default. The interaction change is behavioral:

- generic `Thinking...` appears only while there is no more specific active
  public activity event;
- run status events with the same Hermes run id group together;
- completed groups display `Worked for ...` when a safe duration can be
  derived;
- expanded details continue to show redacted JSON only.

## Tests And Checks

The activity event check now covers:

- elapsed event creation;
- subsecond, second, minute, and hour duration labels;
- safe timestamp parsing;
- duration derivation from activity events;
- existing Brain Memory/tool/command/run/error mapping;
- secret redaction.

The rendering check now covers:

- collapsed native details;
- generic thinking shimmer;
- no private reasoning or chain-of-thought labels in the renderer;
- specific active activity suppressing generic thinking;
- elapsed marker creation from `ChatView`;
- duration formatting behavior;
- redacted details.

## Boundaries Confirmed

No Hermes production streaming logic was changed.

No Brain Memory BFF logic was changed.

No memory scope bridge behavior or stable project/session keys were changed.

No memory mutation/admin action was added.

No direct browser-to-Hermes, browser-to-Brain Memory Gateway, or direct storage
access was added.

## Known Remaining Issues

- Activity events are still live React state only, not persisted normalized run
  history.
- Activity rows are still rendered after the transcript, not interleaved by
  precise per-message timestamps.
- The BFF does not yet expose `message.started` or `tool.progress` as richer
  normalized public progress events.
- Stop/cancel remains placeholder behavior.
- Approvals, files/artifacts, and richer command stdout/stderr rendering remain
  future slices.

## Next Recommended Slice

Slice 13G: real stop/cancel stream support.

Reason: the UI now has honest progress and elapsed markers for live work. The
next highest-value orchestration gap is replacing the placeholder stop control
with verified Hermes interruption semantics.
