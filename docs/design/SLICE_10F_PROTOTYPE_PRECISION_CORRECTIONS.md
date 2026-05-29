# Slice 10F Prototype Precision Corrections

## Exact feedback addressed

1. All text buttons and titles should be about 15% smaller overall.
2. Under Sessions, the indent is still too large.
3. Session sub-buttons should not align with the text of project rows.
4. Session sub-buttons must align vertically with the left side of the folder icon of the project rows.
5. The top border line disappeared and must return.
6. The left side panel must have no right border.
7. The top-left corner of the main chat/workspace is not rounded and must be rounded correctly.
8. The main chat header is too tall.
9. The title `Hermes UI roadmap` is too large.
10. `Brain Memory Studio`, `Projects`, `Sessions`, and `Mock connections` are too bold and need lighter weight.
11. Mock connection sub-items are aligned with text now; they must align with the left side of their icons.
12. Right-side panel toggle must be aligned on the same horizontal line as `Context console`.
13. That toggle must sit at the far end of the same row.
14. Right rail titles such as `Context console`, `Hermes status`, `Active context`, and similar section titles are too bold and should be lighter.

## Files changed

- `apps/web/src/app/design/codex-shell/page.tsx`
- `apps/web/src/app/design/codex-shell/page.module.css`
- `docs/design/SLICE_10F_PROTOTYPE_PRECISION_CORRECTIONS.md`

## Typography scale changes

The prototype base text scale was reduced from 16px to 14px, with top menu, sidebar labels, workspace title, right rail title, tabs, and section headings reduced proportionally. Heading weights were also lowered so the prototype reads closer to Codex's calm density.

## Sidebar alignment changes

The session rows now start at the same x-position as the left edge of project row folder icons, not at the project text column. The left rail no longer draws a right border; separation is handled by the shell background and the rounded center workspace.

## Mock connections alignment

Mock connection lines no longer use the extra nested left padding. Their dots/icons begin at the same rail content edge, so the items align by icon edge rather than by text column.

## Border and corner fixes

A subtle top border was restored on the shell. The center workspace keeps its rounded top-left corner with inset edge rendering, avoiding an external protruding border.

## Main header refinements

The main workspace header height was reduced from 92px to 76px. `Hermes UI roadmap` is smaller and lighter while keeping clear page hierarchy.

## Right rail title/toggle alignment

The right rail toggle moved into a dedicated title row beside `Context console`, vertically centered and pushed to the far end of that same row. Right rail section headings were lightened.

## Screenshot validation result

Validated against the prototype route at `http://127.0.0.1:3000/design/codex-shell`.

- `docs/design/slice-10f-codex-shell-full.png` - full prototype.
- `docs/design/slice-10f-left-rail.png` - left rail close-up.
- `docs/design/slice-10f-center-workspace.png` - center workspace close-up.
- `docs/design/slice-10f-right-rail.png` - right rail close-up.

Validation checklist:
- Text/buttons/titles are smaller and calmer.
- Session indent is reduced.
- Session text aligns with the left side of project folder icons.
- Mock connection items align by their dot/icon edge.
- Top border line is visible again.
- Left panel has no right border.
- Main workspace top-left corner is rounded cleanly.
- Main workspace header is tighter.
- `Hermes UI roadmap` is smaller.
- Sidebar and right-rail titles are lighter.
- Context console toggle is aligned with the title and pushed to the far right.
- No horizontal overflow was visible in the captured desktop screenshot.

## Checks run

- `npm run typecheck` - passed.
- `npm run build` - passed.
- `npm audit --audit-level=moderate` - passed with 0 vulnerabilities.

## Prototype migration readiness

The prototype is ready for production migration from an implementation perspective, subject to visual approval of the Slice 10F screenshots.

## Next recommended slice

If the screenshots are accepted, the next slice should migrate the production shell to the approved prototype contract without changing Hermes or Brain Memory behavior.
