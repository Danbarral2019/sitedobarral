'use client';

import { useState } from 'react';
import Link from 'next/link';
import { BookOpen, ChevronDown, ChevronUp } from 'lucide-react';
import type { GlossaryResult } from '@/lib/types/global-search';
import { highlightText } from './search-utils';

export interface GlossaryResultCardProps {
 term: GlossaryResult;
 query: string;
}

export function GlossaryResultCard({ term, query }: GlossaryResultCardProps) {
 const [isExpanded, setIsExpanded] = useState(false);

 return (
 <div className="bg-surface-page rounded-md border border-border-subtle p-4 hover:border-border-strong transition-all">
 <div className="flex items-start gap-3">
 <div className="p-2 rounded-[3px] bg-surface-raised text-ink-secondary flex-shrink-0">
 <BookOpen className="w-5 h-5" />
 </div>
 <div className="flex-1 min-w-0">
 <div className="flex items-center justify-between">
 <Link
 href={`/glossario/${term.slug}`}
 className="font-semibold text-ink-primary text-sm hover:text-ink-secondary transition-colors"
 >
 {highlightText(term.term, query)}
 </Link>
 <button
 onClick={() => setIsExpanded(!isExpanded)}
 className="p-1 text-ink-muted hover:text-ink-secondary"
 >
 {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
 </button>
 </div>
 <p className={`text-sm text-ink-secondary mt-1 ${isExpanded ? '' : 'line-clamp-2'}`}>
 {highlightText(term.shortDef || term.definition, query)}
 </p>
 {term.category && (
 <span className="inline-block mt-2 px-2 py-0.5 rounded-full text-xs font-medium bg-surface-raised text-ink-secondary">
 {term.category}
 </span>
 )}
 </div>
 </div>
 </div>
 );
}
