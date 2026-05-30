# Slice 10G-pre2 Border Radius Fix

## Issue fixed

The top-left rounded corner of the prototype main workspace had a visible gap where the subtle border disappeared through the radius. Straight top and left edges were visible, but the curved corner was not continuous.

## CSS approach used

The disconnected inset top/left shadows were replaced with a single rounded `::before` overlay on the `.workspace` container:

- `position: absolute; inset: 0`
- `border: 1px solid var(--line)`
- `border-right: 0`
- `border-bottom: 0`
- `border-radius: inherit`
- `pointer-events: none`

This lets the browser draw one continuous border through the top-left radius while keeping the approved top and left edge treatment subtle. The header keeps its bottom divider, and the workspace keeps its soft bottom inset.

## Screenshot validation result

Validated against the prototype route at `http://127.0.0.1:3000/design/codex-shell`.

- `docs/design/slice-10g-pre2-codex-shell-full.png` - full shell.
- `docs/design/slice-10g-pre2-header-corner.png` - top-left workspace corner crop.
- `docs/design/slice-10g-pre2-header-corner-zoom.png` - zoomed corner crop.

The zoomed screenshot shows the subtle workspace edge following the top-left radius continuously. No protruding edge or double straight-edge border was visible.

## Checks run

- `npm run typecheck` - passed.
- `npm run build` - passed.
- `npm audit --audit-level=moderate` - passed with 0 vulnerabilities.

## Production migration readiness

The prototype is ready for production migration, subject to final visual approval. This slice intentionally does not migrate the production app.
