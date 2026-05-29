# Design system — OpenAI-inspired dark theme

Direction: calm, premium, minimal, text-first, restrained motion, subtle depth.

This is an inspiration target, not a clone. Do not use OpenAI logos, proprietary assets, or exact product branding.

## Layout

```text
┌───────────────────────────────────────────────────────────────┐
│ Top bar: project, model, connection status, settings           │
├───────────────┬─────────────────────────────┬─────────────────┤
│ Project +     │ Chat transcript             │ Context /        │
│ sessions      │ Composer                    │ Memory / Tools    │
│ sidebar       │                             │ panel             │
└───────────────┴─────────────────────────────┴─────────────────┘
```

## Visual personality

- Background: near-black, not pure black.
- Surfaces: layered charcoal with low-contrast borders.
- Text: soft white, not harsh white.
- Accent: restrained green/blue/teal only for state and focus.
- Motion: quick, subtle, useful.
- Corners: rounded but not bubbly.
- Density: desktop productive, mobile clean.

## Draft tokens

```css
:root {
  --bg-canvas: #08090a;
  --bg-app: #0d0e10;
  --bg-surface: #15171a;
  --bg-surface-2: #1b1d21;
  --bg-elevated: #202329;

  --border-soft: rgba(255, 255, 255, 0.08);
  --border-strong: rgba(255, 255, 255, 0.14);

  --text-primary: #f4f4f5;
  --text-secondary: #b5b7bd;
  --text-muted: #777b84;

  --accent: #8ee6c6;
  --accent-dim: rgba(142, 230, 198, 0.12);
  --danger: #ff6b6b;
  --warning: #f3c969;

  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 18px;
  --radius-xl: 24px;
}
```

Codex may adjust tokens during Slice 1, but it should keep the same tone.

## Key components

- `AppShell`
- `ProjectSidebar`
- `SessionList`
- `ChatView`
- `MessageBubble`
- `Composer`
- `ContextPanel`
- `MemoryEvidenceCard`
- `ToolEventTimeline`
- `ConnectionStatus`
- `ModelSelector`
- `SettingsPanel`

## Interaction rules

- Switching project updates session list and context panel instantly.
- Active project and active session must be visually obvious.
- Tool events should be visible but not noisy.
- Memory evidence should be inspectable without interrupting chat.
- The composer should stay fast even while responses stream.
