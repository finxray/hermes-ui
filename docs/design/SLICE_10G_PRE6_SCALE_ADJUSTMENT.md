# Slice 10G-pre6 Scale Adjustment

## Purpose

This prototype-only slice applied the requested proportional density and width increase to the approved Codex-style shell at:

```text
http://127.0.0.1:3000/design/codex-shell
```

Production was not migrated in this slice.

## Files Changed

- `apps/web/src/app/design/codex-shell/page.module.css`

## Font and Icon Scale

Prototype typography now uses shared sizing variables:

- `--font-body: 16.1px`
- `--font-ui: 17.25px`
- `--font-title: 19.55px`
- `--icon-scale: 1.15`

These values increase the previous prototype type and icon density by approximately 15% while preserving the existing hierarchy. Icons are scaled from the prototype shell CSS so the JSX icon declarations do not need to be rewritten.

## Rail Width Changes

The desktop grid now uses clamped rail widths:

- Left rail: `clamp(340px, 20.4vw, 391px)`
- Right rail: `clamp(420px, 25.2vw, 483px)`

On wide screens this reaches the requested 15% larger widths:

- Left rail: `340px` to `391px`
- Right rail: `420px` to `483px`

The clamps let the rails settle back toward the previous widths on narrower desktop viewports so the shell does not create horizontal overflow.

The left rail still has no right border, and the right rail keeps its subtle divider.

## Composer and Content Width

The shared inner content width changed from:

```css
--content-width: 846px;
```

to:

```css
--content-width: 973px;
```

This increases the aligned composer/content column by approximately 15%. The warning banner, transcript, message column, and floating composer still use the same shared width, so their vertical alignment remains consistent.

The outer center workspace was not made narrower or redesigned.

## Screenshot Validation Result

The approved prototype route was opened in a clean real Chrome app window:

```text
http://127.0.0.1:3000/design/codex-shell
```

No screenshot artifact was committed for this slice. Validation was performed by opening the actual prototype route and by checking the responsive grid constraints. The route continued to serve HTTP `200`.

## Checks Run

- `npm run typecheck` passed.
- `npm run build` passed.
- `npm audit --audit-level=moderate` passed with `0` vulnerabilities.

## Production Migration Readiness

The approved prototype remains ready to be used as the source for production migration. The correct migration source remains:

```text
http://127.0.0.1:3000/design/codex-shell
```

Do not use the root route as the design source yet:

```text
http://127.0.0.1:3000/
```

The root route still serves the old production app until the actual migration slice.

