# Slice 10C - Control Language Refinement

Date: 2026-05-29

## Summary

Slice 10C is a focused micro-polish pass on the Codex-inspired shell. It
softens control styling, reduces outline-heavy defaults, and makes the center
workspace plus right rail feel more like one shared shell environment.

This was a presentation-only slice. Hermes streaming logic, Brain Memory BFF
logic, memory scope bridge behavior, project/session stable keys, and storage
contracts were not changed.

No memory mutation/admin actions, direct browser-to-Gateway calls, direct
browser-to-Hermes calls, direct storage access, auth expansion, classification,
clearance levels, or policy engine work was added.

## Remaining Mismatches Identified

- Right rail background still felt slightly separate from the center workspace.
- Too many controls used visible outline borders in their default state.
- Left navigation items felt too much like boxed buttons.
- Top menu controls were still more outlined than Codex-style controls.
- Active states relied too much on border/edge emphasis instead of soft filled
  background highlights.

## Files Changed

- `apps/web/src/app/globals.css`
- `apps/web/src/styles/tokens.css`
- `docs/design/slice-10c-control-language-refinement.png`
- `docs/design/SLICE_10C_CONTROL_LANGUAGE_REFINEMENT.md`

## Shell Background Unification

- Added a subtle horizontal shell tint so the middle and right regions share a
  closer background environment.
- Added a restrained right-rail atmospheric tint instead of a distinct boxed
  background.
- Kept the center workspace as the dominant rounded surface while making the
  right rail feel more integrated.
- Softened the right rail divider so separation is spacing and tone, not a
  heavy boundary.

## Button/Control Styling Changes

- Reduced default borders on text buttons, icon buttons, tabs, model selector,
  memory result buttons, chips, and compact actions.
- Hover states now use quiet filled background shifts.
- Focus states remain visible through a soft ring, not a default hard outline.
- Status badges and reference chips use low-contrast filled surfaces.
- Internal panel cards keep subtle borders where structure is useful.

## Left Sidebar Refinements

- Project and session rows now default to flatter, outline-free surfaces.
- Hover states use a soft fill.
- Active project/session selection now uses filled background emphasis rather
  than border or left-edge emphasis.
- Mini rename/archive actions are quieter by default and only fill on hover.

## Top Header Refinements

- Removed the visible outline from the top menu capsule.
- Top menu items now use background-highlighted active/hover states.
- Header controls remain compact and domain-specific.
- Left/right panel toggles are preserved and still accessible.

## Selected/Active State Behavior

- Active project, session, top menu item, panel tab, and memory result selection
  now communicate selection primarily through a soft filled background.
- Border emphasis was reduced or removed from active states.
- No selection logic changed; this is CSS-only presentation behavior.

## Functionality Smoke Result

Browser smoke at `http://127.0.0.1:3000` confirmed:

- project switching worked
- session switching worked
- left panel toggle worked
- right panel toggle worked
- Hermes status rendered
- Brain Memory status/search/detail rendered
- Memory detail opened from seeded mock/local evidence when Gateway was disabled
- composer remained visible
- reload restored the active localStorage-backed workspace state
- desktop/tablet/mobile checks showed no horizontal overflow

Create/new chat/rename/title cleanup behavior remains covered by:
`npm run check:workspace-state`.

## Real Chrome Smoke Result

Opened a real Windows Chrome app window at:

```text
http://127.0.0.1:3000
```

The window showed the actual Hermes UI app with left sidebar, top header,
center workspace, and right panel using the refined flatter control language.

## Screenshot Validity

Valid screenshot evidence was captured from the actual Hermes UI URL:

```text
docs/design/slice-10c-control-language-refinement.png
```

The screenshot shows Brain Memory Studio / Hermes UI, not Codex UI or an
unrelated app page.

Follow-up correction after visual review:

```text
docs/design/slice-10c-corrected-codex-shell.png
```

The corrected screenshot shows the shell background continuing behind the right
rail instead of using a visibly separate right-side background. It also shows
flatter top menu controls and left sidebar action rows with less extra button
background.

## Checks Run

- `npm run check:workspace-state`: passed
- `npm run check:brain-memory-client`: passed
- `npm run studio:doctor`: passed
- `npm run typecheck`: passed
- `npm run build`: passed
- `npm audit --audit-level=moderate`: passed

## What Remains

- Mobile can still benefit from real drawer behavior for left and right panels.
- The top domain menu can become real navigation when separate Memory,
  Projects, Tools, and Help surfaces exist.
- Tool/run activity can receive a richer command timeline treatment.
- Real Gateway-enabled memory detail screenshots should be recaptured when
  Brain Memory Gateway is enabled locally.
- Full auth/classification, user accounts, clearance levels, and policy engine
  remain deferred.

## Next Slice

Recommended next slice: Slice 10D - mobile drawer behavior and command timeline
polish.
