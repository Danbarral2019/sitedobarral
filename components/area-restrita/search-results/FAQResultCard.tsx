'use client';

import { useState } from 'react';
import { HelpCircle, ChevronDown, ChevronUp } from 'lucide-react';
import type { FAQResult } from '@/lib/types/global-search';
import { highlightText } from './search-utils';

export interface FAQResultCardProps {
  faq: FAQResult;
  query: string;
}

export function FAQResultCard({ faq, query }: FAQResultCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-default)] p-4 hover:border-violet-300 hover:shadow-md transition-all">
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-violet-50 text-violet-600 flex-shrink-0">
          <HelpCircle className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-[var(--text-primary)] text-sm group-hover:text-violet-600 transition-colors">
              {highlightText(faq.question, query)}
            </h4>
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1 text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
            >
              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>
          <p className={`text-sm text-[var(--text-secondary)] mt-1 ${isExpanded ? '' : 'line-clamp-2'}`}>
            {highlightText(faq.answer, query)}
          </p>
          <span className="inline-block mt-2 px-2 py-0.5 rounded-full text-xs font-medium bg-violet-50 text-violet-700">
            {faq.category}
          </span>
        </div>
      </div>
    </div>
  );
}
