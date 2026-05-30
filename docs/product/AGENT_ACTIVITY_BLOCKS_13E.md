# Agent Activity Blocks 13E

Date: 2026-05-30

## Purpose

Slice 13E renders the first Codex-like activity blocks for Hermes UI / Brain
Memory Studio. The blocks consume `AgentActivityEvent` objects from Slice 13D
and show current Hermes tool, memory, run/status, command-like, and error
activity in the chat timeline without changing Hermes streaming behavior or any
Brain Memory backend behavior.

## Files Changed

- `apps/web/src/components/chat/AgentActivityBlock.tsx`
- `apps/web/src/components/chat/AgentActivityBlock.module.css`
- `apps/web/src/components/chat/ChatTranscript.tsx`
- `apps/web/src/components/chat/ChatView.tsx`
- `apps/web/src/lib/agentActivityEvents.ts`
- `package.json`
- `scripts/check-agent-activity-rendering.mjs`
- `scripts/check-ui-structure.mjs`
- `docs/product/AGENT_ACTIVITY_BLOCKS_13E.md`
- `docs/architecture/HERMES_EVENT_NORMALIZATION_PLAN.md`
- `docs/product/AGENT_ACTIVITY_EVENT_MODEL.md`
- `docs/product/AGENT_ORCHESTRATION_SLICE_PLAN.md`
- `ROADMAP.md`

## Component Behavior

`AgentActivityBlock` renders one or more `AgentActivityEvent` objects as compact
timeline activity rows:

- native `details`/`summary` disclosure;
- collapsed details by default;
- compact title, status, summary, source, and duration when available;
- readable redacted JSON/details in a small `pre` when expanded;
- status icon for running, completed, failed, tool, command, memory, and info;
- subtle top/bottom dividers instead of large card framing;
- integrated dark theme styling;
- no `dangerouslySetInnerHTML`.

The component can also render legacy `Session.toolEvents[]` as a fallback. That
keeps existing seeded/local activity visible without changing persisted
workspace state.

## Chat Integration

`ChatView` now keeps a non-persisted in-memory map of live
`AgentActivityEvent[]` by session id. Live Hermes `tool_event`, `run_event`, and
`error` stream events are normalized once and then:

1. appended to the in-memory activity-event buffer for `AgentActivityBlock`;
2. projected back into existing compact `Session.toolEvents[]` for current
   right-rail compatibility.

`ChatTranscript` renders `AgentActivityBlock` after chat messages and before
the active scope references. User messages and assistant messages still render
through `MessageBubble` and keep their existing alignment/readability.

## Grouping Rules

Grouping is intentionally simple:

- adjacent memory events with the same operation/tool identity group together;
- adjacent tool events with the same tool call id/tool name group together;
- adjacent command-like tool events group by command/tool identity;
- run/status events group by event type;
- errors stay visible as failed activity;
- unrelated events remain separate compact rows.

If a started/completed pair is present in the same group, the block displays the
latest terminal status. If both timestamps are available, the block can show a
`Worked for ...` duration. Many current live session events do not yet include
both start and completion timestamps, so durations are shown only when real data
exists.

## Brain Memory Event Presentation

Brain Memory-classified events render with memory-specific titles such as:

- `Stored memory`
- `Searched memory`
- `Checked memory health`
- `Retrieved memory`
- `Updated memory`

The compact row shows status and summary. Expanded details can show memory
operation, project key, session key, memory id, and redacted raw details when
those fields are present.

This is display only. No memory mutation/admin actions were added.

## Generic Tool And Command Presentation

Generic Hermes tools render as tool activity rows with:

- tool title;
- normalized status;
- short summary when present;
- collapsed redacted details.

Command-like tools render as command activity only when the existing classifier
detects command-like names or payload fields such as `command`, `cwd`,
`stdout`, `stderr`, or `exit_code`. The UI does not invent stdout/stderr when
Hermes does not provide it.

## Thinking And Running Shimmer

The transcript shows a lightweight `Thinking...` row while the UI is generating
and no assistant content has arrived yet.

Running activity rows also show a subtle shimmer. The label is generic and does
not expose hidden reasoning or chain-of-thought.

## Collapsed Details And Redaction

Details are collapsed by default. Expanded details show compact JSON generated
from already-redacted `AgentActivityEvent` fields.

The upstream mapper redacts secret-like keys and bearer strings. The rendering
check also verifies that the component path does not reintroduce unredacted
secret values.

## Persisted State

No persisted localStorage/workspace schema changed.

Full `AgentActivityEvent[]` objects are currently kept in React state only for
the live session view. Existing `Session.toolEvents[]` remains the only
persisted activity-like state and is still used by the right rail.

## Live Verification Result

Hermes is live in the current local environment. `smoke:ui:send` verifies that a
message can still stream through the existing BFF path and complete
successfully. Current generic smoke prompts may produce run/status activity but
do not guarantee Brain Memory tool invocation, so Brain Memory activity block
rendering is covered by the local component/mapping checks and will need a
targeted live-memory prompt once Hermes reliably emits those tool events.

## Known Limitations

- Activity blocks are session-level and render after the current transcript
  messages, not yet precisely interleaved by message/run timestamp.
- Full activity events are not persisted across refresh.
- `message.started` and `tool.progress` are still not emitted by the current BFF
  normalizer.
- No approval UI is implemented.
- No real stop/cancel is implemented.
- No files/artifacts UI is implemented.
- Command stdout/stderr rendering remains basic until Hermes emits richer
  command payloads.

## Next Recommended Slice

Slice 13F: thinking/reasoning shimmer and elapsed-time separators.

Reason: this slice added the first real activity rows. The next slice should
improve progress and duration affordances from real `message.started`,
`tool.progress`, and timestamped event data without exposing private reasoning
or changing streaming mechanics.
