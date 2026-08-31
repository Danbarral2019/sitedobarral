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
    <div className="bg-white rounded-[6px] border border-border-subtle p-4 hover:border-brand-300 hover: transition-all">
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-[6px] bg-brand-50 text-brand-600 flex-shrink-0">
          <HelpCircle className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-ink-primary text-sm group-hover:text-brand-600 transition-colors">
              {highlightText(faq.question, query)}
            </h4>
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1 text-ink-muted hover:text-ink-secondary"
            >
              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>
          <p className={`text-sm text-ink-muted mt-1 ${isExpanded ? '' : 'line-clamp-2'}`}>
            {highlightText(faq.answer, query)}
          </p>
          <span className="inline-block mt-2 px-2 py-0.5 rounded-[3px] text-xs font-medium bg-brand-50 text-brand-700">
            {faq.category}
          </span>
        </div>
      </div>
    </div>
  );
}
