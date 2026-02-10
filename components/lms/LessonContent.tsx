'use client';

import { useState } from 'react';
import { Sparkles, ChevronDown, ChevronUp } from 'lucide-react';

interface LessonContentProps {
  content: string;
  aiSummary?: string | null;
  aiKeyPoints?: string[] | null;
}

function renderMarkdown(text: string): React.ReactNode[] {
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let listItems: React.ReactNode[] = [];
  let orderedItems: React.ReactNode[] = [];
  let listKey = 0;

  const flushList = () => {
    if (listItems.length > 0) {
      elements.push(
        <ul key={`ul-${listKey++}`} className="list-disc pl-6 space-y-1 my-3 text-gray-700">
          {listItems}
        </ul>
      );
      listItems = [];
    }
    if (orderedItems.length > 0) {
      elements.push(
        <ol key={`ol-${listKey++}`} className="list-decimal pl-6 space-y-1 my-3 text-gray-700">
          {orderedItems}
        </ol>
      );
      orderedItems = [];
    }
  };

  const formatInline = (str: string): React.ReactNode[] => {
    const parts: React.ReactNode[] = [];
    // Process **bold**, *italic*, `code`
    const regex = /(\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`)/g;
    let lastIndex = 0;
    let match;
    let partKey = 0;

    while ((match = regex.exec(str)) !== null) {
      if (match.index > lastIndex) {
        parts.push(str.slice(lastIndex, match.index));
      }
      if (match[2]) {
        parts.push(<strong key={`b-${partKey++}`} className="font-semibold text-gray-900">{match[2]}</strong>);
      } else if (match[3]) {
        parts.push(<em key={`i-${partKey++}`} className="italic">{match[3]}</em>);
      } else if (match[4]) {
        parts.push(
          <code key={`c-${partKey++}`} className="px-1.5 py-0.5 bg-gray-100 rounded text-sm font-mono text-brand-700">
            {match[4]}
          </code>
        );
      }
      lastIndex = match.index + match[0].length;
    }
    if (lastIndex < str.length) {
      parts.push(str.slice(lastIndex));
    }
    return parts.length > 0 ? parts : [str];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Empty line
    if (!trimmed) {
      flushList();
      continue;
    }

    // Headers
    if (trimmed.startsWith('### ')) {
      flushList();
      elements.push(
        <h3 key={`h3-${i}`} className="text-lg font-bold text-gray-900 mt-6 mb-2">
          {formatInline(trimmed.slice(4))}
        </h3>
      );
      continue;
    }
    if (trimmed.startsWith('## ')) {
      flushList();
      elements.push(
        <h2 key={`h2-${i}`} className="text-xl font-bold text-gray-900 mt-8 mb-3">
          {formatInline(trimmed.slice(3))}
        </h2>
      );
      continue;
    }

    // Unordered list
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      if (orderedItems.length > 0) flushList();
      listItems.push(
        <li key={`li-${i}`} className="text-sm leading-relaxed">
          {formatInline(trimmed.slice(2))}
        </li>
      );
      continue;
    }

    // Ordered list
    const olMatch = trimmed.match(/^(\d+)\.\s+(.+)/);
    if (olMatch) {
      if (listItems.length > 0) flushList();
      orderedItems.push(
        <li key={`oli-${i}`} className="text-sm leading-relaxed">
          {formatInline(olMatch[2])}
        </li>
      );
      continue;
    }

    // Paragraph
    flushList();
    elements.push(
      <p key={`p-${i}`} className="text-sm text-gray-700 leading-relaxed my-2">
        {formatInline(trimmed)}
      </p>
    );
  }

  flushList();
  return elements;
}

export default function LessonContent({
  content,
  aiSummary,
  aiKeyPoints,
}: LessonContentProps) {
  const [summaryOpen, setSummaryOpen] = useState(false);

  return (
    <div className="space-y-6">
      {/* AI Summary */}
      {aiSummary && (
        <div className="bg-gradient-to-r from-purple-50 to-brand-50 border border-purple-200 rounded-2xl overflow-hidden">
          <button
            onClick={() => setSummaryOpen(!summaryOpen)}
            className="w-full flex items-center justify-between px-5 py-4 text-left"
          >
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-500" />
              <span className="font-semibold text-purple-900 text-sm">Resumo IA</span>
            </div>
            {summaryOpen ? (
              <ChevronUp className="w-4 h-4 text-purple-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-purple-400" />
            )}
          </button>
          {summaryOpen && (
            <div className="px-5 pb-4 text-sm text-purple-900 leading-relaxed">
              {renderMarkdown(aiSummary)}
            </div>
          )}
        </div>
      )}

      {/* AI Key Points */}
      {aiKeyPoints && aiKeyPoints.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
          <h3 className="font-semibold text-amber-900 text-sm mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            Pontos-Chave
          </h3>
          <ul className="space-y-2">
            {aiKeyPoints.map((point, idx) => (
              <li key={idx} className="flex items-start gap-2.5 text-sm text-amber-900">
                <span
                  className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5"
                  style={{
                    backgroundColor: `hsl(${35 + idx * 10}, 80%, 85%)`,
                    color: `hsl(${35 + idx * 10}, 80%, 30%)`,
                  }}
                >
                  {idx + 1}
                </span>
                <span className="leading-relaxed">{point}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Main Content */}
      <div className="prose-custom">{renderMarkdown(content)}</div>
    </div>
  );
}
