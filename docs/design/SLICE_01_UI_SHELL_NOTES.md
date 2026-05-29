# Slice 01 UI Shell Notes

Date: 2026-05-29

## Visual Decisions

- Built a quiet OpenAI-dark-inspired shell, not a clone: near-black canvas, charcoal surfaces, low-contrast borders, soft white text, and restrained teal/blue status accents.
- Used a desktop three-column layout: project/session sidebar, central chat workspace, and right context console.
- Tablet layout stacks the right panel below the chat; mobile becomes a single-column flow with horizontally scrollable project choices.
- Composer and send button are visibly disabled to avoid implying real Hermes integration.
- Connection badges explicitly say `Disconnected / mock`.

## Component Structure

```text
apps/web/src/app/
  layout.tsx
  page.tsx
  globals.css

apps/web/src/components/
  AppShell.tsx
  Sidebar.tsx
  ChatView.tsx
  MessageBubble.tsx
  Composer.tsx
  ContextPanel.tsx
  ModelSelector.tsx
  StatusBadge.tsx

apps/web/src/data/
  mockWorkspace.ts
  types.ts

apps/web/src/styles/
  tokens.css
```

## Mocked In This Slice

- Projects and sessions.
- Active project: Brain Memory.
- Active session: Hermes UI roadmap.
- Chat transcript.
- Retrieved memory evidence.
- Hermes tool activity.
- Files/artifacts.
- Provider choices, including a Cerebras / Kimi K2.6 placeholder.
- Hermes and Brain Memory Gateway connection status.

No real Hermes, Brain Memory Gateway, provider, BFF, API key, database, vector store, or storage calls were added.

## Fast Streaming Note

The message/composer structure leaves room for future streaming, but streaming is not implemented. Future slices should batch stream deltas through an external buffer and animation-frame or timed flush instead of updating React state per token.

## What Remains For Slice 02

- Make project/session selection interactive.
- Add create/rename/archive/delete placeholder flows.
- Add local mock persistence through a replaceable storage adapter.
- Add empty, loading, and basic error states.
- Keep all data local and mocked.

## Design Compromises

- Right-panel tabs are visual only in Slice 01.
- Package client directories are placeholders only.
- No settings drawer yet; Slice 01 focuses on the main surface.
- No transcript virtualization yet because the data is static and small.

## Run Command

```powershell
npm install
npm run dev
```

Then open:

```text
http://localhost:3000
```
