# Slice 11E - Composer, Right Rail, And Activity Timeline

## Scope

Slice 11E polished the production UI at `/` using scoped component CSS modules only. It did not change Hermes streaming logic, Brain Memory Gateway logic, memory scope bridge behavior, storage, auth, or mutation/admin behavior.

## Files Changed

- `apps/web/src/components/chat/ChatActivityBlock.tsx`
- `apps/web/src/components/chat/ChatActivityBlock.module.css`
- `apps/web/src/components/chat/ChatTranscript.tsx`
- `apps/web/src/components/chat/Composer.module.css`
- `apps/web/src/components/chat/MessageBubble.module.css`
- `apps/web/src/components/memory/BrainMemoryConsole.module.css`
- `apps/web/src/components/shell/AppShell.module.css`
- `apps/web/src/components/shell/ContextRail.module.css`
- `apps/web/src/components/shell/Sidebar.module.css`
- `apps/web/src/components/shell/StatusPanel.module.css`

## Composer Polish

- Darkened the floating composer surface by roughly 30% while preserving the current shape, controls, and submit behavior.
- Ensured the active send icon inherits the intended dark foreground color.
- Kept the stop button as a visual placeholder only; real stream cancellation remains deferred because no cancellation path is currently wired.

## Message Polish

- Darkened user message bubbles by roughly 30%.
- Left assistant messages background-free, matching the approved Codex-like reading rhythm.

## Chat Activity Timeline Foundation

- Added a folded-by-default `ChatActivityBlock` for session `toolEvents`.
- The block shows a Codex-like summary row, compact event rows, status states, and shimmer for running/pending events.
- Existing mock tool events are labeled as mock activity; no live execution data is faked.

## Right Rail Polish

- Increased the right rail width by about 20%.
- Added side padding to right rail tabs.
- Added more vertical separation between rail sections.
- Made metric cards subtly bordered and rounded.
- Reduced background noise on unselected pills/chips.

## Sidebar Settings Polish

- Adjusted the Settings footer and popover surfaces so they sit more cleanly in the rail without the older heavy block feeling.

## Screenshot Validation

- Opened the production app at `http://127.0.0.1:3000/` in a clean real Chrome app window.
- Captured a Chrome screenshot at `docs/design/slice-11e-root-smoke.png`.
- Verified the screenshot shows the production root route with the polished composer, wider right rail, darkened user bubbles, and folded activity block.

## Checks Run

- `npm run typecheck`
- `npm run check:workspace-state`
- `npm run check:brain-memory-client`
- `npm run studio:doctor`
- `npm run check:ui-structure`
- `npm run build`
- `npm audit --audit-level=moderate`
- Note: one parallel `typecheck` run raced with `next build` while `.next/types` was being regenerated. It passed when rerun by itself.

## Remaining Follow-Up

- Wire real stream cancellation when Hermes/BFF exposes a cancellation contract.
- Extend the activity block placement once Hermes emits richer turn-scoped run timing metadata.
- Continue right rail reduction of nested visual noise in a focused future polish slice if desired.
