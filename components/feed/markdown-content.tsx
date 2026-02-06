"use client";

import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { oneLight } from "react-syntax-highlighter/dist/esm/styles/prism";
import { useTheme } from "next-themes";
import { memo } from "react";

const components: Components = {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  code({ className, children, ref, ...props }) {
    const match = /language-(\w+)/.exec(className || "");
    const codeString = String(children).replace(/\n$/, "");

    // Block code (inside <pre>)
    if (match) {
      return (
        <CodeBlock language={match[1]}>{codeString}</CodeBlock>
      );
    }

    // Check if this is a multi-line code block without language
    if (codeString.includes("\n")) {
      return <CodeBlock>{codeString}</CodeBlock>;
    }

    // Inline code
    return (
      <code
        className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.8125rem]"
        {...props}
      >
        {children}
      </code>
    );
  },
  pre({ children }) {
    // Just pass through - the code component handles rendering
    return <>{children}</>;
  },
  a({ href, children }) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-primary hover:underline"
      >
        {children}
      </a>
    );
  },
  blockquote({ children }) {
    return (
      <blockquote className="border-l-2 border-muted-foreground/30 pl-4 italic text-muted-foreground">
        {children}
      </blockquote>
    );
  },
  ul({ children }) {
    return <ul className="ml-4 list-disc space-y-1">{children}</ul>;
  },
  ol({ children }) {
    return <ol className="ml-4 list-decimal space-y-1">{children}</ol>;
  },
  p({ children }) {
    return <p className="my-2 first:mt-0 last:mb-0">{children}</p>;
  },
  h1({ children }) {
    return <p className="my-2 text-base font-bold">{children}</p>;
  },
  h2({ children }) {
    return <p className="my-2 text-base font-bold">{children}</p>;
  },
  h3({ children }) {
    return <p className="my-2 text-sm font-bold">{children}</p>;
  },
  h4({ children }) {
    return <p className="my-1 text-sm font-semibold">{children}</p>;
  },
  h5({ children }) {
    return <p className="my-1 text-sm font-semibold">{children}</p>;
  },
  h6({ children }) {
    return <p className="my-1 text-sm font-medium">{children}</p>;
  },
  img() {
    // Hide images in feed cards to keep them compact
    return null;
  },
};

function CodeBlock({
  language,
  children,
}: {
  language?: string;
  children: string;
}) {
  const { resolvedTheme } = useTheme();
  const theme = resolvedTheme === "dark" ? oneDark : oneLight;

  return (
    <div className="my-3 overflow-hidden rounded-lg">
      <SyntaxHighlighter
        style={theme}
        language={language || "text"}
        PreTag="div"
        customStyle={{
          margin: 0,
          padding: "1rem",
          fontSize: "0.8125rem",
          lineHeight: "1.5",
          borderRadius: "0.5rem",
        }}
      >
        {children}
      </SyntaxHighlighter>
    </div>
  );
}

function MarkdownContentInner({ content }: { content: string }) {
  return (
    <div className="article-content">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
}

export const MarkdownContent = memo(MarkdownContentInner);
