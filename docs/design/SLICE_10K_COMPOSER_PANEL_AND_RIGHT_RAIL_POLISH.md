# Slice 10K: Composer, Panel, and Right Rail Polish

## Summary

Slice 10K polished the production root UI at `http://127.0.0.1:3000/`. This was a visual production-shell slice only. No Hermes streaming logic, Brain Memory BFF behavior, memory scope bridge behavior, project/session stable key behavior, storage access, or memory mutation/admin action was changed.

## Files Changed

- `apps/web/src/app/globals.css`
- `apps/web/src/components/Composer.tsx`
- `docs/design/slice-10k-production-smoke.png`
- `docs/design/slice-10k-composer-closeup.png`
- `docs/design/SLICE_10K_COMPOSER_PANEL_AND_RIGHT_RAIL_POLISH.md`

## Composer Changes

- Removed the strong outline border from `.composer-box`.
- Kept the floating composer surface through soft background, shadow, and a subtle inset/edge treatment.
- Removed the extra composer options/sliders button so the control row is quieter.
- Kept attach, model, microphone, and send controls.
- Preserved composer visibility and send form behavior.

Measured in real Windows Chrome:

- composer inner shell width: `576px`
- composer border width: `0px`
- no horizontal overflow

## Send/Stop Icon Behavior

The send icon was changed from a horizontal send arrow to a Codex-like up arrow inside a circular send control.

The stop icon was not added in this slice because the current composer has no stop/cancel callback or supported cancellation behavior. Adding a clickable stop square without real cancellation would be misleading. A future streaming-control slice should wire real cancellation first, then render the matching stop square during generation.

## Main Title Alignment

The chat title remains a single truncating line with no subtitle and no restored header band. Its left edge now aligns to the main workspace inset instead of being centered over the narrower transcript/composer column.

Measured in real Windows Chrome at `1920px`:

- chat workspace x: `346px`
- title x: `410px`

This matches the workspace's inner content edge while keeping the transcript/composer column centered.

## Panel Animation

Root cause:

- The shell uses grid columns for the left rail, center workspace, and right rail.
- Previous animation improvements had the right timing, but collapsed columns used unitless `0` values and panels previously used visibility hiding, both of which made the collapse feel fragile or abrupt.

Fix:

- Collapsed grid columns now use explicit `0px` tracks.
- The side panels stay mounted.
- The shell keeps a `grid-template-columns` transition.
- Rails animate opacity, transform, and padding.
- Immediate `visibility: hidden` is not used for the rail collapse state.

Transition timing:

```css
500ms cubic-bezier(0.2, 0.8, 0.2, 1)
```

Reduced-motion handling remains in the existing media query.

## Mock Connections Rhythm

The sidebar footer now follows the same row rhythm as the rest of the rail:

- status rows use full rail width
- status rows have row-like min-height and padding
- reset/refresh controls use matching row height and padding
- spacing between rows was loosened slightly
- visual priority remains lower than projects/sessions

## Right Rail Nesting Reduction

The right rail card treatment was flattened:

- summary/memory/tool/artifact cards use lower-contrast borders
- card fills are subtler
- inner metric boxes use a lighter, flatter surface
- the rail remains readable without feeling like cards inside cards inside a card

Memory detail, evidence, supersession, error, and status states are preserved.

## Real Chrome Smoke

Opened the production root in real Windows Chrome:

```text
http://127.0.0.1:3000/
```

Screenshots:

- `docs/design/slice-10k-production-smoke.png`
- `docs/design/slice-10k-composer-closeup.png`

Validated:

- actual Hermes UI app was shown, not Codex
- composer border is removed
- composer controls are quieter and closer to Codex
- extra settings/sliders icon is gone
- title aligns to the main workspace inset
- panel transition CSS is present at `0.5s`
- mock connection rows use sidebar row rhythm
- right rail cards are flatter
- no horizontal overflow

## Checks Run

```text
npm run check:workspace-state
npm run check:brain-memory-client
npm run studio:doctor
npm run typecheck
npm run build
npm audit --audit-level=moderate
```

All checks passed.

## Remaining UI Issues

- Add a real stop/cancel action before showing an active stop button during generation.
- Do a dedicated interactive panel QA pass with live hydration/service state, including keyboard and pointer toggling across desktop/tablet/mobile.
- Continue reducing right-rail density once real memory detail payloads grow larger.
