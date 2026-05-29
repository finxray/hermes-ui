# Slice 10B - Codex Shell Refinement

Date: 2026-05-29

## Summary

Slice 10B refines the Slice 10A visual pass so Hermes UI / Brain Memory Studio
feels more like an integrated Codex-inspired local AI workspace.

This was a shell/layout and visual hierarchy slice only. Hermes streaming
logic, Brain Memory BFF logic, memory scope bridge behavior, project/session
stable keys, and storage contracts were not changed.

No memory mutation/admin actions, direct browser-to-Gateway calls, direct
browser-to-Hermes calls, direct storage access, auth expansion, classification,
clearance levels, or policy engine work was added.

## Design Mismatches Found

- Left and right areas still felt like outlined cards instead of integrated
  shell rails.
- The center workspace was rounded, but not dominant enough against the shell.
- The right panel read as a separate card rather than a vertically separated
  context column.
- The top header was inside the chat surface instead of spanning the app.
- The purple/warm glass atmosphere was too weak.
- The composer still felt attached to a footer band.
- Overall hierarchy did not strongly enough point the eye toward the center
  workspace.

## Files Changed

- `apps/web/src/components/AppShell.tsx`
- `apps/web/src/components/ChatView.tsx`
- `apps/web/src/app/globals.css`
- `apps/web/src/styles/tokens.css`
- `docs/design/slice-10b-codex-shell-refinement.png`
- `docs/design/SLICE_10B_CODEX_SHELL_REFINEMENT.md`

## Shell/Layout Corrections

- Added a true app-level top header spanning the full shell.
- Removed outer bordered-card treatment from the left sidebar and right panel.
- Kept the side regions integrated into the dark shell background.
- Made the center chat workspace the dominant rounded surface.
- Increased the center workspace radius, contrast, depth, and top atmospheric
  glow.
- Preserved local left/right panel toggle state and layout resizing.

## Top Header Choices

- Header includes left and right panel toggles.
- Header includes product identity: Brain Memory Studio.
- Header includes compact domain sections: Workspace, Memory, Projects, Tools,
  and Help.
- Header includes compact Hermes and Memory status badges.
- Header is product chrome, not a fake OS/browser title bar.
- Domain section buttons are visual structure only in this slice; no new
  routing or feature logic was added.

## Gradient/Glass Treatment

- Added restrained warm purple and blue-green radial atmosphere near the top of
  the shell.
- Added subtle translucent/glass treatment to the app header.
- Added a restrained purple/teal top glow to the main workspace edge.
- Kept gradients low contrast and avoided neon/glossy effects.

## Composer Refinement

- Removed the hard footer-box feeling.
- Composer now floats over a transparent bottom fade.
- Increased composer depth with a soft shadow and subtle glass surface.
- Kept send button integration, helper text, disabled states, and message send
  behavior unchanged.

## Right Rail Treatment

- Right panel no longer has outer card borders or rounded-card framing.
- Right rail is separated from the center workspace by a subtle vertical
  divider.
- Panel tabs, Memory Console, status cards, search, and detail views remain
  functional.

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

The window showed the actual Hermes UI app with integrated left shell, top
header/menu, dominant rounded center workspace, subtle right rail separation,
and floating composer.

## Screenshot Validity

Valid screenshot evidence was captured from the actual Hermes UI URL:

```text
docs/design/slice-10b-codex-shell-refinement.png
```

The screenshot shows Brain Memory Studio / Hermes UI, not Codex UI or an
unrelated app page.

## Checks Run

- `npm run check:workspace-state`: passed
- `npm run check:brain-memory-client`: passed
- `npm run studio:doctor`: passed
- `npm run typecheck`: passed
- `npm run build`: passed
- `npm audit --audit-level=moderate`: passed

## What Remains

- Mobile could use true drawer behavior for left/right panels instead of stacked
  rails.
- The domain menu could become real navigation once the product has distinct
  Memory/Projects/Tools views.
- Tool/run activity can get a richer Codex-like timeline in a later slice.
- Real Gateway-enabled memory detail screenshots should be recaptured when
  Brain Memory Gateway is enabled locally.
- Full auth/classification, user accounts, clearance levels, and policy engine
  remain deferred.

## Next Slice

Recommended next slice: Slice 10C - mobile drawer behavior and command timeline
polish.
