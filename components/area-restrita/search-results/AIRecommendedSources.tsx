'use client';

import Link from 'next/link';
import { Sparkles } from 'lucide-react';
import type { AISource } from '@/hooks/use-global-search';
import { SourceIcon } from './search-utils';

export interface AIRecommendedSourcesProps {
  aiSources: AISource[];
  isAiLoading?: boolean;
  aiAnswer?: string | null;
  onAskAIAboutDoc?: (docTitle: string) => void;
}

export function AIRecommendedSources({
  aiSources,
  isAiLoading,
  aiAnswer,
  onAskAIAboutDoc,
}: AIRecommendedSourcesProps) {
  if (!aiSources || aiSources.length === 0 || isAiLoading || !aiAnswer) {
    return null;
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="w-4 h-4 text-purple-500" />
        <h3 className="font-bold text-gray-900 text-sm">Fontes recomendadas pela IA</h3>
        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
          {aiSources.length}
        </span>
      </div>
      <div className="grid gap-2">
        {aiSources.map((source) => {
          const categoryLabels: Record<string, string> = {
            'acordao': 'Acórdão TCU',
            'manual-tcu': 'Manual TCU',
            'enunciados': 'Enunciado',
            'parecer-vinculante': 'Parecer Vinculante',
            'orientacao-normativa': 'ON AGU',
            'decor': 'DECOR',
            'lei-artigo': 'Lei 14.133',
            'ato-normativo': 'Ato Normativo',
            'apostila': 'Material do Curso',
            'conteudo-programatico': 'Material do Curso',
            'outro': 'Material do Curso',
            'bibliografia': 'Bibliografia',
          };
          const label = categoryLabels[source.category] || source.category;

          // Tier 1: Professor's materials get highlighted styling
          const isProfessorMaterial = ['apostila', 'conteudo-programatico', 'outro', 'bibliografia', 'sumula', 'parecer'].includes(source.category);
          // Tier 2: Enunciados and ONs get subtle emphasis
          const isHighPriority = ['enunciados', 'orientacao-normativa'].includes(source.category);

          const borderClass = isProfessorMaterial
            ? 'border-brand-300 bg-brand-50/30 ring-1 ring-brand-200'
            : isHighPriority
            ? 'border-indigo-200 bg-indigo-50/20'
            : 'border-gray-200';
          const hoverClass = isProfessorMaterial
            ? 'hover:border-brand-400 hover:shadow-md'
            : 'hover:border-purple-300 hover:shadow-sm';
          const iconBg = isProfessorMaterial
            ? 'bg-brand-100 text-brand-700'
            : isHighPriority
            ? 'bg-indigo-50 text-indigo-600'
            : 'bg-purple-50 text-purple-600';
          const labelClass = isProfessorMaterial
            ? 'bg-brand-100 text-brand-800 font-semibold'
            : isHighPriority
            ? 'bg-indigo-100 text-indigo-700'
            : 'bg-gray-100 text-gray-600';

          const cardContent = (
            <div className="flex items-start gap-3">
              <div className={`p-1.5 rounded-lg flex-shrink-0 ${iconBg}`}>
                <SourceIcon category={source.category} />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className={`text-sm font-medium line-clamp-1 transition-colors ${isProfessorMaterial ? 'text-brand-900 group-hover:text-brand-700' : 'text-gray-900 group-hover:text-purple-700'}`}>
                  {source.title}
                </h4>
                {source.excerpt && (
                  <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{source.excerpt}</p>
                )}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${labelClass}`}>
                  {label}
                </span>
                <span className="text-xs font-medium text-purple-600">
                  {Math.round(source.relevance * 100)}%
                </span>
                {onAskAIAboutDoc && (
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onAskAIAboutDoc(source.title);
                    }}
                    className="p-1 rounded-full bg-purple-50 text-purple-500 hover:bg-purple-100 hover:text-purple-700 transition-colors opacity-0 group-hover:opacity-100"
                    title="Perguntar à IA sobre este documento"
                  >
                    <Sparkles className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          );

          const cardClassName = `block rounded-xl border px-4 py-3 transition-all group cursor-pointer ${borderClass} ${hoverClass}`;

          // Use internal link for pareceres vinculantes and enunciados
          const useInternalLink = ['parecer-vinculante', 'enunciados'].includes(source.category);
          const effectiveUrl = useInternalLink
            ? `/documento/${source.documentId}`
            : source.url;

          if (effectiveUrl) {
            const isExternal = effectiveUrl.startsWith('http');
            if (isExternal) {
              return (
                <a
                  key={source.documentId}
                  href={effectiveUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cardClassName}
                >
                  {cardContent}
                </a>
              );
            }
            return (
              <Link
                key={source.documentId}
                href={effectiveUrl}
                className={cardClassName}
              >
                {cardContent}
              </Link>
            );
          }

          return (
            <div
              key={source.documentId}
              className={`rounded-xl border px-4 py-3 group ${borderClass}`}
            >
              {cardContent}
            </div>
          );
        })}
      </div>
    </div>
  );
}
