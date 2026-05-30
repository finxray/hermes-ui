# Rich Response Renderer 14D

Date: 2026-05-31

## Purpose

Slice 14D upgrades assistant response rendering from newline-split plain text
to a safer, more polished ChatGPT-like markdown surface with code blocks, code
copy, message copy, and dark-theme typography.

This is a frontend rendering slice only. It does not change Hermes streaming,
Brain Memory BFF behavior, memory scope bridging, backend routing, storage, or
agent behavior.

## Files Changed

- `apps/web/src/components/chat/MessageBubble.tsx`
- `apps/web/src/components/chat/MessageBubble.module.css`
- `apps/web/src/components/chat/MessageMarkdown.tsx`
- `apps/web/src/components/chat/MessageMarkdown.module.css`
- `apps/web/package.json`
- `package-lock.json`
- `package.json`
- `scripts/check-message-rendering.mjs`
- `scripts/check-ui-structure.mjs`
- `docs/design/RICH_RESPONSE_RENDERER_14D.md`
- `ROADMAP.md`

## Markdown Stack Chosen

The renderer uses:

- `react-markdown`
- `remark-gfm`

Reasons:

- mature React markdown renderer;
- raw HTML is not enabled;
- GitHub-flavored markdown gives tables, task-like list syntax, strikethrough,
  and better list behavior;
- smaller and safer than adding a full rich-text editor or raw HTML pipeline.

No `rehype-raw` is used. No `dangerouslySetInnerHTML` is used.

## Safety Model

Safety rules:

- raw HTML is skipped with `skipHtml`;
- no dangerous HTML injection path is used;
- links pass through a safe `http`, `https`, or `mailto` protocol check;
- links render with `target="_blank"` and `rel="noreferrer"`;
- command/activity details stay on their existing renderer and are not mixed
  into assistant markdown;
- user messages remain simple newline-preserving text.

## Code Highlighting And Copy

Fenced code blocks render with:

- a dark code frame;
- language label when provided, otherwise `text`;
- horizontal scrolling for long lines;
- selectable code text;
- copy button that copies only raw code, not the header;
- copied-state feedback.

Highlighting is intentionally lightweight. The UI tokenizes common language
families in React and renders spans for keywords, strings, comments, and
numbers. It avoids a large syntax highlighting dependency in this slice.

During active streaming, code blocks render without eager token highlighting so
partial fences and high-frequency updates remain cheap and safe.

## Message-Level Actions

Assistant messages now show a subtle `Copy message` action when content is
present. It copies the raw assistant message text, not rendered HTML.

No regenerate, fork, retry, or export actions were added because they would
imply behavior outside this frontend rendering slice.

## Typography

Assistant markdown now supports styled:

- paragraphs;
- headings;
- ordered and unordered lists;
- blockquotes;
- inline code;
- fenced code blocks;
- links;
- tables;
- horizontal rules.

The styling uses existing dark-theme tokens and keeps user messages visually
simple and right-aligned.

## Streaming And Fast-Provider Considerations

The existing `requestAnimationFrame` batching in `ChatView` remains unchanged.

Renderer choices for streaming:

- partial markdown is accepted by `react-markdown`;
- raw HTML is skipped;
- code block token highlighting is disabled while the message status is
  `streaming`;
- copy actions operate on raw text and do not reparse content;
- no per-token syntax highlighter or worker was added.

This keeps the renderer compatible with future high-throughput providers such
as Cerebras/Kimi-like streams.

## Checks

Slice 14D adds:

```powershell
npm run check-message-rendering
```

It verifies:

- markdown renderer and GFM dependency are wired;
- raw HTML is skipped;
- no `dangerouslySetInnerHTML`;
- safe link attributes/helper are present;
- code block component and copy handler exist;
- Clipboard API fallback exists;
- streaming avoids eager code highlighting;
- assistant messages use the markdown renderer;
- user messages keep simple newline-preserving rendering.

## Remaining Improvements

- deterministic visual fixture for markdown examples;
- richer language coverage;
- optional line numbers;
- code block word-wrap toggle;
- virtualized long transcript rendering before very large sessions;
- semantic copy/share/export actions after the export/import contract is ready.

## Slice 14E Follow-Up

Slice 14E added the deterministic fixture route and browser smoke for this
renderer:

```powershell
npm run smoke:markdown
```

See `docs/design/MARKDOWN_FIXTURE_SMOKE_14E.md`.

## Slice 14F Follow-Up

Slice 14F added a renderer performance budget, long markdown fixture route, and
long fixture smoke:

```powershell
npm run smoke:markdown:long
```

It also memoized unchanged message rows/code blocks, bounded long code block
height, hardened long link/table overflow behavior, and preserved the existing
streaming highlight skip path. See
`docs/design/MESSAGE_RENDERER_PERFORMANCE_BUDGET_14F.md`.

## Next Recommended Slice

Slice 14G - Stale Server Recovery UX And Smoke Base URL Hygiene.

Reason: the renderer is now covered by deterministic short and long fixture
smokes. The next useful increment is to reduce confusion from stale local
servers and make smoke base URL selection clearer.
