# OpenAI Dark UI Brief

Status: Direction for Slice 01 and later
Date: 2026-05-29

## Design Direction

Brain Memory Studio should feel inspired by modern OpenAI dark-mode product surfaces: calm, quiet, text-first, responsive, and highly polished. It must not clone OpenAI branding, layouts exactly, logos, names, icons, or proprietary assets.

The product should feel like a serious local workspace for an agent with memory, not a marketing page. The first screen should be the usable app shell.

## Layout

Desktop layout:

```text
Left sidebar          Center chat                         Right panel
Projects             Active session title/model/status    Context
Sessions             Transcript                           Memory evidence
Session actions      Composer                             Tool progress
```

Primary regions:

- Left sidebar: project switcher, project list, titled sessions, create/rename/archive actions.
- Center: active chat session, assistant/user messages, streaming response, composer, stop button, model/status controls.
- Right panel: active project context, memory evidence, retrieval traces, tool/event timeline, run/approval state.
- Memory console: full-page or large-panel view for search, filters, evidence, supersession chain, audit trail, and later admin actions.

## Project And Session UX

The user should understand the current project and session at a glance.

Expected behavior:

- Switching project updates sessions and context immediately.
- Creating a project creates a visible home for sessions and memory scope.
- Creating a session starts with an untitled/new chat state.
- Titles are editable and can later be auto-generated.
- Archived sessions remain recoverable but out of the default flow.
- Project-scoped context is visible without interrupting chat.

## Visual Tone

- Near-black canvas, charcoal surfaces, subtle borders, soft white text.
- Accents should be restrained and functional: focus, online status, selection, warning, destructive.
- Avoid a one-note palette and avoid excessive purple, beige, or decorative gradients.
- Keep density productive on desktop and clear on mobile.
- Use real UI hierarchy, not oversized hero typography inside tool surfaces.
- Cards should be reserved for repeated items, modals, and framed tools; avoid cards inside cards.

## Memory Console UX

The memory console should make persistence inspectable and trustworthy.

Core read-only views:

- Search with tenant/project/session filters.
- Result list with layer, score, trust, timestamps, and scope.
- Memory detail with content and metadata.
- Evidence viewer with excerpts and source labels.
- Supersession chain view.
- Audit trail with actor/action/time/scope.

Later controlled admin actions:

- mark stale;
- supersede;
- pin/unpin;
- delete only by Gateway policy.

Admin actions must feel deliberate: confirmation, clear consequence copy, and visible audit result.

## Tool And Run UX

Tool progress should be visible but not noisy.

- Tool starts/completions belong in the right panel or a collapsible timeline.
- Assistant prose should stay readable and not be polluted by raw tool events.
- Approval requests should be high-signal, with clear choices and risk language.
- Stop/cancel should remain reachable during long-running runs.

## Fast-Streaming UX

The UI must be designed for normal streaming and very fast providers.

Rules for later implementation:

- Do not update React state once per token.
- Buffer text deltas and flush at animation-frame or chunk boundaries.
- Keep transcript rendering virtualized for long chats.
- Keep tool/event panes separate from assistant text to reduce rerenders.
- Show subtle progress without creating layout shift.

Do not build fast-provider controls in Slice 01. The layout should simply leave room for model/status controls and efficient stream rendering.

## Accessibility

Requirements:

- Keyboard navigation for project list, sessions, transcript, composer, tabs, and modal dialogs.
- Visible focus states with sufficient contrast.
- Semantic buttons and landmarks.
- Screen-reader labels for icon-only actions.
- Do not rely on color alone for state.
- Respect reduced-motion preferences.
- Keep text readable at common zoom levels.

## Responsive Layout

Desktop:

- Three-column layout with resizable or collapsible side panels later.
- Composer fixed near the bottom of the center pane.
- Right panel can switch tabs for Context, Memory, Tools, Audit.

Tablet:

- Left sidebar can collapse.
- Right panel can become a drawer.

Mobile:

- Single-column chat-first layout.
- Projects/sessions and memory/context become drawers or tabs.
- Composer remains reachable.
- Long labels must wrap or truncate cleanly without overlap.

