# Slice 10N - Codex Shell Corrective Polish

## Files changed

- `apps/web/src/app/globals.css`
- `apps/web/src/components/Composer.tsx`

## Adjustments

- Removed the composer outline-like ring and kept only a soft floating shadow.
- Changed the generating-state send control to a small stop-square visual placeholder. Streaming cancellation is still not wired in this slice.
- Moved the main chat title closer to the left edge of the central workspace.
- Made left and right panel collapse tracks use `minmax(0, ...)` and kept the 500ms grid/rail animation.
- Normalized mock connection rows to the sidebar row height, spacing, and rhythm.
- Flattened the right panel cards into quieter side-panel sections to reduce the card-in-card feeling.
- Hid project counts while row actions are visible so hover controls do not fight the count text.

## Deliberately unchanged

- No Hermes streaming logic changed.
- No Brain Memory BFF or Gateway behavior changed.
- No memory mutation/admin actions were added.
- No direct browser-to-Hermes, browser-to-Brain-Memory, or storage access was added.

## Validation

- Real Chrome smoke: opened `http://127.0.0.1:3000/` in a clean Chrome app window and captured the actual Brain Memory Studio UI.
- Screenshot: `artifacts/slice-10n-corrective-polish.png`.
- Checks run: `npm run check:brain-memory-client`, `npm run check:workspace-state`, `npm run studio:doctor`, `npm run typecheck`, `npm run build`, `npm audit --audit-level=moderate`.

## Next recommendation

Run one more visual review on the production shell, then proceed only if the approved Codex-like UI is visually accepted.
