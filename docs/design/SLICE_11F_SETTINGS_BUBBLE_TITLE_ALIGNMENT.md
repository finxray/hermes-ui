# Slice 11F - Settings, Bubble, And Title Alignment

## Scope

Slice 11F was a small production visual correction pass for `http://127.0.0.1:3000/`. It used scoped component CSS modules only and did not change Hermes, Brain Memory, BFF, storage, memory scope, streaming, auth, or mutation/admin logic.

## Files Changed

- `apps/web/src/components/chat/ChatView.module.css`
- `apps/web/src/components/chat/MessageBubble.module.css`
- `apps/web/src/components/shell/Sidebar.module.css`
- `docs/design/SLICE_11F_SETTINGS_BUBBLE_TITLE_ALIGNMENT.md`
- `docs/design/slice-11f-root-smoke.png`

## Settings Background Fix

The black rectangle behind the Settings row came from the sticky sidebar footer gradient. The footer background is now transparent, leaving only the row-shaped hover/active treatment.

The Settings popover behavior and mock connection rows were preserved.

## User Bubble Color

The user message bubble was lightened from `rgba(20, 21, 24, 0.96)` to `rgba(23, 24, 28, 0.96)`, keeping it distinct from assistant messages while reducing the overly dark tone from Slice 11E.

## Brain Memory Studio Alignment And Icon

The left rail top padding was reduced so the Brain Memory Studio brand sits slightly higher and aligns better with the main workspace title row.

The brain icon now uses Apple-style system blue `#0A84FF`. The Brain Memory Studio text color was not changed.

## Main Title Alignment

The main workspace title left margin now matches the top margin scale, moving the title closer to the rounded workspace edge while preserving the one-line ellipsis behavior.

## Real Chrome Validation

Opened the production root in real Windows Chrome at `http://127.0.0.1:3000/`.

Captured screenshot evidence at `docs/design/slice-11f-root-smoke.png`.

Validation result:
- Settings black background artifact is gone.
- User bubble is lighter and readable.
- Brain Memory Studio sits slightly higher.
- Main title is closer to the workspace edge.
- Brain icon is blue while the text remains unchanged.
- No horizontal overflow was visible in the captured desktop view.

## Checks Run

- `npm run check:workspace-state`
- `npm run check:brain-memory-client`
- `npm run studio:doctor`
- `npm run check:ui-structure`
- `npm run typecheck`
- `npm run build`
- `npm audit --audit-level=moderate`

## Remaining Issues

- Settings popover can still be refined visually in a later small polish pass, but its behavior was intentionally left unchanged.
- Real stream cancellation remains deferred from prior slices.
