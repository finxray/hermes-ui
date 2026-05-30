# Slice 11E Top Menu And Sidebar Indent

## Files changed

- `apps/web/src/components/shell/AppShell.tsx`
- `apps/web/src/components/shell/TopBar.tsx`
- `apps/web/src/components/shell/TopBar.module.css`
- `apps/web/src/components/shell/SidebarRow.module.css`

## Starting state

The worktree was clean before this slice started.

Recent HEAD:

```text
688baed fix: correct UI density and surface polish at 100 percent zoom
```

No backend, Hermes streaming, Brain Memory BFF, memory-scope bridge, project/session stable-key, storage, auth, or API route logic was changed.

## Top menu sizing changes

The top menu was visually a little too chunky after the Slice 11D 100% zoom density correction.

Measured before this slice at a 1920x1080 real Chrome viewport:

```text
Workspace menu item: 91.5px x 27.5px
font size: 14.288px
horizontal padding: 11.224px
border radius: 10px
```

The menu item sizing is now calmer:

- menu gap reduced from `4px` to `2px`,
- topbar gap reduced from `18px` to `14px`,
- topbar horizontal padding reduced from `18px` to `16px`,
- menu item height reduced from `0.82 * --control-height` to `0.72 * --control-height`,
- menu item padding reduced to `clamp(8px, calc(6px + 0.16vw), 12px)`,
- menu item radius reduced from `10px` to `8px`,
- menu item font changed from `--font-ui` to `--font-small`.

Measured after:

```text
Workspace menu item: 77.2px x 24.1px
font size: 12.228px
horizontal padding: 9.072px
border radius: 8px
```

The active Workspace state remains visible through the existing hover/active surface color, but it no longer reads oversized.

The topbar rail toggles are now semantic `button` elements with direct shell state handlers. This keeps the same icon-only visual treatment while removing the label/hidden-checkbox click ambiguity found during browser probing.

## Sidebar indent changes

The child rows were too far to the right because they reserved an empty icon column.

Measured before:

```text
project label x: 49.9px
child label x: 72.0px
delta: 22.1px
```

Child rows now use a zero-width icon column, no grid gap, and a smaller explicit child padding offset:

```css
grid-template-columns: 0 minmax(0, 1fr) minmax(20px, auto);
gap: 0;
padding-left: calc(clamp(12px, calc(8px + 0.25vw), 18px) + var(--icon-sm) + 14px);
```

Measured after:

```text
project label x: 49.9px
child label x: 54.9px
delta: 5.0px
```

The active child row keeps the same full-row background rhythm as other sidebar rows. Chat shortcut rows in the `Chats` section keep their top-level icon alignment.

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

Confirmed in the measured DOM:

- top menu is smaller and calmer,
- active Workspace is still visible without a chunky shape,
- child chat rows are aligned close to project text while still reading as children,
- no nested backgrounds or extra action rows were added,
- no horizontal overflow exists.

Screenshot evidence:

```text
artifacts/slice11e-real-chrome-final.png
```

The `artifacts/` directory is ignored and was not committed.

Hidden/background Chrome still deferred React click hydration in CDP, which is a known limitation from prior validation notes. The topbar toggle controls were nevertheless corrected to real buttons in code and passed typecheck/build.

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
- A foreground user review should confirm the topbar button feel and child-indent rhythm on the actual display.

## Next recommended slice

Slice 11F: Restore project/chat management affordances with a valid Codex-style row menu or command surface, without nesting buttons inside clickable rows and without changing memory scope keys.
