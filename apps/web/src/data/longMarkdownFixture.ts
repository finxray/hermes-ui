const longCodeLine =
  "const veryLongProviderTraceLine = \"cerebras/kimi-fast-stream delta batch with a deliberately long diagnostic payload that must stay inside the code scroller instead of widening the page layout\";";

const listItems = Array.from({ length: 18 }, (_, index) =>
  `- Budget item ${index + 1}: keep markdown rendering deterministic, bounded, and safe during transcript growth.`
).join("\n");

const orderedItems = Array.from({ length: 12 }, (_, index) =>
  `${index + 1}. Verify render case ${index + 1} without depending on live Hermes output.`
).join("\n");

export const longMarkdownFixture = `# Long Markdown Fixture Response

This deterministic assistant answer represents a large but realistic Studio
response. It includes long lists, repeated code blocks, a wide table, long links,
and raw HTML that must remain inert.

## Long Unordered List

${listItems}

## Long Ordered List

${orderedItems}

## Nested Quote

> Brain Memory remains read-only from this surface.
>
> > Nested context should wrap naturally and never force horizontal page scroll.

## Wide Table

| Surface | Owner | Status | Budget | Notes | Future Fast Provider Concern |
| --- | --- | --- | --- | --- | --- |
| Markdown parsing | Web UI renderer | active | rAF-batched streaming updates | parse only visible assistant content | avoid per-token heavyweight work |
| Code highlighting | MessageMarkdown | bounded | skip while streaming | lightweight spans after completion | avoid re-tokenizing unchanged blocks |
| Tables | MessageMarkdown CSS | active | internal horizontal scroll | page width must stay stable | wide provider traces stay contained |
| Transcript | ChatTranscript | monitored | memoized rows | virtualization deferred | revisit after measured large sessions |

## TypeScript Block

\`\`\`typescript
type RenderBudget = {
  maxCodeBlockHeight: string;
  skipHighlightingWhileStreaming: boolean;
  virtualizeAfterMeasuredNeed: boolean;
};

const budget: RenderBudget = {
  maxCodeBlockHeight: "min(56vh, 520px)",
  skipHighlightingWhileStreaming: true,
  virtualizeAfterMeasuredNeed: false
};

${longCodeLine}

export function summarizeBudget(label: string) {
  return [label, budget.maxCodeBlockHeight, String(budget.skipHighlightingWhileStreaming)].join(" | ");
}
\`\`\`

## Bash Block

\`\`\`bash
npm run check-message-rendering
npm run smoke:markdown
npm run smoke:markdown:long
printf '%s\\n' 'long markdown fixture completed'
\`\`\`

## JSON Block

\`\`\`json
{
  "route": "/design/markdown-long-fixture",
  "callsHermes": false,
  "callsBrainMemory": false,
  "rawHtmlExecutes": false
}
\`\`\`

Safe links:
[Hermes UI docs](https://example.com/hermes-ui/docs),
[Brain Memory Gateway notes](https://example.com/brain-memory/gateway),
and [mailto check](mailto:studio@example.com).

Long inline code should wrap safely:
\`studio-renderer-long-inline-code-token-with-many-segments-and-no-natural-breakpoints-0123456789abcdefghijklmnopqrstuvwxyz\`.

<button id="long-raw-html-fixture">LONG_RAW_HTML_SHOULD_NOT_RENDER</button>

End of long deterministic fixture.`;

export const longPartialMarkdownFixture = `## Long Streaming Partial

This partial response simulates a high-throughput provider still writing a code fence.

\`\`\`typescript
export const partialLongFixture = "still streaming through rAF batching";
for (const chunk of ["fast", "safe", "bounded"]) {
  console.log(chunk)
`;
