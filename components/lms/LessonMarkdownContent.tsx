'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { ComponentPropsWithoutRef } from 'react';

interface LessonMarkdownContentProps {
 content: string;
}

/**
 * Converts inline article references like "Art. 75", "artigo 75-A", "arts. 75 e 76"
 * into clickable markdown links to /area-restrita/artigo/X.
 */
function linkifyArticleReferences(text: string): string {
 let result = text;

 // Pattern for "arts." / "Arts." with multiple article numbers separated by "e", "," or "a"
 result = result.replace(
 /(?<!\[)\b([Aa]rts?\.)\s*(\d+[\w-]*(?:\s*(?:,\s*|\s+e\s+|\s+a\s+)\d+[\w-]*)*)/g,
 (match, prefix, numbersStr) => {
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

 // Pattern for "artigo" / "Artigo" / "artigos" / "Artigos" followed by number(s)
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

/**
 * Strip any residual [[wikilinks]] to plain text.
 * [[display|alias]] -> alias
 * [[target]] -> target
 */
function stripResidualWikilinks(text: string): string {
 return text
 .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2')
 .replace(/\[\[([^\]]+)\]\]/g, '$1');
}

function processContent(text: string): string {
 let result = stripResidualWikilinks(text);
 result = linkifyArticleReferences(result);
 return result;
}

export default function LessonMarkdownContent({ content }: LessonMarkdownContentProps) {
 const processedContent = processContent(content);

 return (
 <div className="lesson-markdown-content">
 <style jsx>{`
 .lesson-markdown-content {
 font-size: 1rem;
 line-height: 1.75;
 color: #374151;
 max-width: 100%;
 }

 .lesson-markdown-content :global(h1) {
 font-size: 1.75rem;
 font-weight: 700;
 color: #1E40AF;
 margin-top: 3rem;
 margin-bottom: 1.25rem;
 padding-bottom: 0;
 border-bottom: none;
 line-height: 1.4;
 }

 .lesson-markdown-content :global(h2) {
 font-size: 1.5rem;
 font-weight: 700;
 color: #1E40AF;
 margin-top: 2.5rem;
 margin-bottom: 1rem;
 line-height: 1.4;
 }

 .lesson-markdown-content :global(h3) {
 font-size: 1.25rem;
 font-weight: 700;
 color: #1E3A8A;
 margin-top: 2rem;
 margin-bottom: 0.75rem;
 line-height: 1.4;
 }

 .lesson-markdown-content :global(h4) {
 font-size: 1.125rem;
 font-weight: 600;
 color: #374151;
 margin-top: 1.5rem;
 margin-bottom: 0.5rem;
 line-height: 1.5;
 }

 .lesson-markdown-content :global(p) {
 text-align: justify;
 text-justify: inter-word;
 margin-bottom: 1.25rem;
 line-height: 1.75;
 color: #374151;
 hyphens: auto;
 }

 .lesson-markdown-content :global(blockquote) {
 margin: 2rem 0;
 margin-left: 1.5rem;
 margin-right: 0.75rem;
 padding: 1.25rem 1.5rem;
 border-left: 6px solid #3B82F6;
 background: linear-gradient(to right, #EFF6FF, #DBEAFE);
 border-radius: 0 0.75rem 0.75rem 0;
 font-style: italic;
 color: #1E3A8A;
 box-shadow: 0 2px 8px rgba(59, 130, 246, 0.1);
 }

 .lesson-markdown-content :global(blockquote p) {
 margin-bottom: 0.75rem;
 }

 .lesson-markdown-content :global(blockquote p:last-child) {
 margin-bottom: 0;
 }

 .lesson-markdown-content :global(ul),
 .lesson-markdown-content :global(ol) {
 margin: 1.5rem 0;
 padding-left: 2rem;
 }

 .lesson-markdown-content :global(li) {
 margin-bottom: 0.75rem;
 line-height: 1.8;
 color: #374151;
 }

 .lesson-markdown-content :global(li p) {
 margin-bottom: 0.5rem;
 }

 .lesson-markdown-content :global(strong) {
 font-weight: 700;
 color: #111827;
 }

 .lesson-markdown-content :global(em) {
 font-style: italic;
 color: #4B5563;
 }

 .lesson-markdown-content :global(a) {
 color: #2563EB;
 text-decoration: none;
 font-weight: 500;
 border-bottom: 1px solid transparent;
 transition: all 0.2s;
 }

 .lesson-markdown-content :global(a:hover) {
 color: #1D4ED8;
 border-bottom-color: #1D4ED8;
 }

 .lesson-markdown-content :global(code) {
 background: #F3F4F6;
 color: #1F2937;
 padding: 0.25rem 0.5rem;
 border-radius: 0.375rem;
 font-size: 0.9em;
 font-family: 'Courier New', monospace;
 border: 1px solid #E5E7EB;
 }

 .lesson-markdown-content :global(pre) {
 background: #1F2937;
 color: #F9FAFB;
 padding: 1.25rem;
 border-radius: 0.75rem;
 overflow-x: auto;
 margin: 1.5rem 0;
 box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
 }

 .lesson-markdown-content :global(pre code) {
 background: transparent;
 color: inherit;
 padding: 0;
 border: none;
 font-size: 0.9rem;
 }

 .lesson-markdown-content :global(table) {
 width: 100%;
 border-collapse: collapse;
 margin: 1.5rem 0;
 box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
 }

 .lesson-markdown-content :global(thead) {
 background: #F3F4F6;
 }

 .lesson-markdown-content :global(th) {
 padding: 0.75rem 1rem;
 text-align: left;
 font-weight: 700;
 color: #111827;
 border-bottom: 2px solid #D1D5DB;
 }

 .lesson-markdown-content :global(td) {
 padding: 0.75rem 1rem;
 border-bottom: 1px solid #E5E7EB;
 color: #374151;
 }

 .lesson-markdown-content :global(hr) {
 border: none;
 border-top: 3px double #D1D5DB;
 margin: 3rem 0 1.5rem 0;
 }

 .lesson-markdown-content :global(img) {
 max-width: 100%;
 height: auto;
 border-radius: 0.75rem;
 box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
 margin: 1.5rem auto;
 display: block;
 }
 `}</style>
 <ReactMarkdown
 remarkPlugins={[remarkGfm]}
 components={{
 a: ({ href, children, ...props }: ComponentPropsWithoutRef<'a'>) => {
 if (!href) return <span {...props}>{children}</span>;
 const isArticle = href.startsWith('/area-restrita/artigo/') || href.startsWith('/artigo/');
 const isDocument = href.startsWith('/documento/');
 return (
 <a
 href={href}
 target="_blank"
 rel="noopener noreferrer"
 className={isArticle || isDocument ? 'text-brand-700 font-medium hover:text-ink-primary hover:underline' : undefined}
 {...props}
 >
 {children}
 </a>
 );
 },
 }}
 >
 {processedContent}
 </ReactMarkdown>
 </div>
 );
}
