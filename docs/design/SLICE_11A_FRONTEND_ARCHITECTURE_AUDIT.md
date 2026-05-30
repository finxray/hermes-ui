# Slice 11A Frontend Architecture Audit

## Current Structure Problems

The production UI is currently rendered from `apps/web/src/app/page.tsx` through a single client-side `AppShell` component. `AppShell` owns workspace data hooks, Hermes/Brain Memory status hooks, top navigation, side-panel toggle state, and the three-column layout. `Sidebar`, `ChatView`, `ContextPanel`, `BrainMemoryConsole`, and the status panels render most UI behavior, but nearly all visual behavior is controlled by `apps/web/src/app/globals.css`.

The problematic pattern is not React state itself. The problem is that layout and component contracts are implicit in shared global class names:

- `AppShell` owns layout state, but `globals.css` owns the grid, animation, rail sizing, top bar, generic buttons, and multiple unrelated row patterns.
- `Sidebar` renders project rows, session rows, status rows, and action rows using different DOM shapes and different class names.
- `ChatView`, `Composer`, and `MessageBubble` rely on global classes that also overlap with panel and chip styles.
- `ContextPanel`, `HermesStatusPanel`, `BrainMemoryStatusPanel`, and `BrainMemoryConsole` share generic `summary-card`, `card-title`, `card-body`, `metric`, `pill`, and `context-field` selectors, so changing one panel changes others.

This explains why repeated visual patches created drift: every adjustment touched a broad selector surface and unintentionally affected other UI regions.

## Audit Answers

1. **Components that currently own layout**
   - `AppShell` owns the three-column shell state and render order.
   - `ChatView` owns the central workspace grid structure.
   - `ContextPanel` owns the right rail tab/content layout.
   - `Sidebar` owns the left rail content layout.
   - `globals.css` actually owns most layout behavior through global selectors.

2. **Components that currently own state**
   - `AppShell`: left/right panel open state plus workspace/status hooks.
   - `Sidebar`: inline rename state.
   - `ChatView`: generation state and animation-frame stream flush state.
   - `ContextPanel`: active right-rail tab.
   - `BrainMemoryConsole`: query, selected memory, mock detail, search/inspect state.
   - Workspace, Hermes, and Brain Memory data behavior remains in hooks/adapters and must not be changed.

3. **Global rules that should be component-scoped**
   - Shell grid and panel collapse rules.
   - Top bar/menu/toggle rules.
   - Sidebar brand, section, row, action, status, and rename rules.
   - Chat header, transcript, banner, reference, message, and composer rules.
   - Right rail panel, tab, card, field, status, memory search/detail rules.
   - Generic button/card/pill selectors used as component-specific building blocks.

4. **Duplicated UI patterns**
   - Project rows, session rows, text buttons, mock connection rows, and refresh/reset rows all behave like rail rows but are implemented differently.
   - Status panels and memory detail cards share generic card selectors with different intent.
   - Context fields exist independently in both context and memory components.
   - Empty-state and status-error styles are shared but not explicitly reusable.

5. **Why sidebar rows are inconsistent**
   - Rows use different markup: `project-button`, `session-button`, `text-button`, `status-badge`, and free-form `row-with-actions`.
   - Hover/action buttons are absolutely positioned over content instead of using a shared action/meta slot.
   - Some rows reserve count/meta columns and others do not.
   - Status rows are badges, not rail rows, so their rhythm differs.

6. **Why hover/selected states become nested**
   - Parent wrappers and child buttons both carry hover/active backgrounds.
   - Generic card selectors and active selectors are reused across distinct components.
   - Action hover states sit inside row hover states instead of being part of one row contract.

7. **Why panel toggles are unreliable**
   - Toggle state is real, but layout effects are expressed through global classes that also fight min-content sizing and panel overflow.
   - Collapsed panels are transformed and faded while grid tracks are also changed, but the panel contract is not owned by the shell component.
   - There are no explicit shell data attributes for state inspection or a small structure check to catch regressions.

8. **Components to extract**
   - `components/shell/AppShell`, `TopBar`, `Sidebar`, `SidebarRow`, `ContextRail`.
   - `components/chat/ChatView`, `ChatHeader`, `ChatTranscript`, `MessageBubble`, `Composer`.
   - `components/memory/BrainMemoryConsole`, `BrainMemoryStatusPanel`, `MemoryDetailPanel`.
   - Small shared UI pieces for empty states, status errors, badges, and buttons can remain lightweight.

9. **Styles to move from globals**
   - All shell, sidebar, chat, composer, message, context rail, memory console, status-card, empty-state, and row styles should move to CSS Modules beside their components.
   - `globals.css` should retain only imports, reset/base, body/html, scrollbar base, and root-level density/theme defaults.

10. **What must remain untouched**
   - Hermes BFF routes and `packages/hermes-client`.
   - Brain Memory BFF routes and `packages/brain-memory-client`.
   - `streamHermesChatFromBff` behavior, memory-scope bridge behavior, localStorage workspace semantics, stable keys, and project/session context shapes.
   - No memory mutation/admin path, direct browser-to-Gateway calls, or storage access should be introduced.

## Proposed Component Tree

```text
apps/web/src/components/
  shell/
    AppShell.tsx
    AppShell.module.css
    TopBar.tsx
    TopBar.module.css
    Sidebar.tsx
    Sidebar.module.css
    SidebarRow.tsx
    SidebarRow.module.css
    ContextRail.tsx
    ContextRail.module.css
  chat/
    ChatView.tsx
    ChatView.module.css
    ChatHeader.tsx
    ChatTranscript.tsx
    MessageBubble.tsx
    MessageBubble.module.css
    Composer.tsx
    Composer.module.css
  memory/
    BrainMemoryConsole.tsx
    BrainMemoryConsole.module.css
    BrainMemoryStatusPanel.tsx
    MemoryDetailPanel.tsx
  ui/
    EmptyState.tsx
    EmptyState.module.css
    StatusCard.tsx
    StatusCard.module.css
```

The exact file count can be smaller if a module remains cohesive, but each visual system must be scoped to its owning component.

## Migration Plan

1. Add shell, chat, memory, and shared UI component folders.
2. Move production imports to the new `components/shell/AppShell`.
3. Implement `SidebarRow` and update project/session/status/action rows to use it.
4. Move shell and top bar layout into CSS Modules and expose state with `data-left-collapsed` and `data-right-collapsed`.
5. Move chat/composer/message styles into chat modules without changing stream logic.
6. Move right rail and memory styles into scoped modules without changing Gateway/BFF behavior.
7. Replace `globals.css` with base/reset/tokens only.
8. Add a lightweight structure check to prevent this drift from returning.

## Risk Controls

- Preserve TypeScript props and hook calls.
- Keep data/context shapes unchanged.
- Avoid touching API routes, client packages, hooks, and storage logic unless imports must be updated.
- Use CSS Modules for visual structure so a future polish prompt cannot accidentally affect all panels.
- Run typecheck/build and existing workspace/Brain Memory checks after refactor.

## Files To Touch

- `apps/web/src/app/page.tsx`
- `apps/web/src/app/globals.css`
- New component folders under `apps/web/src/components/`
- Existing UI component files may remain as compatibility wrappers or be replaced by scoped equivalents.
- `scripts/check-ui-structure.mjs`
- `package.json`
- Slice documentation.

## Files Not To Touch

- `apps/web/src/app/api/**`
- `packages/hermes-client/**`
- `packages/brain-memory-client/**`
- `apps/web/src/lib/hermesChatClient.ts`
- `apps/web/src/lib/brainMemoryClient.ts`
- `apps/web/src/lib/memoryScopeBridge.ts`
- `apps/web/src/lib/workspaceStore.ts`
- `apps/web/src/hooks/useWorkspaceState.ts`
