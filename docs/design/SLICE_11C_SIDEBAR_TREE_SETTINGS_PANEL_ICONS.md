# Slice 11C Sidebar Tree Settings Panel Icons

## Files changed

- `apps/web/src/components/ui/PanelToggleIcon.tsx`
- `apps/web/src/components/shell/TopBar.tsx`
- `apps/web/src/components/shell/AppShell.tsx`
- `apps/web/src/components/shell/AppShell.module.css`
- `apps/web/src/components/shell/Sidebar.tsx`
- `apps/web/src/components/shell/Sidebar.module.css`
- `apps/web/src/components/shell/SidebarRow.tsx`
- `apps/web/src/components/shell/SidebarRow.module.css`
- `apps/web/src/components/shell/ContextRail.module.css`
- `apps/web/src/components/chat/Composer.tsx`
- `apps/web/src/components/chat/Composer.module.css`
- `apps/web/src/data/mockWorkspace.ts`

## OpenAI-style panel icons

Added `PanelToggleIcon`, a local inline SVG component with no new dependency:

- rounded rectangle outer frame,
- vertical split line,
- smaller section on the left for the left panel icon,
- smaller section on the right for the right panel icon,
- `currentColor` strokes so it follows the topbar hover/active states.

The topbar now uses this icon for both the left and right panel toggles instead of lucide panel icons.

## Send and stop visual states

The composer now derives `canSend` from the local draft text:

- empty or whitespace-only draft: send icon/button remains dim,
- at least one non-whitespace character: send icon/button gets a bright white visual state,
- generating state: stop placeholder uses the same bright white visual state.

The stop button remains visual-only. No stream cancellation or Hermes request behavior changed.

## Sidebar tree model

Removed the separate visible `Sessions` section. Chats now appear as child rows under project groups, with a Codex-like hierarchy in the default mock workspace:

- `brain-memory`
  - `Add memory detail and evidence`
  - `Add read-only UI API`
  - `Check crash status`
  - `Integrate Brain Memory with Hermes`
  - `Fix config parse error`
- `hermes-ui`
  - `Polish Codex-style UI`
  - `Initialize Hermes UI repo`
- `projects`
  - `Remove OpenClaw files`
  - `Audit Hermes integration`
- `integrations  brain-memory`
  - `No chats`
- `Chats`
  - recent chat shortcuts

The default mock labels changed, but existing project/session ids and stable memory keys were preserved. Existing localStorage users may need `Reset mock data` to see the new default mock hierarchy.

## Sidebar row alignment

`SidebarRow` now supports a `depth` prop for child rows. Child rows reserve a consistent indent and text column while project rows keep the folder icon slot.

During browser verification, the old rename/archive action buttons were found to be invalidly nested inside clickable row buttons. Chrome reparsed them outside the row, which made the action icons appear as separate sidebar rows. Those visible inline action buttons were removed from the tree for this slice to restore a clean Codex-like row rhythm. Project/session rename/archive behavior remains in the workspace reducer, but those controls are not exposed in this polished tree view.

## Settings popover

The always-visible `Mock connections` footer section was removed.

The bottom sidebar now has a sticky `Settings` row. Opening it shows a Codex-like account/settings popover containing:

- Brain Memory Studio local profile placeholder,
- Settings row,
- Mock connections,
- Hermes status,
- Brain Memory status,
- LocalStorage status,
- Reset mock data,
- Refresh Hermes.

The popover uses a native checkbox/label fallback so it opens even before React hydration. Escape and outside-click close are also wired when React is hydrated.

## Right rail reveal fix

The right rail now stays mounted with a stable `width: var(--rail-width-right)`. The shell grid column animates between the rail width and `0px`, while the rail transforms and fades out. This keeps the right rail content from reflowing during collapse/reveal and makes the main workspace expand/shrink against a clipped rail.

Left rail behavior was preserved.

## Browser verification

Opened the production root in real Windows Chrome:

- `http://127.0.0.1:3000/`

Validated:

- no separate `Sessions` heading,
- project groups with child chat rows,
- `No chats` under the empty integrations group,
- bottom sticky Settings row,
- Settings popover contains mock connections,
- two split-panel toggle icons are present,
- right rail is visible at desktop width,
- no horizontal overflow.

Screenshot evidence:

- `artifacts/slice11c-real-chrome-final.png`
- `artifacts/slice11c-real-chrome-popover-open.png`

The `artifacts/` directory is ignored and was not committed.

## Checks run

- `npm run check:workspace-state` passed
- `npm run check:brain-memory-client` passed
- `npm run studio:doctor` passed
- `npm run check:ui-structure` passed
- `npm run typecheck` passed
- `npm run build` passed
- `npm audit --audit-level=moderate` passed with 0 vulnerabilities

## Deliberately not changed

- No Hermes streaming logic changed.
- No Brain Memory BFF logic changed.
- No memory scope bridge behavior changed.
- No backend/API routes changed.
- No memory mutation or admin action was added.
- No direct browser-to-Gateway, browser-to-Hermes, or browser-to-storage path was added.
- No auth/classification system was implemented.

## Remaining issues

- Real stream cancellation is still future work; the stop icon is still a visual placeholder.
- Rename/archive controls need a future non-nested pattern, such as a row context menu or command palette action, if they should return to the visible tree.
- A later polish pass can tune exact sidebar density once the user reviews the new tree rhythm in the foreground browser.

## Next recommended slice

Slice 11D: restore project/chat management affordances using a valid Codex-style row menu or command surface, without nesting buttons inside clickable rows and without changing memory scope keys.
