"use client";

import { Check, Copy, ExternalLink, type LucideIcon } from "lucide-react";
import { memo, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypePrism from "rehype-prism-plus";
import type { Components } from "react-markdown";
import type { PluggableList } from "unified";
import { StatusCheckIcon } from "@/components/ui/StatusCheckIcon";
import styles from "./MessageMarkdown.module.css";

const CHECK_SENTINEL = "__check__";

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
          if (isCheckSentinel(raw)) {
            return <StatusCheckIcon className={styles.statusCheckInline} />;
          }

          return (
            <code className={inlineCodeClassName(raw)} {...props}>
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
      },
      input({ checked, disabled, type, ...props }) {
        if (type !== "checkbox") {
          return <input {...props} checked={checked} disabled={disabled} type={type} />;
        }

        const nativeCheckbox = (
          <input
            {...props}
            aria-hidden="true"
            checked={Boolean(checked)}
            className={styles.taskCheckNative}
            disabled={disabled}
            readOnly
            tabIndex={-1}
            type="checkbox"
          />
        );

        if (!checked) {
          return (
            <>
              {nativeCheckbox}
              <span className={styles.taskCheckTodo} aria-hidden="true" />
            </>
          );
        }

        return (
          <>
            {nativeCheckbox}
            <StatusCheckIcon className={styles.statusCheckList} />
          </>
        );
      }
    }),
    [isStreaming]
  );

  const preparedContent = useMemo(() => prepareMarkdownContent(content), [content]);

  return (
    <div className={styles.markdown} data-streaming={isStreaming ? "true" : "false"}>
      <ReactMarkdown
        components={components}
        rehypePlugins={rehypePlugins}
        remarkPlugins={[remarkGfm]}
        skipHtml
      >
        {preparedContent}
      </ReactMarkdown>
    </div>
  );
});

export function CopyTextButton({
  className,
  icon: Icon = Copy,
  label = "Copy",
  text,
  variant = "icon"
}: {
  className?: string;
  icon?: LucideIcon;
  label?: string;
  text: string;
  variant?: "icon" | "pill";
}) {
  const [copied, setCopied] = useState(false);
  const buttonClassName = className ?? styles.iconActionButton;
  const DisplayIcon = copied ? Check : Icon;

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
      className={buttonClassName}
      data-copy-action="true"
      onClick={handleCopy}
      title={copied ? "Copied" : label}
      type="button"
    >
      <DisplayIcon aria-hidden="true" />
      {variant === "pill" ? <span>{copied ? "Copied" : label}</span> : null}
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
        <CopyTextButton label="Copy code" text={code} variant="icon" />
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

const HTTP_METHOD_PATTERN = "(?:GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS|TRACE|CONNECT)";
const HTTP_PATH_PATTERN = "(\\/[^\\s`<>]+)";

function inlineCodeClassName(value: string) {
  const text = value.trim();
  if (isHttpEndpointCode(text)) {
    return styles.inlineCodeEndpoint;
  }
  return styles.inlineCode;
}

function isCheckSentinel(value: string) {
  const text = value.trim();
  return text === CHECK_SENTINEL || text === "✓" || text === "✔";
}

function isHttpEndpointCode(text: string) {
  return (
    new RegExp(`^${HTTP_METHOD_PATTERN}\\s+${HTTP_PATH_PATTERN}$`, "i").test(text) ||
    new RegExp(`^${HTTP_PATH_PATTERN}$`).test(text) ||
    new RegExp(`^${HTTP_METHOD_PATTERN}$`, "i").test(text)
  );
}

function joinHttpMethodPaths(content: string) {
  const methodPath = new RegExp(
    `\`(${HTTP_METHOD_PATTERN})\`\\s*(?:\\n\\s*)?\`?(${HTTP_PATH_PATTERN})\`?`,
    "gi"
  );
  const plainLineBreak = new RegExp(`\\b(${HTTP_METHOD_PATTERN})\\s*\\n\\s*(${HTTP_PATH_PATTERN})`, "gi");

  return content
    .replace(methodPath, (_match, method, path) => `\`${method} ${path}\``)
    .replace(plainLineBreak, (_match, method, path) => `\`${method} ${path}\``);
}

const LEADING_CHECK_LINE_PATTERN = /^(\s*)(?:[-*+]\s+)?[✓✔✅]\s+(.*)$/;

function prepareMarkdownContent(content: string) {
  return joinHttpMethodPaths(
    content
      .split("\n")
      .map((line) => {
        const leadingCheck = line.match(LEADING_CHECK_LINE_PATTERN);
        if (leadingCheck) {
          return `${leadingCheck[1]}- [x] ${leadingCheck[2]}`;
        }
        return normalizeInlineStatusChecks(line);
      })
      .join("\n")
  );
}

function normalizeInlineStatusChecks(line: string) {
  return line
    .replace(/✅\s*/g, `\`${CHECK_SENTINEL}\` `)
    .replace(/([—–])\s*[✓✔]\s*/g, `$1 \`${CHECK_SENTINEL}\` `)
    .replace(/(\S)\s+[✓✔](?=\s)/g, `$1 \`${CHECK_SENTINEL}\``);
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
