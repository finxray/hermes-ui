# Markdown Fixture Smoke 14E

Date: 2026-05-31

## Purpose

Slice 14E adds deterministic fixture coverage for the rich assistant response
renderer introduced in Slice 14D. The fixture lets browser smoke verify markdown
rendering without depending on a live model response.

This is test, fixture, and harness work only. It does not call Hermes, Brain
Memory, localStorage, storage backends, or external services.

## Files Changed

- `apps/web/src/data/markdownFixture.ts`
- `apps/web/src/app/design/markdown-fixture/page.tsx`
- `apps/web/src/app/design/markdown-fixture/page.module.css`
- `scripts/markdown-fixture-smoke.mjs`
- `scripts/check-message-rendering.mjs`
- `scripts/check-ui-structure.mjs`
- `package.json`
- `docs/design/MARKDOWN_FIXTURE_SMOKE_14E.md`
- `docs/design/RICH_RESPONSE_RENDERER_14D.md`
- `ROADMAP.md`

## Fixture Cases

The deterministic fixture covers:

- heading;
- paragraph;
- bold and italic emphasis;
- unordered list;
- ordered list;
- checked and unchecked task list items;
- blockquote;
- GFM table;
- inline code;
- fenced TypeScript code block;
- fenced bash code block;
- safe external link;
- raw HTML sentinel;
- partial/incomplete streaming code fence.

## Design Route

Route:

```text
/design/markdown-fixture
```

The route renders:

- a complete assistant `MessageBubble` with the rich markdown fixture;
- a streaming-mode `MessageMarkdown` with a partial code fence;
- no app shell state;
- no Hermes calls;
- no Brain Memory calls;
- no localStorage writes.

The route is intentionally design/test-only and is not linked from production
navigation.

## Browser Smoke

Command:

```powershell
npm run smoke:markdown
```

The smoke checks:

- fixture route loads;
- markdown fixture region is visible;
- heading, paragraph text, lists, task list, blockquote, table, inline code,
  TypeScript code block, and bash code block render;
- code copy buttons are present;
- full-message copy button is present;
- safe markdown link uses `target="_blank"` and `rel="noreferrer"`;
- raw HTML does not create an actual DOM element;
- partial markdown fixture renders without crashing;
- no horizontal overflow;
- no serious browser console, page, or network errors.

If the default `http://127.0.0.1:3000` server predates the new route, the smoke
can discover the route on another local port in `3000` through `3007`. This is
for local stale-server recovery only; the canonical route remains `/design/markdown-fixture`.

## Copy Behavior

The smoke verifies that code copy and full-message copy buttons exist and are
accessible. It attempts to click them and treats copied-state feedback as a
warning when the current browser context does not expose clipboard feedback.

This avoids making the smoke flaky across Edge/Chromium clipboard permission
differences while still protecting the UI affordances.

## Source-Level Checks

`npm run check-message-rendering` now also verifies:

- fixture file exists;
- fixture route exists;
- fixture contains each required markdown case;
- fixture route renders both complete and partial examples;
- markdown smoke targets the fixture route;
- smoke checks copy buttons, safe links, and raw HTML safety.

The existing checks still verify:

- `react-markdown`;
- `remark-gfm`;
- `skipHtml`;
- no `dangerouslySetInnerHTML`;
- safe link helper/attributes;
- code block component;
- copy handler;
- streaming highlight skip path.

## Safety Checks

Raw HTML in the fixture is intentionally inert:

```html
<button id="raw-html-fixture">RAW_HTML_SHOULD_NOT_RENDER</button>
```

The browser smoke verifies that no `#raw-html-fixture` element is created. If
the sentinel text appears, it is treated as inert text rather than executable or
interactive HTML.

## Limitations

- This is a smoke test, not pixel-by-pixel visual regression.
- Clipboard copied-state feedback can be browser-context dependent and may warn
  even when buttons are present.
- The fixture is not exposed in production navigation.
- It does not test model-generated markdown.

## Next Recommended Slice

Slice 14F - Message Renderer Polish And Long Transcript Performance Budget.

Reason: Slice 14E protects the renderer contract. The next useful increment is
to tune small rendering polish and establish transcript size/performance
budgets before adding heavier visual regression or virtualization.
