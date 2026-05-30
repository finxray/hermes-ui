# Message Renderer Performance Budget 14F

Date: 2026-05-31

## Purpose

Slice 14F hardens rich assistant message rendering for long transcripts and
future high-throughput providers while keeping the current architecture intact:

```text
Browser UI -> Next.js BFF -> Hermes API server
```

This is frontend renderer, fixture, smoke, and documentation work only. It does
not change Hermes streaming logic, Brain Memory BFF logic, memory scopes,
project/session keys, storage, auth, export/import, provider calls, or memory
mutation/admin behavior.

## Renderer Audit

Streaming behavior:

- `ChatView` already coalesces assistant deltas with `requestAnimationFrame`.
- `MessageMarkdown` still parses markdown whenever the visible assistant
  message content changes.
- Syntax highlighting is skipped while `message.status === "streaming"`.
- Completed code blocks previously re-tokenized on any parent re-render.
- Copy button state is local to the button, but parent row memoization was not
  protecting unchanged transcript rows.

Long transcript behavior:

- `ChatTranscript` maps every message in the selected session.
- There is no virtualization yet.
- Before this slice, `MessageBubble` and `AgentActivityBlock` were not memoized.
- Scrolling is stable in existing smoke tests, but very large transcripts still
  need a measured virtualization threshold before adding heavier machinery.

Long markdown behavior:

- Code blocks already had horizontal scrolling.
- Tables already used an overflow wrapper.
- Very long code blocks could grow vertically without a practical cap.
- Long links and long inline code needed stronger wrapping rules.
- Copy feedback could change button width when switching from `Copy code` to
  `Copied`.

Safety:

- Raw HTML remains skipped with `skipHtml`.
- `dangerouslySetInnerHTML` remains absent.
- Links still pass through `safeHref` and render with `target="_blank"` and
  `rel="noreferrer"`.
- Copy actions copy raw message/code text only, not hidden DOM or activity
  details.

## Budget

Streaming assistant messages:

- Visible text updates should remain coalesced through `requestAnimationFrame`.
- Do not run syntax highlighting while a message is streaming.
- Do not introduce per-token React state updates.
- Do not add heavyweight markdown/highlighting dependencies for the active
  stream path.

Completed assistant messages:

- Memoize unchanged message rows so transcript updates do not re-render every
  completed bubble.
- Memoize completed code highlighting by code, language, and streaming state.
- Keep highlighting lightweight and bounded; defer richer highlighting until a
  measured need justifies the cost.

Long code blocks:

- Code blocks scroll horizontally for long lines.
- Code blocks cap vertical height at `min(56vh, 520px)` and scroll internally.
- Copy controls remain outside the scrollable code body and stay accessible.

Tables and long inline content:

- Tables scroll horizontally inside message content.
- Long links and inline code wrap within the message bounds.
- The page must not gain horizontal overflow because of markdown content.

Transcript scale:

- Virtualization is deferred for now.
- Revisit virtualization after measured evidence from large sessions, such as
  hundreds of messages, repeated large code blocks, or visible input latency.
- Activity rows should remain collapsed by default and grouped/memoized.

Fast-provider considerations:

- Cerebras/Kimi-like streams may emit deltas faster than humans can read.
- The UI should continue batching visible text and should not parse/highlight
  each raw token independently.
- Provider credentials and provider calls must remain behind Hermes/BFF, never
  in browser code.

## Smoke Targets

The deterministic smoke targets are:

- `/design/markdown-fixture` loads without serious browser errors.
- `/design/markdown-long-fixture` loads without serious browser errors.
- Long fixture route has no horizontal page overflow.
- Long code block is visible and has bounded internal scrolling.
- Wide table is visible and wrapped in an overflow scroller.
- Copy buttons are present and feedback does not significantly shift layout.
- Raw HTML sentinels do not create DOM elements.
- Partial streaming markdown renders without crashing.

## Changes In This Slice

- `MessageMarkdown` and `CodeBlock` are memoized.
- Completed code block highlighting is memoized by code/language/streaming
  state.
- `MessageBubble` is memoized for unchanged transcript rows.
- `AgentActivityBlock` memoizes display-event grouping.
- Code blocks gained bounded vertical scrolling.
- Long links and inline code gained stronger wrapping rules.
- Copy buttons gained a stable minimum width.
- A long deterministic fixture and route were added.
- `npm run smoke:markdown:long` verifies the long-route behavior.

## Deferred

- Full transcript virtualization.
- Pixel-by-pixel visual regression.
- Richer language grammar support.
- Code block line numbers or word-wrap toggle.
- Export/import and semantic share actions.
- Provider/model runtime switching.

## Next Recommended Slice

Slice 14G - Stale Server Recovery UX And Smoke Base URL Hygiene.

Reason: Slice 14F protects renderer performance, but the repeated local issue
is stale `3000` processes serving outdated routes/chunks. The next useful slice
is to tighten developer-facing recovery and smoke base URL guidance without
changing product behavior.
