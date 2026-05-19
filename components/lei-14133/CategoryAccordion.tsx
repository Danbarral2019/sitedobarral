'use client';

import { ChevronRight, ChevronDown, FileText, ExternalLink } from 'lucide-react';
import type { EnrichedDoc } from '@/hooks/use-lei14133-preview';
import { getDocHref } from './HighlightCard';

interface CategoryAccordionProps {
  displayName: string;
  docs: EnrichedDoc[];
  expanded: boolean;
  onToggle: () => void;
}

export function CategoryAccordion({ displayName, docs, expanded, onToggle }: CategoryAccordionProps) {
  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
      >
        {expanded ? (
          <ChevronDown className="w-5 h-5 text-blue-600 flex-shrink-0" />
        ) : (
          <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
        )}
        <FileText className="w-5 h-5 text-blue-600 flex-shrink-0" />
        <div className="flex-1">
          <h4 className="font-semibold text-gray-900 text-sm">{displayName}</h4>
        </div>
        <span className="px-2.5 py-0.5 bg-blue-600 text-white rounded-full text-xs font-bold">{docs.length}</span>
      </button>

      {expanded && (
        <ul className="bg-white divide-y divide-gray-100">
          {docs.map((doc) => (
            <li key={doc.id}>
              <a
                href={getDocHref(doc)}
                target={doc.url ? '_blank' : undefined}
                rel={doc.url ? 'noopener noreferrer' : undefined}
                className="flex items-center gap-3 px-4 py-2.5 hover:bg-blue-50 transition-colors"
              >
                <FileText className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <span className="flex-1 text-sm text-gray-800 line-clamp-1">{doc.title}</span>
                {doc.isPublic && (
                  <span className="px-2 py-0.5 bg-green-50 text-green-700 text-[10px] font-medium rounded">Público</span>
                )}
                <ExternalLink className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
