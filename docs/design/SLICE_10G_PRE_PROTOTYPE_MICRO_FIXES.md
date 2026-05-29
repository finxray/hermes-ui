# Slice 10G-pre Prototype Micro Fixes

## Files changed

- `apps/web/src/app/design/codex-shell/page.tsx`
- `apps/web/src/app/design/codex-shell/page.module.css`
- `docs/design/SLICE_10G_PRE_PROTOTYPE_MICRO_FIXES.md`

## Fixes made

### Main workspace header border

The main workspace header now has subtle inset top and left borders. This restores visible edge definition at the main window header without reintroducing protruding corner artifacts, and preserves the clean rounded top-left corner.

### Mock connections alignment

The Mock connections status lines were shifted so their dot icons align with the session row text rhythm. Project row alignment was left unchanged.

### Composer artifact removal

The textarea resize handle was removed from the prototype composer by disabling textarea resizing. The send button and existing composer controls remain intact.

### Settings icon replacement

The prototype footer now includes a static Settings row using a simple ring/circle icon instead of a gear. No new icon library was added.

## Screenshot validation result

Validated against the prototype route at `http://127.0.0.1:3000/design/codex-shell`.

- `docs/design/slice-10g-pre-codex-shell-full.png` - full shell.
- `docs/design/slice-10g-pre-header-corner.png` - main workspace header corner.
- `docs/design/slice-10g-pre-mock-settings.png` - Mock connections and Settings area.
- `docs/design/slice-10g-pre-composer.png` - composer close-up.
- `docs/design/slice-10g-pre-right-rail.png` - right rail close-up.

Validation result:
- Main workspace header has subtle top and left inset borders.
- Top-left corner remains clean and rounded.
- Mock connection dots align with the session row text start rhythm.
- Composer textarea resize artifact is removed.
- Send button remains visible.
- Settings uses a simple ring/circle icon.
- No horizontal overflow was visible in the captured desktop route.

## Checks run

- `npm run typecheck` - passed.
- `npm run build` - passed.
- `npm audit --audit-level=moderate` - passed with 0 vulnerabilities.

## Production migration readiness

The prototype is ready for production migration, subject to final visual approval. This slice intentionally does not migrate the production app.
