"use client";

import { Check, Copy, ExternalLink } from "lucide-react";
import { memo, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypePrism from "rehype-prism-plus";
import type { Components } from "react-markdown";
import type { PluggableList } from "unified";
import styles from "./MessageMarkdown.module.css";

type MessageMarkdownProps = {
  content: string;
  isStreaming?: boolean;
};

export const MessageMarkdown = memo(function MessageMarkdown({
  content,
  isStreaming = false
}: MessageMarkdownProps) {
  // During streaming, skip rehype-prism-plus to avoid flickering on incomplete code fences.
  // We still run remark-gfm so inline formatting like bold/italic renders progressively.
  const rehypePlugins = useMemo<PluggableList>(
    () => (isStreaming ? [] : [[rehypePrism, { ignoreMissing: true }]]),
    [isStreaming]
  );

  const components = useMemo<Components>(
    () => ({
      a({ children, href }) {
        return (
          <a href={safeHref(href)} rel="noreferrer" target="_blank">
            <span>{children}</span>
            <ExternalLink size={12} aria-hidden="true" />
          </a>
        );
      },
      code({ children, className, ...props }) {
        const raw = String(children ?? "").replace(/\n$/, "");
        const language = parseLanguage(className);
        const isBlock = Boolean(language) || raw.includes("\n");

        if (!isBlock) {
          return (
            <code className={styles.inlineCode} {...props}>
              {children}
            </code>
          );
        }

        return (
          <CodeBlock
            code={raw}
            isStreaming={isStreaming}
            language={language}
            prismChildren={children}
          />
        );
      },
      pre({ children }) {
        // react-markdown wraps <code> in <pre>; we handle the <pre> wrapper inside CodeBlock,
        // so just pass children through to avoid double-wrapping.
        return <>{children}</>;
      },
      table({ children }) {
        return (
          <div className={styles.tableScroller}>
            <table>{children}</table>
          </div>
        );
      }
    }),
    [isStreaming]
  );

  return (
    <div className={styles.markdown} data-streaming={isStreaming ? "true" : "false"}>
      <ReactMarkdown
        components={components}
        rehypePlugins={rehypePlugins}
        remarkPlugins={[remarkGfm]}
        skipHtml
      >
        {content}
      </ReactMarkdown>
    </div>
  );
});

export function CopyTextButton({
  className,
  label = "Copy",
  text
}: {
  className?: string;
  label?: string;
  text: string;
}) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    const ok = await copyText(text);
    if (!ok) {
      return;
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }

  return (
    <button
      aria-label={copied ? "Copied" : label}
      className={className ?? styles.copyButton}
      onClick={handleCopy}
      type="button"
    >
      {copied ? <Check size={13} aria-hidden="true" /> : <Copy size={13} aria-hidden="true" />}
      <span>{copied ? "Copied" : label}</span>
    </button>
  );
}

const CodeBlock = memo(function CodeBlock({
  code,
  isStreaming,
  language,
  prismChildren
}: {
  code: string;
  isStreaming: boolean;
  language: string;
  prismChildren: React.ReactNode;
}) {
  return (
    <figure className={styles.codeBlock}>
      <figcaption className={styles.codeHeader}>
        <span>{language || "text"}</span>
        <CopyTextButton className={styles.copyButton} label="Copy code" text={code} />
      </figcaption>
      <pre>
        {/* When streaming or no prism highlighting, fall back to plain text.
            When complete, prismChildren already contains highlighted spans from rehype-prism-plus. */}
        <code className={language ? `language-${language}` : undefined}>
          {isStreaming ? code : prismChildren}
        </code>
      </pre>
    </figure>
  );
});

async function copyText(text: string) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall back to a temporary textarea below.
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  const ok = document.execCommand("copy");
  document.body.removeChild(textarea);
  return ok;
}

function parseLanguage(className?: string) {
  return className?.match(/language-([\w-]+)/)?.[1]?.toLowerCase() ?? "";
}

function safeHref(href?: string) {
  if (!href) {
    return "#";
  }
  try {
    const url = new URL(href, "https://local.invalid");
    if (url.protocol === "http:" || url.protocol === "https:" || url.protocol === "mailto:") {
      return href;
    }
  } catch {
    return "#";
  }
  return "#";
}
