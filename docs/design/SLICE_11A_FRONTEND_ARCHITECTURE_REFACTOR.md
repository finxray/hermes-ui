# Slice 11A Frontend Architecture Refactor

## Files changed

- `apps/web/src/app/page.tsx`
- `apps/web/src/app/globals.css`
- `apps/web/src/styles/tokens.css`
- `apps/web/src/components/shell/*`
- `apps/web/src/components/chat/*`
- `apps/web/src/components/memory/*`
- `apps/web/src/components/ui/*`
- Removed the old top-level production component files under `apps/web/src/components/`, including the unused legacy `ModelSelector`.
- `scripts/check-ui-structure.mjs`
- `package.json`
- `docs/design/SLICE_11A_FRONTEND_ARCHITECTURE_AUDIT.md`

## Component architecture before

The production UI entered through `AppShell` and rendered `Sidebar`, `ChatView`, and `ContextPanel`, but almost every visual behavior lived in `globals.css`. Sidebar rows, composer chrome, message bubbles, panel tabs, memory detail cards, and status panels were all patched by broad global selectors.

## Component architecture after

The production route now imports `components/shell/AppShell`.

```text
components/
  shell/
    AppShell.tsx
    TopBar.tsx
    Sidebar.tsx
    SidebarRow.tsx
    ContextRail.tsx
    HermesStatusPanel.tsx
  chat/
    ChatView.tsx
    ChatHeader.tsx
    ChatTranscript.tsx
    MessageBubble.tsx
    Composer.tsx
  memory/
    BrainMemoryConsole.tsx
    BrainMemoryStatusPanel.tsx
    MemoryDetailPanel.tsx
  ui/
    EmptyState.tsx
```

Each visual area now has a colocated CSS Module. `globals.css` is reduced to token import, reset/base, scrollbar styling, body/html, and native form defaults.

## Sidebar row contract

`SidebarRow` is the single rail row contract for:

- top-level project/chat actions,
- project rows,
- session rows,
- mock connection rows,
- reset and refresh rows.

It provides a stable icon column, text column, meta column, optional action slot, active/muted/disabled states, one hover background, and one active background. Project and session action buttons sit in the action slot rather than creating nested row backgrounds.

## Panel toggles

`AppShell` owns `leftCollapsed` and `rightCollapsed` state and writes:

- `data-left-collapsed`
- `data-right-collapsed`

The shell grid transitions column widths over 500ms. The rails remain mounted and slide/fade out. Hidden native checkbox controls are also rendered as a defensive CSS fallback for the rail labels; React state remains the primary hydrated path.

## Styles moved from globals

Moved out of `globals.css`:

- app shell grid, panel animation, and top navigation,
- sidebar brand, sections, rows, actions, rename input, and mock connection rows,
- chat workspace, header, transcript, references, messages, and composer,
- context rail tabs, sections, metrics, fields, tool/file rows,
- Brain Memory search, result cards, detail panel, metadata, and error states,
- empty state styling.

## Behavior preserved

The refactor did not change:

- workspace state reducer or localStorage behavior,
- project/session stable keys,
- Hermes status or streaming hooks,
- Hermes chat BFF route,
- Brain Memory status/search/detail hooks,
- Brain Memory BFF routes,
- memory-scope bridge behavior,
- mock fallback behavior.

## Validation

- `npm run typecheck` passed during refactor.
- `npm run build` passed.
- `npm run check:ui-structure` passed.
- Real Chrome was opened through a temporary profile. The visible desktop screenshot was blocked by another foreground full-screen app, so desktop screenshot evidence is not valid.
- A real Chrome DevTools Protocol smoke against `http://127.0.0.1:3005/` confirmed the rebuilt production page loads with the new CSS modules, Hermes status reaches connected, and there is no horizontal overflow.
- In hidden/background Chrome targets, React hydration/effects were deferred, so click-event verification was inconclusive there. The shell now also includes a native checkbox-backed rail toggle fallback and structure checks for the toggle contract.

## Remaining UI issues

- A visible foreground browser pass should still be done by the user to confirm the exact tactile feel of the 500ms rail animation.
- The stop button remains a visual placeholder; real stream cancellation remains a separate slice.
- The right rail is structurally flatter, but a future design pass can tune density after the component architecture settles.

## Next recommended slice

Slice 11B: visible-browser acceptance pass and small scoped CSS tuning on top of the new component architecture.
