import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const failures = [];

const files = {
  markdown: "apps/web/src/components/chat/MessageMarkdown.tsx",
  markdownCss: "apps/web/src/components/chat/MessageMarkdown.module.css",
  fixture: "apps/web/src/data/markdownFixture.ts",
  fixtureRoute: "apps/web/src/app/design/markdown-fixture/page.tsx",
  longFixture: "apps/web/src/data/longMarkdownFixture.ts",
  longFixtureRoute: "apps/web/src/app/design/markdown-long-fixture/page.tsx",
  bubble: "apps/web/src/components/chat/MessageBubble.tsx",
  bubbleCss: "apps/web/src/components/chat/MessageBubble.module.css",
  markdownSmoke: "scripts/markdown-fixture-smoke.mjs",
  longMarkdownSmoke: "scripts/markdown-long-fixture-smoke.mjs",
  smokeBaseUrl: "scripts/smoke-base-url.mjs",
  packageJson: "apps/web/package.json",
  rootPackageJson: "package.json"
};

for (const [name, path] of Object.entries(files)) {
  if (!existsSync(join(root, path))) {
    failures.push(`Missing ${name}: ${path}`);
  }
}

const markdown = read(files.markdown);
const markdownCss = read(files.markdownCss);
const fixture = read(files.fixture);
const fixtureRoute = read(files.fixtureRoute);
const longFixture = read(files.longFixture);
const longFixtureRoute = read(files.longFixtureRoute);
const bubble = read(files.bubble);
const bubbleCss = read(files.bubbleCss);
const markdownSmoke = read(files.markdownSmoke);
const longMarkdownSmoke = read(files.longMarkdownSmoke);
const smokeBaseUrl = read(files.smokeBaseUrl);
const packageJson = JSON.parse(read(files.packageJson) || "{}");
const rootPackageJson = JSON.parse(read(files.rootPackageJson) || "{}");

expect(markdown.includes("ReactMarkdown"), "MessageMarkdown uses ReactMarkdown.");
expect(markdown.includes("remarkGfm"), "MessageMarkdown enables remark-gfm.");
expect(markdown.includes("skipHtml"), "MessageMarkdown skips raw HTML.");
expect(!markdown.includes("dangerouslySetInnerHTML"), "MessageMarkdown does not use dangerouslySetInnerHTML.");
expect(markdown.includes('rel="noreferrer"'), "Links use rel=noreferrer.");
expect(markdown.includes('target="_blank"'), "Links open externally.");
expect(markdown.includes("safeHref"), "Links pass through a safe href helper.");
expect(markdown.includes("CopyTextButton"), "Shared copy button exists.");
expect(markdown.includes("navigator.clipboard") && markdown.includes("execCommand(\"copy\")"), "Copy handler has Clipboard API and fallback paths.");
expect(markdown.includes("CodeBlock"), "Fenced code blocks use a dedicated CodeBlock component.");
expect(markdown.includes("memo(function MessageMarkdown") && markdown.includes("memo(function CodeBlock"), "Markdown renderer and code blocks are memoized.");
expect(markdown.includes("useMemo") && markdown.includes("rehypePrism"), "Completed code block highlighting uses rehype-prism-plus, memoized by streaming state.");
expect(markdown.includes("ignoreMissing"), "rehype-prism-plus is configured with ignoreMissing to tolerate partial/unknown languages.");
expect(markdown.includes("isStreaming ? code : prismChildren"), "Streaming code blocks skip prism highlighting and fall back to plain text.");
expect(markdown.includes("tableScroller"), "GFM tables are wrapped for horizontal scrolling.");
expect(markdown.includes("inlineCodeClassName"), "Inline code uses semantic coloring instead of boxed outlines.");
expect(markdown.includes("joinHttpMethodPaths"), "HTTP method and path inline code are joined onto one line.");
expect(markdownCss.includes(".inlineCode") && markdownCss.includes("--markdown-inline-code"), "Inline code uses a global Apple-like blue token.");
expect(markdown.includes("StatusCheckIcon") && markdown.includes("CHECK_SENTINEL"), "Status checks use one shared green tick icon.");
expect(markdown.includes("LEADING_CHECK_LINE_PATTERN") && markdown.includes("normalizeInlineStatusChecks"), "Leading check lines normalize to task items; inline checks stay mid-line.");
expect(!markdownCss.includes("padding-left: 0"), "Task lists keep the same left indent as regular lists.");
expect(markdownCss.includes(".codeBlock") && markdownCss.includes(".iconActionButton"), "Code block and icon action button styles exist.");
expect(markdownCss.includes("overflow-x: auto"), "Long code/table content can scroll horizontally.");
expect(markdownCss.includes("overflow-y: auto") && markdownCss.includes("max-height: min(56vh, 520px)"), "Long code blocks have bounded vertical scrolling.");
expect(markdownCss.includes("overflow-wrap: break-word"), "Long links and inline content can wrap inside message bounds.");
expect(bubbleCss.includes(".iconActionButton") || markdownCss.includes(".iconActionButton"), "Message actions use icon-only controls.");
expect(markdownCss.includes(".token.keyword") && markdownCss.includes(".token.string"), "Prism syntax token styles exist for keywords and strings.");
expect(bubble.includes("memo(function MessageBubble"), "MessageBubble is memoized for unchanged transcript rows.");
expect(bubble.includes("<MessageMarkdown") && bubble.includes('message.role === "assistant"'), "Assistant messages render through MessageMarkdown.");
expect(bubble.includes("CopyTextButton") && bubble.includes("Copy message"), "Assistant message-level copy action is present.");
expect(bubble.includes("userBubble") && bubble.includes("messageFooter"), "Messages use a hover footer row for timestamp and actions.");
expect(!bubble.includes("styles.author") && !bubble.includes('<span className={styles.author}'), "Assistant responses do not render a visible author header.");
expect(bubble.includes("Pencil"), "User hover footer includes an edit action placeholder.");
expect(bubble.includes(".split(\"\\n\")"), "User messages keep simple newline-preserving rendering.");
expect(!bubble.includes("referenceRow"), "Message bubbles do not render retrieval reference chips under assistant text.");
expect(Boolean(packageJson.dependencies?.["react-markdown"]), "react-markdown dependency is declared.");
expect(Boolean(packageJson.dependencies?.["remark-gfm"]), "remark-gfm dependency is declared.");
expect(fixture.includes("# Markdown Fixture Response"), "Fixture includes heading markdown.");
expect(fixture.includes("**bold emphasis**") && fixture.includes("_italic nuance_"), "Fixture includes bold and italic markdown.");
expect(fixture.includes("- Keep Hermes as the runtime.") && fixture.includes("1. Parse markdown safely."), "Fixture includes unordered and ordered lists.");
expect(fixture.includes("- [x]") && fixture.includes("- [ ]"), "Fixture includes checked and unchecked task list items.");
expect(fixture.includes("> Brain Memory inspection"), "Fixture includes blockquote markdown.");
expect(fixture.includes("| Surface | Status | Notes |"), "Fixture includes GFM table markdown.");
expect(fixture.includes("\\`inline code\\`"), "Fixture includes inline code markdown.");
expect(fixture.includes("\\`\\`\\`typescript") && fixture.includes("\\`\\`\\`bash"), "Fixture includes TypeScript and bash fenced code blocks.");
expect(fixture.includes("[Hermes UI link](https://example.com/hermes-ui)"), "Fixture includes a safe link.");
expect(fixture.includes("RAW_HTML_SHOULD_NOT_RENDER"), "Fixture includes raw HTML sentinel.");
expect(fixture.includes("partialMarkdownFixture") && fixture.includes("\\`\\`\\`typescript"), "Fixture includes partial markdown/code fence content.");
expect(fixtureRoute.includes("/design/markdown-fixture") || fixtureRoute.includes("MarkdownFixturePage"), "Markdown fixture route exists.");
expect(fixtureRoute.includes("aria-label=\"Markdown fixture\""), "Markdown fixture route exposes a fixture region label.");
expect(fixtureRoute.includes("<MessageBubble") && fixtureRoute.includes("<MessageMarkdown"), "Fixture route renders complete and partial markdown examples.");
expect(markdownSmoke.includes("/design/markdown-fixture"), "Markdown browser smoke targets the fixture route.");
expect(markdownSmoke.includes("preflightStaticChunks") && markdownSmoke.includes("selectedBaseUrl"), "Markdown browser smoke uses selected base URL and static preflight.");
expect(markdownSmoke.includes("Copy code") && markdownSmoke.includes("Copy message"), "Markdown browser smoke checks copy buttons.");
expect(markdownSmoke.includes("raw-html-fixture") && markdownSmoke.includes("RAW_HTML_SHOULD_NOT_RENDER"), "Markdown browser smoke checks raw HTML safety.");
expect(markdownSmoke.includes("target") && markdownSmoke.includes("noreferrer"), "Markdown browser smoke checks safe link attributes.");
expect(longFixture.includes("# Long Markdown Fixture Response"), "Long fixture includes a heading.");
expect(longFixture.includes("Array.from({ length: 18") && longFixture.includes("Array.from({ length: 12"), "Long fixture includes long unordered and ordered lists.");
expect(longFixture.includes("Future Fast Provider Concern"), "Long fixture includes a wide table.");
expect(longFixture.includes("veryLongProviderTraceLine"), "Long fixture includes a long code line.");
expect(longFixture.includes("\\`\\`\\`typescript") && longFixture.includes("\\`\\`\\`bash") && longFixture.includes("\\`\\`\\`json"), "Long fixture includes multiple fenced code blocks.");
expect(longFixture.includes("LONG_RAW_HTML_SHOULD_NOT_RENDER"), "Long fixture includes raw HTML sentinel.");
expect(longFixture.includes("longPartialMarkdownFixture") && longFixture.includes("partialLongFixture"), "Long fixture includes partial streaming markdown.");
expect(longFixtureRoute.includes("MarkdownLongFixturePage"), "Long markdown fixture route exists.");
expect(longFixtureRoute.includes("aria-label=\"Long markdown fixture\""), "Long markdown fixture route exposes a fixture region label.");
expect(longFixtureRoute.includes("<MessageBubble") && longFixtureRoute.includes("<MessageMarkdown"), "Long fixture route renders complete and partial markdown examples.");
expect(longMarkdownSmoke.includes("/design/markdown-long-fixture"), "Long markdown browser smoke targets the long fixture route.");
expect(longMarkdownSmoke.includes("preflightStaticChunks") && longMarkdownSmoke.includes("selectedBaseUrl"), "Long markdown browser smoke uses selected base URL and static preflight.");
expect(longMarkdownSmoke.includes("maxHeight") && longMarkdownSmoke.includes("overflowY"), "Long markdown browser smoke checks bounded code scrolling.");
expect(longMarkdownSmoke.includes("fixture-table-scroller"), "Long markdown browser smoke checks table overflow wrapper.");
expect(longMarkdownSmoke.includes("long-raw-html-fixture") && longMarkdownSmoke.includes("LONG_RAW_HTML_SHOULD_NOT_RENDER"), "Long markdown browser smoke checks raw HTML safety.");
expect(smokeBaseUrl.includes("DEFAULT_BASE_URL") && smokeBaseUrl.includes("preflightStaticChunks"), "Shared smoke base URL helper exposes default and static preflight.");
expect(rootPackageJson.scripts?.["smoke:markdown:long"] === "node scripts/markdown-long-fixture-smoke.mjs", "Root package exposes smoke:markdown:long.");

if (failures.length > 0) {
  console.error("Message rendering checks failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("Message rendering checks passed.");

function read(path) {
  try {
    return readFileSync(join(root, path), "utf8");
  } catch {
    return "";
  }
}

function expect(ok, message) {
  if (!ok) {
    failures.push(message);
  }
}
