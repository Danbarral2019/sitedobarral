'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import Link from 'next/link';
import type { ComponentPropsWithoutRef } from 'react';

interface ArticleAwareMarkdownProps {
  content: string;
}

/**
 * Regex patterns for article references in legal text.
 * Converts inline references like "Art. 75", "artigo 75-A", "arts. 75 e 76"
 * into clickable markdown links to /area-restrita/artigo/X.
 */
function linkifyArticleReferences(text: string): string {
  // Pattern 1: "Art." or "art." followed by number (with optional letter suffix like -A, -B)
  // e.g. "Art. 75", "art. 75-A", "Art. 184-A"
  // Avoid matching if already inside a markdown link [...](...)
  let result = text;

  // Pattern for "arts." / "Arts." with multiple article numbers separated by "e", "," or "a"
  // e.g. "arts. 75 e 76", "Arts. 75, 76 e 77", "arts. 75 a 80"
  result = result.replace(
    /(?<!\[)\b([Aa]rts?\.)\s*(\d+[\w-]*(?:\s*(?:,\s*|\s+e\s+|\s+a\s+)\d+[\w-]*)*)/g,
    (match, prefix, numbersStr) => {
      // Check if this is already inside a markdown link
      // by looking at surrounding context - if preceded by [ it's already a link
      const numbers = numbersStr.split(/\s*(?:,\s*|\s+e\s+|\s+a\s+)\s*/);
      if (numbers.length > 1) {
        const linked = numbers.map((num: string) => {
          const trimmed = num.trim();
          return `[Art. ${trimmed}](/area-restrita/artigo/${trimmed})`;
        });
        return linked.join(', ');
      }
      // Single article with "Art." prefix
      const num = numbers[0].trim();
      return `[${prefix} ${num}](/area-restrita/artigo/${num})`;
    }
  );

  // Pattern 2: "artigo" / "Artigo" / "artigos" / "Artigos" followed by number(s)
  // e.g. "artigo 75", "Artigos 75 e 76"
  result = result.replace(
    /(?<!\[)\b([Aa]rtigos?)\s+(\d+[\w-]*(?:\s*(?:,\s*|\s+e\s+|\s+a\s+)\d+[\w-]*)*)/g,
    (_match, prefix, numbersStr) => {
      const numbers = numbersStr.split(/\s*(?:,\s*|\s+e\s+|\s+a\s+)\s*/);
      if (numbers.length > 1) {
        const linked = numbers.map((num: string) => {
          const trimmed = num.trim();
          return `[Art. ${trimmed}](/area-restrita/artigo/${trimmed})`;
        });
        return linked.join(', ');
      }
      const num = numbers[0].trim();
      return `[${prefix} ${num}](/area-restrita/artigo/${num})`;
    }
  );

  return result;
}

export default function ArticleAwareMarkdown({ content }: ArticleAwareMarkdownProps) {
  const processedContent = linkifyArticleReferences(content);

  return (
    <div className="chat-markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Use Next.js Link for internal article links, regular <a> for external
          a: ({ href, children, ...props }: ComponentPropsWithoutRef<'a'>) => {
            if (href?.startsWith('/area-restrita/artigo/')) {
              return (
                <Link
                  href={href}
                  className="text-blue-700 font-medium hover:text-blue-900 hover:underline"
                >
                  {children}
                </Link>
              );
            }
            return (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
                {...props}
              >
                {children}
              </a>
            );
          },
          // Compact paragraphs for chat bubble
          p: ({ children, ...props }: ComponentPropsWithoutRef<'p'>) => (
            <p className="mb-2 last:mb-0 leading-relaxed" {...props}>{children}</p>
          ),
          // Compact lists
          ul: ({ children, ...props }: ComponentPropsWithoutRef<'ul'>) => (
            <ul className="mb-2 last:mb-0 pl-5 list-disc space-y-0.5" {...props}>{children}</ul>
          ),
          ol: ({ children, ...props }: ComponentPropsWithoutRef<'ol'>) => (
            <ol className="mb-2 last:mb-0 pl-5 list-decimal space-y-0.5" {...props}>{children}</ol>
          ),
          li: ({ children, ...props }: ComponentPropsWithoutRef<'li'>) => (
            <li className="leading-relaxed" {...props}>{children}</li>
          ),
          // Headings - compact for chat
          h1: ({ children, ...props }: ComponentPropsWithoutRef<'h1'>) => (
            <h3 className="font-bold text-base mt-3 mb-1" {...props}>{children}</h3>
          ),
          h2: ({ children, ...props }: ComponentPropsWithoutRef<'h2'>) => (
            <h4 className="font-bold text-sm mt-2 mb-1" {...props}>{children}</h4>
          ),
          h3: ({ children, ...props }: ComponentPropsWithoutRef<'h3'>) => (
            <h5 className="font-semibold text-sm mt-2 mb-1" {...props}>{children}</h5>
          ),
          // Code blocks
          pre: ({ children, ...props }: ComponentPropsWithoutRef<'pre'>) => (
            <pre className="bg-gray-800 text-gray-100 rounded-md p-3 my-2 overflow-x-auto text-xs" {...props}>
              {children}
            </pre>
          ),
          code: ({ children, className, ...props }: ComponentPropsWithoutRef<'code'>) => {
            // Inline code vs block code
            const isBlock = className?.includes('language-');
            if (isBlock) {
              return <code className={className} {...props}>{children}</code>;
            }
            return (
              <code className="bg-gray-200 text-gray-800 px-1.5 py-0.5 rounded text-xs" {...props}>
                {children}
              </code>
            );
          },
          // Blockquotes
          blockquote: ({ children, ...props }: ComponentPropsWithoutRef<'blockquote'>) => (
            <blockquote
              className="border-l-3 border-blue-400 pl-3 my-2 text-gray-700 italic"
              {...props}
            >
              {children}
            </blockquote>
          ),
          // Tables
          table: ({ children, ...props }: ComponentPropsWithoutRef<'table'>) => (
            <div className="overflow-x-auto my-2">
              <table className="min-w-full text-sm border-collapse" {...props}>{children}</table>
            </div>
          ),
          thead: ({ children, ...props }: ComponentPropsWithoutRef<'thead'>) => (
            <thead className="bg-gray-200" {...props}>{children}</thead>
          ),
          th: ({ children, ...props }: ComponentPropsWithoutRef<'th'>) => (
            <th className="px-2 py-1 text-left font-semibold border-b border-gray-300 text-xs" {...props}>
              {children}
            </th>
          ),
          td: ({ children, ...props }: ComponentPropsWithoutRef<'td'>) => (
            <td className="px-2 py-1 border-b border-gray-200 text-xs" {...props}>{children}</td>
          ),
          // Strong / emphasis
          strong: ({ children, ...props }: ComponentPropsWithoutRef<'strong'>) => (
            <strong className="font-bold" {...props}>{children}</strong>
          ),
          // Horizontal rule
          hr: (props: ComponentPropsWithoutRef<'hr'>) => (
            <hr className="my-3 border-gray-300" {...props} />
          ),
        }}
      >
        {processedContent}
      </ReactMarkdown>
    </div>
  );
}
