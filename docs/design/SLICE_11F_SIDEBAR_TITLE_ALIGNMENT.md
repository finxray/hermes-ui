# Slice 11F Sidebar Title Alignment

## Files changed

- `apps/web/src/components/shell/Sidebar.module.css`
- `apps/web/src/components/shell/SidebarRow.module.css`
- `apps/web/src/components/chat/ChatView.module.css`

## Starting state

The worktree was clean before this slice started.

Recent HEAD:

```text
4c8f38f chore: refine top menu and sidebar indent
```

No backend, Hermes streaming, Brain Memory BFF, memory-scope bridge, project/session stable-key, storage, auth, or API route logic was changed.

## Measured alignment issue

Real Chrome audit at `1920x1080`, `devicePixelRatio=1`, and `visualViewport.scale=1` showed the sidebar still had multiple independently computed columns.

Before this slice:

```text
row icon x: 27.8px
row text x: 49.9px
child text x: 54.9px
brand icon x: 15.0px
brand text x: 57.0px
main workspace left x: 220.8px
main title x: 647.9px
main title font: 17px / 560
```

The child rows were only slightly off, but the drift was visible next to the parent folder label. The Brain Memory Studio header had a separate flex layout with a larger 32px icon box. The main title was centered to the chat content column instead of aligning with the workspace surface.

## Sidebar column contract

The left rail now defines one shared column contract on `.sidebar`:

```css
--sidebar-rail-padding-x: 15px;
--sidebar-row-padding-x: clamp(12px, calc(8px + 0.25vw), 18px);
--sidebar-icon-column: var(--icon-sm);
--sidebar-column-gap: 9px;
--sidebar-meta-column: minmax(28px, auto);
--sidebar-child-meta-column: minmax(20px, auto);
```

`SidebarRow`, the Brain Memory Studio brand row, the section labels, and the settings row now consume this same contract.

After this slice:

```text
brand icon x: 27.796875px
brand text x: 49.90625px
project icon x: 27.796875px
project text x: 49.90625px
folder icon x: 27.796875px
folder text x: 49.90625px
child spacer x: 27.796875px
child text x: 49.90625px
chat shortcut icon x: 27.796875px
chat shortcut text x: 49.90625px
settings icon x: 27.796875px
settings text x: 49.90625px
section label x: 49.90625px
```

## Child row indent fix

Child rows no longer use a separate padding-left offset.

They now keep the same icon column and gap as parent rows. When a child row has no icon, the existing empty icon span acts as an invisible spacer, so the child label starts at exactly the same text column as the parent folder label.

The active child background still spans the full row. Only the text-column math changed.

## Brain Memory Studio header alignment

The header changed from a separate flex layout to the shared sidebar grid:

- icon column: `var(--sidebar-icon-column)`,
- text column: `minmax(0, 1fr)`,
- gap: `var(--sidebar-column-gap)`,
- horizontal padding: `var(--sidebar-row-padding-x)`.

The brand icon is now in the same icon column as row icons, and the title starts at the same text column as every row. The title remains brighter, but it now uses `--font-small` and a lighter `560` weight instead of the larger `--font-ui` scale.

## Main title alignment and style

The chat header no longer centers itself to `--content-width`.

It now aligns to the workspace surface padding:

```css
margin: clamp(19px, calc(14px + 0.36vw), 30px) clamp(18px, 4vw, 58px) 0;
```

Measured after:

```text
workspace left x: 220.796875px
main title x: 278.796875px
title inset from surface: 58px
main title font: 12.228px / 450
```

The title remains one line with ellipsis. No subtitle or header divider was restored.

## Left scrollbar placement

The left rail scroll container now uses:

```css
direction: rtl;
```

Direct children reset to:

```css
direction: ltr;
```

This places the left rail scrollbar on the left side when scrolling is needed, while preserving normal text direction and scroll-wheel behavior for the content.

A shorter real Chrome viewport confirmed:

```text
direction: rtl
overflow-y: auto
scrollHeight: 886
clientHeight: 567
canScroll: true
scrollbar-color: rgb(35, 37, 42) transparent
```

The right panel scrollbar was not changed.

## Real Chrome validation

Validated against:

```text
http://127.0.0.1:3000/
```

Real Windows Chrome metrics:

```text
devicePixelRatio: 1
visualViewport.scale: 1
horizontal overflow: false
```

Confirmed:

- all primary left-rail text columns align at `49.90625px`,
- child rows are not indented relative to parent folder text,
- Brain Memory Studio header follows the same icon/text rhythm,
- icons align to the same `27.796875px` column,
- main title is left-aligned to the workspace surface padding,
- main title is smaller and lighter,
- left rail scrollbar is configured to appear on the left when scrolling is needed,
- no horizontal overflow exists.

Screenshot evidence:

```text
artifacts/slice11f-real-chrome-final.png
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

- Topbar panel-toggle click behavior should still get a foreground user acceptance pass because hidden/background Chrome can defer React hydration in CDP.
- The stop button is still visual-only; real stream cancellation remains a future behavior slice.
- Rename/archive project and chat controls still need a valid non-nested affordance if they should return.

## Next recommended slice

Slice 11G: Restore project/chat management affordances with a valid Codex-style row menu or command surface, without nesting buttons inside clickable rows and without changing memory scope keys.
