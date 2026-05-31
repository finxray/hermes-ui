# Brain Memory Event Timeline 13K

Date: 2026-05-31

## Scope

Slice 13K adds the first read-only Brain Memory event timeline in the right
rail Memory tab.

The architecture remains:

```text
Browser UI -> Next.js BFF -> Hermes API server / Brain Memory Gateway UI API
```

No direct browser-to-Hermes, browser-to-Brain Memory Gateway, direct storage,
provider call, provider credential, Hermes source, Brain Memory source, or
Brain Memory mutation path was added.

## Files Changed

- `apps/web/src/components/shell/AppShell.tsx`
- `apps/web/src/components/chat/ChatView.tsx`
- `apps/web/src/components/shell/ContextRail.tsx`
- `apps/web/src/components/memory/BrainMemoryConsole.tsx`
- `apps/web/src/components/memory/BrainMemoryConsole.module.css`
- `apps/web/src/lib/memoryTimeline.ts`
- `scripts/check-agent-activity-rendering.mjs`
- `scripts/mvp-smoke.mjs`
- `scripts/ui-interaction-smoke.mjs`
- `docs/product/BRAIN_MEMORY_EVENT_TIMELINE_13K.md`
- `docs/product/AGENT_ACTIVITY_EVENT_MODEL.md`
- `docs/architecture/HERMES_EVENT_NORMALIZATION_PLAN.md`
- `docs/product/AGENT_ORCHESTRATION_UX_CONTRACT.md`
- `docs/product/AGENT_ORCHESTRATION_SLICE_PLAN.md`
- `ROADMAP.md`

## Memory Event Source Model

The timeline is derived from existing normalized `AgentActivityEvent` objects.
Live Hermes stream tool/run/error events are still normalized in `ChatView`
through the existing frontend mapping helpers. Slice 13K lifts the in-memory
activity-event buffer to `AppShell` so both the chat transcript and right rail
can read the current session's live events.

Full `AgentActivityEvent[]` objects are still not persisted. The existing
`Session.toolEvents[]` compatibility projection remains unchanged.

## Timeline Item Model

`apps/web/src/lib/memoryTimeline.ts` defines a derived `MemoryTimelineItem`:

- `id`
- `operation`
- `status`
- `title`
- `summary`
- `projectKey`
- `sessionKey`
- `memoryId`
- `scopeStatus`
- `startedAt`
- `completedAt`
- `durationMs`
- `sourceEventId`
- `details`
- `collapsedByDefault`

The helper functions are:

- `isMemoryActivityEvent`
- `createMemoryTimelineItem`
- `createMemoryTimelineItems`
- `formatMemoryOperation`
- `formatMemoryScope`
- `summarizeMemoryTimeline`

These helpers operate on normalized activity events, not raw stream text
deltas. This keeps the timeline batch-friendly for fast streams.

## Operations Supported

The timeline classifies memory activity as:

- `store`
- `search`
- `retrieve`
- `health_check`
- `update`
- `delete`
- `unknown`

`update` and `delete` are labels only. No update, delete, supersede, pin,
mark-stale, or other mutation/admin controls were added.

## Right Rail Behavior

The Memory tab now includes a compact `Memory activity` section before Memory
search.

Behavior:

- shows recent memory events from the current session's normalized activity
  events;
- shows operation, status, project/session scope, duration when available,
  memory id when available, and scope status when available;
- keeps details collapsed under `Redacted details`;
- shows `No memory activity in this session yet.` when no session memory events
  have been observed;
- preserves the existing Memory status, scope, search, results, and detail
  panels.

The chat transcript activity blocks remain unchanged as the main conversation
timeline. The right rail timeline is secondary observability.

## Gateway Live Vs Mock

Brain Memory Gateway status remains separate from the event timeline.

When Gateway is mock, unconfigured, or unavailable:

- the Memory status/search/detail surfaces keep their existing normalized
  mock/unconfigured behavior;
- the timeline can still show real memory events emitted by Hermes/MCP for the
  current session;
- the UI does not claim Gateway search/detail success unless the existing BFF
  routes return real Gateway responses.

## Click-Through Detail Behavior

If a timeline item has a `memoryId` and Brain Memory Gateway status is real and
reachable, the row shows `Inspect detail`. That action reuses the existing
read-only BFF-backed memory inspect hook.

If Gateway is mock/unconfigured or the timeline item has no `memoryId`, the
detail action is hidden. No new backend route was added.

Slice 15I follow-up:

- Gateway-backed detail is labelled `Read-only detail` and `Scoped result`.
- Evidence currently returns `status=not_implemented` with an empty evidence
  array and the UI says `Evidence: not implemented by Gateway yet.`
- Supersession-chain currently returns `status=not_implemented` with an empty
  chain and the UI says `Supersession chain: not implemented by Gateway yet.`
- Audit is metadata-only for now; there is no durable audit trail endpoint in
  the current UI read contract.

Slice 15J follow-up:

- `/design/memory-detail-fixture` renders the same detail panel with static
  fixture data and no live service calls.
- `npm run smoke:memory-detail` verifies the read-only detail labels,
  not_implemented evidence/supersession copy, metadata-only audit, metadata
  redaction, and absence of mutation controls without requiring live Hermes or
  Brain Memory Gateway.

Slice 15K follow-up:

- The MVP Brain Memory read-only regression coverage map is indexed in
  `docs/product/BRAIN_MEMORY_REGRESSION_INDEX_15K.md`.

## Redaction

Timeline details are collapsed by default and redacted before display. The
timeline helper redacts secret-like keys and bearer-looking string values,
matching the existing activity-event redaction posture. Details are also
truncated in the UI to keep the rail compact.

## Provider-Agnostic And Hermes-Native Behavior

The timeline consumes normalized agent activity, not provider-specific stream
payloads. It does not assume OpenAI, Cerebras, Kimi, OpenRouter, or local model
fields.

Hermes remains the runtime/provider authority. Browser code still calls only
the Web UI BFF.

## Fast-Stream Performance Notes

This slice did not change assistant text streaming. The existing chat path
continues to buffer text deltas and flush visible assistant text with
`requestAnimationFrame`.

The right rail timeline derives from compact activity events and limits the
live session buffer to the existing last 80 events, with the Memory tab showing
the latest 12 memory items. Raw details stay collapsed and lazy.

## Checks Run

Slice verification:

- `npm run check:agent-activity`
- `npm run check:agent-activity-rendering`
- `npm run smoke:mvp`
- `npm run smoke:ui`
- `npm run smoke:ui:send`
- `npm run smoke:ui:stop`
- `npm run check:workspace-state`
- `npm run check:brain-memory-client`
- `npm run studio:doctor`
- `npm run check:ui-structure`
- `npm run typecheck`
- `npm run build`
- `npm audit --audit-level=moderate`

## Limitations

- Memory timeline events are live React state only and are not replayed after
  refresh.
- The generic live smoke prompt may not trigger Brain Memory MCP tool calls, so
  memory event rendering is covered by helper/rendering checks unless a live
  Hermes memory prompt emits tool events.
- Timeline ordering is session-event append order, not a durable run history.
- Gateway detail click-through is available only when the existing Gateway
  inspect route is real/reachable.

## Next Recommended Slice

Slice 13L - Command Execution Details/stdout/stderr UI.

Reason: Brain Memory activity now has a right-rail observability surface. The
next orchestration gap is making command/tool output inspectable without
changing Hermes streaming or adding unsafe direct execution/storage paths.
