'use client';

import { useState } from 'react';
import { Sparkles, ChevronDown, ChevronUp } from 'lucide-react';
import LessonMarkdownContent from './LessonMarkdownContent';

interface LessonContentProps {
 content: string;
 aiSummary?: string | null;
 aiKeyPoints?: string[] | null;
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
 <div className="bg-surface-raised border border-border-subtle rounded-md overflow-hidden">
 <button
 onClick={() => setSummaryOpen(!summaryOpen)}
 className="w-full flex items-center justify-between px-5 py-4 text-left"
 >
 <div className="flex items-center gap-2">
 <Sparkles className="w-5 h-5 text-ink-secondary" />
 <span className="font-semibold text-ink-primary text-sm">Resumo IA</span>
 </div>
 {summaryOpen ? (
 <ChevronUp className="w-4 h-4 text-ink-muted" />
 ) : (
 <ChevronDown className="w-4 h-4 text-ink-muted" />
 )}
 </button>
 {summaryOpen && (
 <div className="px-5 pb-4 text-sm text-ink-primary leading-relaxed">
 <LessonMarkdownContent content={aiSummary} />
 </div>
 )}
 </div>
 )}

 {/* AI Key Points */}
 {aiKeyPoints && aiKeyPoints.length > 0 && (
 <div className="bg-surface-raised border border-border-subtle rounded-md p-5">
 <h3 className="font-semibold text-amber-accent-deep text-sm mb-3 flex items-center gap-2">
 <span className="w-2 h-2 rounded-full bg-amber-accent" />
 Pontos-Chave
 </h3>
 <ul className="space-y-2">
 {aiKeyPoints.map((point, idx) => (
 <li key={idx} className="flex items-start gap-2.5 text-sm text-amber-accent-deep">
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
 <LessonMarkdownContent content={content} />
 </div>
 );
}
