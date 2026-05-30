# Slice 11G Panel Toggle Regression Fix

## Root cause

The side panel controls had become React-only after the component refactor:

- `TopBar` rendered real `button` elements with `onClick` handlers.
- `AppShell` still rendered hidden checkbox controls, but they were controlled with `checked={leftCollapsed}` / `checked={rightCollapsed}` and could not act as an independent native fallback.
- In the real Chrome production-root probe, the visible controls were present and unobstructed, but React event attachment was absent on those controls in that session.

Measured before the fix:

```text
left control: BUTTON, hit target was the button
right control: BUTTON, hit target was the button
React keys on left control: []
data-left-collapsed: false
data-right-collapsed: false
grid before click: 220.797px 1430.2px 269px
grid after left click: 220.797px 1430.2px 269px
grid after right click: 220.797px 1430.2px 269px
horizontal overflow: false
```

So the layout CSS was present, but the user click did not change either React state or the checkbox state.

## Files changed

- `apps/web/src/components/shell/AppShell.tsx`
- `apps/web/src/components/shell/TopBar.tsx`
- `scripts/check-ui-structure.mjs`

## State wiring fix

`AppShell` still owns:

```text
leftCollapsed
rightCollapsed
```

It still writes stable root attributes:

```text
data-left-collapsed
data-right-collapsed
```

The hidden checkbox controls are now uncontrolled native inputs with `defaultChecked={false}` and `onChange` handlers that sync React state when hydration is active:

```text
setLeftCollapsed(event.currentTarget.checked)
setRightCollapsed(event.currentTarget.checked)
```

This gives two working paths:

- hydrated path: label toggles checkbox, `onChange` updates React state and data attributes,
- fallback path: label toggles checkbox natively, CSS `:has(.leftToggle:checked)` / `:has(.rightToggle:checked)` updates the layout even if React click handlers are unavailable.

## CSS selector and layout behavior

No broad layout redesign was needed.

The existing collapse CSS remains the contract:

```text
.shell[data-left-collapsed="true"]
.shell[data-right-collapsed="true"]
.shell:has(.leftToggle:checked)
.shell:has(.rightToggle:checked)
```

The shell grid still transitions `grid-template-columns` over 500ms with the existing easing. Side rails remain mounted, fade and translate out, and the main workspace expands into the freed column.

## Click accessibility

The visible controls are now label-backed icon controls:

- `htmlFor="studio-left-rail-toggle"` / `htmlFor="studio-right-rail-toggle"`,
- `role="button"`,
- `tabIndex={0}`,
- `aria-label`,
- `aria-pressed`,
- `title`.

When React is active, Enter and Space trigger the associated checkbox for keyboard users.

## Regression guard

`scripts/check-ui-structure.mjs` now checks:

- `leftCollapsed` / `rightCollapsed` state exists,
- left/right checkbox ids exist,
- checkbox `onChange` handlers sync state,
- TopBar receives both toggle ids,
- TopBar links visible controls with `htmlFor`,
- TopBar exposes pressed state and titles,
- AppShell CSS includes both data-attribute collapse selectors,
- AppShell CSS includes both checkbox `:has()` fallback selectors,
- rail fade selectors still target `[data-shell-rail="left"]` and `[data-shell-rail="right"]`,
- the 500ms grid transition remains present.

## Real Chrome click verification

Validated against:

```text
http://127.0.0.1:3000/
```

Real Windows Chrome at `1920x1080`, `devicePixelRatio=1`, `visualViewport.scale=1`.

After clicking the left control once:

```text
left checkbox: true
grid: 0px 1651px 269px
left sidebar width: 0px
left sidebar opacity: 0
workspace left: 0px
workspace width: 1651px
horizontal overflow: false
```

After clicking the left control again:

```text
left checkbox: false
grid: 220.797px 1430.2px 269px
left sidebar width: 220.797px
workspace left: 220.797px
workspace width: 1430.203px
horizontal overflow: false
```

After clicking the right control once:

```text
right checkbox: true
grid: 220.797px 1699.2px 0px
right rail opacity: 0
right rail pointer-events: none
workspace width: 1699.203px
horizontal overflow: false
```

After clicking the right control again:

```text
right checkbox: false
grid: 220.797px 1430.2px 269px
right rail opacity: 1
workspace width: 1430.203px
horizontal overflow: false
```

The existing transition remains around 500ms.

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
- No sidebar alignment, typography, or color redesign was made.

## Remaining issues

- The visible controls use label-backed native toggles for resilience; hydrated React state sync still depends on the client runtime attaching normally.
- Rename/archive project and chat controls still need a valid non-nested affordance if they should return.
- The stop button is still visual-only; real stream cancellation remains a future behavior slice.

## Next recommended slice

Slice 11H: Restore project/chat management affordances with a valid Codex-style row menu or command surface, without nesting buttons inside clickable rows and without changing memory scope keys.
