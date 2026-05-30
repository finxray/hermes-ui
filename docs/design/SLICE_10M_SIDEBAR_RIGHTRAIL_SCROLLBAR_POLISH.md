# Slice 10M: Sidebar, Right Rail, and Scrollbar Polish

## Summary

Slice 10M polished the production root UI at `http://127.0.0.1:3000/`. This was a visual shell slice only. No Hermes streaming logic, Brain Memory BFF behavior, memory scope bridge behavior, project/session stable key behavior, storage access, or mutation/admin action was changed.

## Files Changed

- `apps/web/src/app/globals.css`
- `apps/web/src/components/Sidebar.tsx`
- `docs/design/slice-10m-production-smoke.png`
- `docs/design/SLICE_10M_SIDEBAR_RIGHTRAIL_SCROLLBAR_POLISH.md`

## Panel Width Changes

The side rail width tokens were reduced by approximately 20%.

Before:

```css
--rail-width-left: clamp(340px, 18vw, 520px);
--rail-width-right: clamp(420px, 21vw, 620px);
```

After:

```css
--rail-width-left: clamp(272px, 14.4vw, 416px);
--rail-width-right: clamp(336px, 16.8vw, 496px);
```

The center workspace gains the freed space. Side panels now also explicitly use `min-width: 0` so collapsed grid tracks are not held open by intrinsic panel width.

## Projects Count Removal

Removed the project total number from the `Projects` section heading. Per-project session counts remain in the project rows because the request only targeted the heading count.

## Hover Action Alignment

Sidebar row actions were tightened and aligned:

- project/session actions remain absolutely positioned at the row's far right
- action controls are vertically centered with the row text
- session rows reserve right padding for hover actions
- project rows reserve right padding so project counts and hover edit action do not fight for the same visual space
- row height remains stable on hover

## Selected And Hover Row Cleanup

Project/session row surfaces now use one row-level background:

- hover fill: low-contrast `rgba(255, 255, 255, 0.032)`
- selected fill: soft `rgba(255, 255, 255, 0.052)`
- child buttons remain transparent
- mini-action hover fill is subtle and does not create a nested card look

## Mock Connections Rhythm

The mock connection area continues to use the sidebar row language:

- full-width status rows
- row-like min-height and padding
- looser row gap
- reset/refresh controls share the same left padding and baseline rhythm
- lower-priority visual weight than Projects/Sessions

## Right Rail Nesting Reduction

Right-rail surfaces were flattened further:

- summary/memory/tool/artifact cards use lower-contrast borders
- card fills are weaker
- metric boxes no longer carry their own border
- context fields have subtler fill and border
- memory detail metadata/read-only dividers are quieter

The content remains readable and all status/detail information is preserved.

## Scrollbar Styling

Added global dark scrollbar styling:

- Firefox: `scrollbar-width: thin` and dark `scrollbar-color`
- Chromium/WebKit: dark track, low-contrast dark thumb, subtle hover thumb
- scrollbar buttons are reduced to dark zero-sized affordances where supported

This applies to the right rail scroll area and other scroll containers without adding bright system scrollbars.

## Panel Toggle Validation

Panel transition CSS remains:

```css
grid-template-columns 500ms cubic-bezier(0.2, 0.8, 0.2, 1)
```

The rails stay mounted, collapsed tracks use explicit `0px`, and side panels now have `min-width: 0` so the main workspace can expand into the freed left/right space.

## Real Chrome Smoke

Opened the production root in real Windows Chrome:

```text
http://127.0.0.1:3000/
```

Screenshot evidence:

```text
docs/design/slice-10m-production-smoke.png
```

Validated:

- actual Hermes UI app was shown, not Codex
- side rails are narrower
- `Projects` heading no longer shows the total count
- selected row surface is single and soft
- right rail surfaces are flatter
- scrollbar styling is dark/subtle
- no backend or integration behavior changed

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

- A future interaction QA slice should verify panel toggle click behavior in a fully hydrated browser session across desktop/tablet/mobile.
- The right rail can still get dense with real memory detail payloads; content prioritization can be tuned once real payload shape stabilizes.
