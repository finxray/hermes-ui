"use client";

import { Check, Copy, ExternalLink } from "lucide-react";
import { useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";
import styles from "./MessageMarkdown.module.css";

type MessageMarkdownProps = {
  content: string;
  isStreaming?: boolean;
};

export function MessageMarkdown({ content, isStreaming = false }: MessageMarkdownProps) {
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

        return <CodeBlock code={raw} isStreaming={isStreaming} language={language} />;
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
      <ReactMarkdown components={components} remarkPlugins={[remarkGfm]} skipHtml>
        {content}
      </ReactMarkdown>
    </div>
  );
}

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

function CodeBlock({
  code,
  isStreaming,
  language
}: {
  code: string;
  isStreaming: boolean;
  language: string;
}) {
  const lines = code.split("\n");
  return (
    <figure className={styles.codeBlock}>
      <figcaption className={styles.codeHeader}>
        <span>{language || "text"}</span>
        <CopyTextButton className={styles.copyButton} label="Copy code" text={code} />
      </figcaption>
      <pre>
        <code>
          {isStreaming || !language
            ? code
            : lines.map((line, index) => (
                <span className={styles.codeLine} key={`${index}-${line}`}>
                  {highlightLine(line, language)}
                  {index < lines.length - 1 ? "\n" : null}
                </span>
              ))}
        </code>
      </pre>
    </figure>
  );
}

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

function highlightLine(line: string, language: string) {
  const tokens = tokenizeLine(line, language);
  return tokens.map((token, index) => (
    <span className={styles[token.kind]} key={`${index}-${token.value}`}>
      {token.value}
    </span>
  ));
}

function tokenizeLine(line: string, language: string): Array<{ kind: TokenKind; value: string }> {
  const tokens: Array<{ kind: TokenKind; value: string }> = [];
  let index = 0;
  const commentStart = findCommentStart(line, language);

  while (index < line.length) {
    if (commentStart === index) {
      tokens.push({ kind: "tokenComment", value: line.slice(index) });
      break;
    }

    const char = line[index];
    if (char === "\"" || char === "'" || char === "`") {
      const end = findStringEnd(line, index, char);
      tokens.push({ kind: "tokenString", value: line.slice(index, end) });
      index = end;
      continue;
    }

    const rest = line.slice(index);
    const number = rest.match(/^\b\d+(?:\.\d+)?\b/);
    if (number) {
      tokens.push({ kind: "tokenNumber", value: number[0] });
      index += number[0].length;
      continue;
    }

    const word = rest.match(/^[A-Za-z_$][\w$-]*/);
    if (word) {
      tokens.push({
        kind: keywordSet(language).has(word[0]) ? "tokenKeyword" : "tokenPlain",
        value: word[0]
      });
      index += word[0].length;
      continue;
    }

    tokens.push({ kind: "tokenPlain", value: char });
    index += 1;
  }

  return tokens.length > 0 ? tokens : [{ kind: "tokenPlain", value: "" }];
}

type TokenKind = "tokenComment" | "tokenKeyword" | "tokenNumber" | "tokenPlain" | "tokenString";

function findCommentStart(line: string, language: string) {
  const markers = language === "python" || language === "py" || language === "bash" || language === "sh"
    ? ["#"]
    : ["//"];
  const positions = markers
    .map((marker) => line.indexOf(marker))
    .filter((position) => position >= 0);
  return positions.length > 0 ? Math.min(...positions) : -1;
}

function findStringEnd(line: string, start: number, quote: string) {
  for (let index = start + 1; index < line.length; index += 1) {
    if (line[index] === quote && line[index - 1] !== "\\") {
      return index + 1;
    }
  }
  return line.length;
}

function keywordSet(language: string) {
  if (language === "ts" || language === "tsx" || language === "js" || language === "jsx" || language === "javascript" || language === "typescript") {
    return new Set([
      "async",
      "await",
      "const",
      "else",
      "export",
      "false",
      "for",
      "from",
      "function",
      "if",
      "import",
      "let",
      "null",
      "return",
      "true",
      "type",
      "undefined"
    ]);
  }
  if (language === "python" || language === "py") {
    return new Set(["and", "as", "def", "else", "False", "for", "from", "if", "import", "in", "None", "return", "True"]);
  }
  if (language === "css") {
    return new Set(["align-items", "background", "border", "color", "display", "flex", "grid", "margin", "padding"]);
  }
  if (language === "json") {
    return new Set(["false", "null", "true"]);
  }
  return new Set(["false", "null", "true"]);
}
