import { MessageBubble } from "@/components/chat/MessageBubble";
import { MessageMarkdown } from "@/components/chat/MessageMarkdown";
import { partialMarkdownFixture, richMarkdownFixture } from "@/data/markdownFixture";
import styles from "./page.module.css";

export default function MarkdownFixturePage() {
  return (
    <main className={styles.page} aria-label="Markdown fixture page">
      <section className={styles.header} aria-labelledby="markdown-fixture-title">
        <p>Design fixture</p>
        <h1 id="markdown-fixture-title">Markdown response renderer fixture</h1>
        <span>
          Deterministic route for rich assistant response rendering. No Hermes, Brain Memory,
          localStorage, or external service calls are made here.
        </span>
      </section>

      <section className={styles.fixture} aria-label="Markdown fixture">
        <MessageBubble
          message={{
            author: "Hermes",
            content: richMarkdownFixture,
            createdAt: "14:14",
            id: "markdown-fixture-assistant",
            references: ["deterministic fixture", "no service calls"],
            role: "assistant",
            status: "complete"
          }}
        />
      </section>

      <section className={styles.partial} aria-label="Partial markdown fixture">
        <header>
          <h2>Partial stream fixture</h2>
          <p>Uses the same renderer with streaming mode enabled.</p>
        </header>
        <MessageMarkdown content={partialMarkdownFixture} isStreaming />
      </section>
    </main>
  );
}
