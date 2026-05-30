# Slice 11D Zoom-Corrected Density And Surface Polish

## Browser zoom discovery

This slice corrects the production root UI after discovering that the previous visual review happened in Chrome at 75% zoom. Chrome was reset to 100%, which made the current density too large.

The production root was validated at:

```text
http://127.0.0.1:3000/
```

Real Windows Chrome DevTools Protocol smoke reported:

```text
devicePixelRatio: 1
visualViewport.scale: 1
horizontal overflow: false
```

## Density changes

The correction is token-based and does not use `transform: scale()`.

The shared shell density tokens in `AppShell.module.css` were reduced around 20% for production density at browser zoom 100%.

Measured at a 1920x1080 Chrome viewport:

```text
shell font: 13.696px
title font: 17px
left rail: 220.8px
right rail: 269px
composer width: 576px
composer height: 127.6px
composer box height: 99.8px
```

Composer width stayed unchanged because `--composer-width` still aliases `--content-width`.

## Font and icon scale changes

The core font tokens were reduced:

- `--font-xs`
- `--font-small`
- `--font-body`
- `--font-ui`
- `--font-title`
- `--font-section-title`

Icon and control tokens were reduced proportionally:

- `--icon-sm`
- `--icon-md`
- `--icon-lg`
- `--control-height`
- `--row-height`
- `--topbar-height`

The hierarchy remains intact: title, body, row, tab, badge, and metadata text all still flow through shared tokens.

## Rail width changes

Side panel widths were reduced around 20% from the post-zoom-discovery production values:

```css
--rail-width-left: clamp(218px, 11.5vw, 333px);
--rail-width-right: clamp(269px, 13.4vw, 397px);
```

The narrow breakpoint left rail was also reduced from `300px` to `240px`.

## Composer height and color changes

Composer height was reduced through actual layout values:

- wrapper vertical padding reduced,
- composer internal gap reduced,
- composer box padding reduced,
- textarea minimum height reduced from `clamp(44px, calc(36px + 0.58vw), 65px)` to `clamp(35px, calc(29px + 0.46vw), 52px)`.

The composer surface was darkened from:

```css
rgba(46, 48, 54, 0.98)
```

to:

```css
rgba(37, 38, 43, 0.98)
```

## User bubble color changes

User message bubbles were darkened from:

```css
rgba(35, 37, 42, 0.95)
```

to:

```css
rgba(28, 30, 34, 0.96)
```

The user bubble remains right-aligned and distinguishable from assistant content.

## Send and stop icon behavior

The active send button and the visual stop button use the same light circular surface with black icon color:

```css
background: rgba(245, 246, 248, 0.94);
color: #050505;
```

The empty/disabled send state remains dim.

## Scrollbar styling

Global scrollbars were changed so the track is visually invisible while preserving a full-height scrollbar area:

- `scrollbar-color: #23252a transparent`
- WebKit track background is transparent
- WebKit thumb uses `background-clip: content-box`
- WebKit scrollbar buttons are transparent and zero-sized

The thumb is the only visible scrollbar element and remains subtle.

## Right rail top border and spacing

The right rail now has a subtle top border matching the shell edge:

```css
border-top: 1px solid rgba(255, 255, 255, 0.055);
```

Right rail card groups have more vertical separation:

- section margins increased to `36px`,
- card gaps increased to `14px`,
- list gaps increased to `16px`.

The rail remains structurally flat; no extra nested background layers were added.

## Alignment fixes

The chat header now uses the same content width and centered alignment as the transcript/composer column:

```css
width: min(100%, var(--content-width));
margin: ... auto 0;
```

Measured in Chrome:

```text
title left: 647.890625px
composer left: 647.890625px
sidebar first row label left: 49.90625px
settings label left: 49.90625px
```

This removes the unwanted title indent and keeps sidebar/settings row labels aligned to the same text column.

## Real Chrome smoke result

Real Windows Chrome was opened against:

```text
http://127.0.0.1:3000/
```

Validated:

- browser zoom equivalent metrics were 100% (`devicePixelRatio=1`, `visualViewport.scale=1`),
- fonts are smaller and remain readable,
- side panels are narrower,
- composer width is unchanged,
- composer height is lower,
- composer and user message surfaces are darker,
- active send/stop CSS resolves to black icons on a light circular button,
- scrollbar track is visually invisible and thumb is subtle,
- right panel top border exists,
- right rail card spacing is improved,
- title and settings/sidebar text alignment are cleaned up,
- no horizontal overflow.

Screenshot evidence:

```text
artifacts/slice11d-real-chrome-100pct.png
```

The `artifacts/` directory is ignored and was not committed.

## Checks run

```text
npm run check:workspace-state
npm run check:brain-memory-client
npm run studio:doctor
npm run check:ui-structure
npm run typecheck
npm run build
npm audit --audit-level=moderate
```

All checks passed. `npm audit --audit-level=moderate` reported `0` vulnerabilities.

## Deliberately not changed

- No Hermes streaming logic changed.
- No Brain Memory BFF logic changed.
- No memory scope bridge behavior changed.
- No project/session stable key behavior changed.
- No memory mutation or admin action was added.
- No direct browser-to-Gateway, browser-to-Hermes, or browser-to-storage path was added.
- No Brain Memory storage/schema behavior changed.
- No auth/classification system was implemented.
- No backend/API routes were rewritten.

## Remaining issues

- The stop button is still visual-only; real stream cancellation remains a future behavior slice.
- Rename/archive project and chat controls still need a valid non-nested affordance if they should return.
- A foreground user review on the actual display should confirm whether the new 100% density feels right after extended use.

## Next recommended slice

Slice 11E: Restore project/chat management affordances with a valid Codex-style row menu or command surface, without nesting buttons inside clickable rows and without changing memory scope keys.
