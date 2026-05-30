import { MessageBubble } from "@/components/chat/MessageBubble";
import { MessageMarkdown } from "@/components/chat/MessageMarkdown";
import { longMarkdownFixture, longPartialMarkdownFixture } from "@/data/longMarkdownFixture";
import styles from "./page.module.css";

const assistantMessages = [
  {
    author: "Hermes",
    content: longMarkdownFixture,
    createdAt: "14:45",
    id: "markdown-long-fixture-assistant-1",
    references: ["long fixture", "renderer budget"],
    role: "assistant" as const,
    status: "complete" as const
  },
  {
    author: "Hermes",
    content:
      "## Follow-up Summary\n\nThe second assistant message protects repeated transcript rendering and copy actions without using live services.\n\n```typescript\nexport const repeatedMessage = true;\n```",
    createdAt: "14:46",
    id: "markdown-long-fixture-assistant-2",
    references: ["memoized bubble", "copy action"],
    role: "assistant" as const,
    status: "complete" as const
  }
];

export default function MarkdownLongFixturePage() {
  return (
    <main className={styles.page} aria-label="Long markdown fixture page">
      <section className={styles.header} aria-labelledby="markdown-long-fixture-title">
        <p>Performance fixture</p>
        <h1 id="markdown-long-fixture-title">Long markdown renderer fixture</h1>
        <span>
          Deterministic route for long assistant responses. It does not call Hermes, Brain
          Memory, localStorage, storage, or external services.
        </span>
      </section>

      <section className={styles.fixture} aria-label="Long markdown fixture">
        {assistantMessages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}
      </section>

      <section className={styles.partial} aria-label="Long partial markdown fixture">
        <header>
          <h2>Long partial stream fixture</h2>
          <p>Uses the same renderer with streaming mode enabled.</p>
        </header>
        <MessageMarkdown content={longPartialMarkdownFixture} isStreaming />
      </section>
    </main>
  );
}
