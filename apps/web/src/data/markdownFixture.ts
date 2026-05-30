export const richMarkdownFixture = `# Markdown Fixture Response

This deterministic assistant response covers **bold emphasis**, _italic nuance_, and a
safe [Hermes UI link](https://example.com/hermes-ui) for browser smoke.

## Structured Lists

- Keep Hermes as the runtime.
- Keep Brain Memory Gateway as the memory authority.
- Render \`inline code\` without breaking line height.

1. Parse markdown safely.
2. Render code blocks clearly.
3. Keep copy actions accessible.

- [x] Render a checked task item.
- [ ] Render an unchecked task item.

> Brain Memory inspection remains read-only and Gateway-mediated.

| Surface | Status | Notes |
| --- | --- | --- |
| Markdown | active | GFM table smoke |
| Code | active | copy buttons |

\`\`\`typescript
type FixtureResult = {
  ok: boolean;
  label: string;
};

export function formatFixture(result: FixtureResult) {
  return result.ok ? \`Fixture: \${result.label}\` : "Fixture failed";
}
\`\`\`

\`\`\`bash
echo "markdown fixture smoke"
npm run check-message-rendering
\`\`\`

<button id="raw-html-fixture">RAW_HTML_SHOULD_NOT_RENDER</button>

---

End of deterministic fixture.`;

export const partialMarkdownFixture = `## Streaming Partial Fixture

This message simulates an incomplete stream with a partial fenced code block.

\`\`\`typescript
export const partial = "still streaming";
if (partial) {
  console.log(partial)
`;
