# Slice 10A - Codex-Style Dark Workspace Design Pass

Date: 2026-05-29

## Summary

Slice 10A polishes Hermes UI / Brain Memory Studio into a calmer local AI
workspace inspired by Codex and ChatGPT dark-mode product surfaces.

This was a presentation-only slice. Hermes streaming logic, Brain Memory BFF
logic, memory scope bridge behavior, project/session stable keys, and storage
contracts were not changed.

No memory mutation/admin actions, direct browser-to-Gateway calls, direct
browser-to-Hermes calls, direct storage access, auth expansion, classification,
clearance levels, or policy engine work was added.

## Visual Audit Findings

- The app had the correct three-region product shape, but the regions read as
  flat columns rather than a polished workspace.
- The center chat area needed a stronger rounded main surface, softer top glow,
  and more intentional top header treatment.
- Left navigation needed warmer charcoal surfaces, softer active states, and a
  cleaner project/session tree feel.
- The right panel was functional but visually close to a debug console.
- User and assistant messages were distinguishable, but the contrast and
  surface treatment needed refinement.
- Tool activity rows lacked an execution-style loading affordance.
- The composer was visible and functional, but needed a more integrated,
  premium input surface.
- Responsive layout worked structurally, but panel collapse behavior was needed
  for desktop and smaller screens.

## Files Changed

- `apps/web/src/components/AppShell.tsx`
- `apps/web/src/components/ChatView.tsx`
- `apps/web/src/components/ContextPanel.tsx`
- `apps/web/src/components/MessageBubble.tsx`
- `apps/web/src/components/Sidebar.tsx`
- `apps/web/src/app/globals.css`
- `apps/web/src/styles/tokens.css`
- `docs/design/slice-10a-codex-style-ui.png`
- `docs/design/SLICE_10A_CODEX_STYLE_DESIGN_PASS.md`

## Codex-Inspired Design Choices

- Kept the existing Brain Memory Studio / Hermes UI product identity.
- Used near-black canvas, warm charcoal rails, subtle borders, and restrained
  teal/blue accents for state and focus.
- Added a soft top glow and rounded workspace surface without copying Codex
  branding, copy, icons, or exact chrome.
- Preserved dense operational UI rather than adding a landing page or marketing
  composition.

## App Shell Changes

- `AppShell` now owns local left/right panel visibility state.
- The desktop shell uses a padded, gapped three-column workspace with rounded
  sidebar, central chat surface, and right context panel.
- Collapsed panels are removed from layout so they do not leave dead whitespace.
- The main chat surface has rounded corners, subtle border, top glow, and
  stronger central visual weight.

## Top Bar Changes

- The chat header now includes left and right panel toggle buttons.
- The header keeps the active session title, active project/session summary,
  model selector, and compact Hermes status indicator.
- Header styling now uses a subtle translucent gradient and border treatment.

## Left/Right Panel Toggle Behavior

- Left sidebar can collapse and reopen from the top bar.
- Right context/memory panel can collapse and reopen from the top bar.
- Toggle buttons have accessible labels and `aria-pressed` state.
- Toggle state is local React state only and is not persisted.

## Chat And Message Changes

- User messages now use a more distinct quiet blue-charcoal bubble.
- Assistant/Hermes messages use a subtler surface with assistant avatar accent.
- Streaming messages get a soft shimmer without changing streaming logic.
- Reference chips and status pills remain intact.

## Tool/Command Activity Changes

- Tool activity rows now expose status through a `data-status` attribute.
- Started/pending tool rows show a subtle shimmer.
- Completed and failed states use restrained border treatment rather than loud
  colors.
- Event append/normalization logic was not changed.

## Composer Changes

- Composer now has a larger rounded surface with subtle depth.
- Focus state uses a calm accent ring and border.
- Send button remains integrated on the right and keeps existing disabled
  behavior.
- Helper text remains subdued below the composer.

## Brain Memory Console Changes

- Memory search, result cards, selected result state, status panels, detail
  content, metadata, and scope fields now share the softer dark surface system.
- Long card metadata wraps in panel contexts so technical scope text remains
  readable.
- Evidence and supersession remain honest read-only/not-implemented surfaces;
  no fake data was added.

## Responsive Behavior

- Desktop supports left sidebar, central workspace, and right panel.
- Tablet stacks the right panel cleanly and preserves panel toggles.
- Mobile uses a single-column flow with no horizontal overflow observed.
- Composer remained visible and usable in desktop, tablet, and mobile smoke
  checks.

## Accessibility Notes

- Icon-only panel toggles include accessible labels.
- Toggle buttons expose pressed state.
- Shared focus-visible styles were added for buttons and controls.
- Reduced-motion users do not receive shimmer animation.
- The design does not rely on color alone; text labels and status copy remain.

## Functionality Smoke Result

Browser smoke at `http://127.0.0.1:3000` confirmed:

- project switching worked
- session switching worked
- left panel toggle worked
- right panel toggle worked
- Hermes status rendered as connected in the local environment
- Brain Memory status/search console rendered
- Memory tab/search/detail opened against seeded mock/local evidence when
  Gateway results were unavailable
- composer remained visible
- localStorage restored existing project/session state
- desktop/tablet/mobile checks showed no horizontal overflow

Create/rename/archive behavior was preserved by the reducer check:
`npm run check:workspace-state`.

Evidence/supersession still show honest `not_implemented` states in the real
Gateway contract checks covered by `npm run check:brain-memory-client`. In this
local smoke, Brain Memory Gateway was disabled, so the Memory Console used
mock/local evidence for the interactive detail panel.

## Real Chrome Smoke Result

Opened a real Windows Chrome app window at:

```text
http://127.0.0.1:3000
```

The window showed the actual Hermes UI app, not Codex: Brain Memory Studio,
Codex-inspired left sidebar, rounded central workspace, top header, chat, and
right Context/Memory panel.

## Screenshot Validity

Valid screenshot evidence was captured from the actual Hermes UI URL:

```text
docs/design/slice-10a-codex-style-ui.png
```

The screenshot shows Brain Memory Studio / Hermes UI, the Codex-inspired left
sidebar, rounded main workspace, top header, central chat, and right context
panel. It is not a Codex sidebar, Codex project list, Codex command log, Codex
reasoning screen, or unrelated page.

## Checks Run

- `npm run check:workspace-state`: passed
- `npm run check:brain-memory-client`: passed
- `npm run studio:doctor`: passed
- `npm run typecheck`: passed
- `npm run build`: passed
- `npm audit --audit-level=moderate`: passed

## What Remains

- A later pass can add a fuller responsive drawer model for mobile panels.
- Real Gateway-enabled memory detail screenshots should be recaptured when
  Brain Memory Gateway is enabled in the local environment.
- Tool activity can later move toward a richer run timeline once Hermes run and
  approval endpoints are integrated end to end.
- Full auth/classification, user accounts, clearance levels, and policy engine
  remain deferred.

## Next Slice

Recommended next slice: Slice 10B - responsive drawer polish and run/tool
timeline refinement.
