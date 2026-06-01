# UI Status Flicker Stability Fix

## Context

After Slice aa33af1 added 8-second Hermes status polling with `useHermesStatus`, users observed
visible flickering and layout jumping while status checks ran in the background.

## Root Causes

### 1. `isLoading: true` on every background poll (primary)

`useHermesStatus.refresh()` set `isLoading: true` unconditionally on every poll call — including
background refreshes where a good status was already present. This triggered two full re-renders
of `AppShell` and all children per 8-second cycle: one at start of fetch (loading=true) and one at
completion (loading=false). Components that check `isLoading` briefly entered a "checking" visual
state even when Hermes was stably connected.

### 2. No equality gate — new object on every poll

`setState({ status: newStatus, isLoading: false })` was called unconditionally after every fetch.
Even when Hermes state hadn't changed, a new object reference propagated through AppShell →
Sidebar, ChatView, ContextRail, forcing full React reconciliation passes every 8 seconds.

### 3. `modelButton` had no `min-width`

The Composer model button (`min-width: 0`) resized when the label changed from the initial fallback
"Hermes default" (wider) to "hermes-agent" (narrower) or "Hermes unavailable" on first load.
This caused the left controls row to visibly shift.

### 4. Browser tab/title

`layout.tsx` uses static `metadata.title = "Brain Memory Studio"`. The title does not change
programmatically. Browser tab spinner during initial load or HMR in dev mode is expected
Next.js development behavior — not a code-level bug.

### 5. No shimmer on panels

No full-panel shimmer was applied. The "checking" label in `HermesStatusPanel` was guarded by
`isLoading && !status` so it correctly only appeared on first load. The issue was the extra
re-render churn from `isLoading: true` during background polls.

## Files Changed

| File | Change |
|------|--------|
| `apps/web/src/hooks/useHermesStatus.ts` | Separate `isInitialLoading` (initial only) from `isRefreshing` (background); add `isMeaningfullyChanged` equality gate; return `isRefreshing` |
| `apps/web/src/components/shell/AppShell.tsx` | Pass `isHermesStatusRefreshing` from hook to `ContextRail` |
| `apps/web/src/components/shell/ContextRail.tsx` | Accept optional `isHermesStatusRefreshing` prop; forward to `HermesStatusPanel` |
| `apps/web/src/components/shell/HermesStatusPanel.tsx` | Accept optional `isRefreshing` prop; apply spin animation class to refresh button |
| `apps/web/src/components/shell/StatusPanel.module.css` | Add `@keyframes statusPanelSpin` and `.iconButtonRefreshing svg` animation; `prefers-reduced-motion` guard |
| `apps/web/src/components/chat/Composer.module.css` | Add `min-width: 90px` to `.modelButton` |
| `scripts/check-hermes-model-capabilities.mjs` | Add 6 new stability regression checks |

## Status Polling State Model After Fix

```
Initial mount:
  { status: null, isInitialLoading: true, isRefreshing: false }
  → Components show "Checking Hermes" (expected)

After first fetch (success):
  { status: <good>, isInitialLoading: false, isRefreshing: false }
  → All components show stable state

Background poll (every 8s):
  Start:  { status: <good>, isInitialLoading: false, isRefreshing: true }
          → Refresh button icon spins; layout unchanged
  End (no meaningful change):
          { status: <good>, isInitialLoading: false, isRefreshing: false }
          → No re-render propagated (equality gate short-circuits setState)
  End (meaningful change, e.g. Hermes disconnected):
          { status: <new>, isInitialLoading: false, isRefreshing: false }
          → Status updates propagate once

Hermes disconnect/reconnect:
  Poll detects mode/reachable change → isMeaningfullyChanged returns true
  → State updates once, UI reflects new reality within 8s
```

## Layout Stability Changes

- **Composer model button**: `min-width: 90px` reserves stable space so label changes
  ("Hermes default" → "hermes-agent") don't shift the control row
- **HermesStatusPanel card**: title/body/metrics do not change during `isRefreshing`;
  only the refresh button icon animates
- **No conditional mount/unmount** introduced for status states; all stability via visibility/opacity

## Favicon / Title Finding

`layout.tsx` sets `metadata.title = "Brain Memory Studio"` statically. The browser tab title is not
programmatically updated on status changes. Any tab spinner seen in dev mode is Next.js's own
development HMR indicator, not a code-level regression.

## Checks / Smokes Run

- `check:hermes-model-capabilities` — passes (includes 6 new stability checks)
- `check:ui-structure` — passes
- `check:workspace-state` — passes
- `check:agent-activity` — passes
- `check:agent-activity-rendering` — passes
- `check:brain-memory-client` — passes
- `check:tenant-scope` — passes
- `typecheck` — passes
- `build` — passes
- `npm audit --audit-level=moderate` — passes
- `smoke:mvp` — 47 passed, 1 warning (Brain Memory unconfigured, expected)

## Known Remaining Issues

- Initial load still shows "Checking Hermes" for the duration of the first BFF roundtrip
  (~200-500ms locally). This is correct and expected.
- React StrictMode (Next.js dev) runs effects twice on initial mount, extending the initial
  "checking" period in development. Production behavior is correct.
- `isRefreshing` is not propagated to `Sidebar` settings popover (low priority: the popover is
  hidden by default and only shown in a modal overlay).
- Model label "Hermes default" shown during initial load before first fetch completes is correct
  behavior; it disappears once `isInitialLoading` goes false.

## Suggested Next Slice

16V: Production Runs route implementation or UI polish slice (see ROADMAP).
