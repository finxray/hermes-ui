# Codex Style Layout Contract

This contract describes the target visual structure for Brain Memory Studio / Hermes UI. It is inspired by Codex/OpenAI dark UI patterns, but it must not copy OpenAI branding, icons, or proprietary text.

## Shell hierarchy

- App background: one integrated dark environment with a restrained warm/purple top atmosphere.
- Left rail: transparent/integrated rail, not a card. It may have a subtle vertical divider only.
- Center workspace: the dominant rounded window surface. It owns the chat header, warning affordance, transcript, and floating composer.
- Right rail: same background family as the center workspace, separated by a subtle divider. It must not appear as a separate boxed card.
- Top menu: text-first domain navigation with transparent default buttons, soft hover fill, and soft selected fill.

## Target dimensions

- Top menu/header: 56-64px.
- Left rail: 320-360px on desktop.
- Right rail: 360-440px on desktop, depending on content density.
- Center chat column: no less than 720px preferred width on desktop.
- Workspace corner radius: 20-24px on the outer left corners when adjacent to the right rail.
- Selected rail row radius: 16-18px.

## Control language

- Default buttons are transparent.
- Hover uses a soft filled background.
- Selected/active state uses a slightly stronger filled background.
- Borders are reserved for primary surfaces, composer, inputs, and real card/detail content.
- Menu labels should not use bold by default.
- Sidebar section titles use title case, not all caps.
- Row counts align to a shared right column.

## Chat rhythm

- User messages align right with a soft filled background and no outline.
- Assistant messages align left and usually have no bubble background.
- Tool/activity rows are compact, low-contrast, and may shimmer while running.
- Scope and route metadata should read as muted text, not chips.
- Warning content should be orange and restrained, with a glass-like floating treatment only when it is pinned.

## Composer

- Composer floats above the bottom of the center workspace.
- It uses the same rounded glass/dark surface language as the warning affordance.
- It includes attach, model, options, mic, and send controls.
- Model label remains visible.
- Send behavior must remain unchanged when production adopts the design.

## Right rail

- Rail background matches the center workspace.
- Internal content should be readable and spaced, with fewer nested card layers.
- Tabs use transparent default state and soft selected fill.
- Capability/status labels should not look like heavy pills unless they are truly actionable.
- Memory detail remains read-only unless a later explicit slice adds Gateway-mediated mutation/admin actions.

## Responsive contract

- Desktop: left rail, center workspace, right rail.
- Tablet: one rail may collapse; center remains dominant.
- Mobile: rails stack or collapse; no horizontal overflow.
- Panel open/close motion should be 0.5s with a smooth cubic easing and no layout jumps.

