'use client';

import { Fragment, useState } from 'react';
import Link from 'next/link';
import {
  Scale,
  ExternalLink,
  Sparkles,
  AlertCircle,
  Gavel,
  Download,
} from 'lucide-react';
import type { AISource, LegalSource } from '@/hooks/use-global-search';
import { formatLine, SourceIcon } from './search-utils';

export interface AIAnswerCardProps {
  answer?: string | null;
  sources?: AISource[];
  legalSources?: LegalSource[];
  isLoading?: boolean;
  error?: string | null;
  onFollowUp?: (query: string) => void;
  query?: string;
  conversationHistory?: { role: 'user' | 'assistant'; content: string }[];
}

export function AIAnswerCard({
  answer,
  sources,
  legalSources,
  isLoading,
  error,
  onFollowUp,
  query,
  conversationHistory,
}: AIAnswerCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [followUpInput, setFollowUpInput] = useState('');

  const handleDownloadPDF = async () => {
    if (!answer || !query) return;
    const { generateSearchResultPDF } = await import('@/lib/pdf-generator');
    generateSearchResultPDF({
      query,
      answer,
      sources: sources?.map(s => ({ title: s.title, category: s.category, url: s.url })),
      legalSources: legalSources?.map(s => ({ type: s.type, title: s.title, url: s.url })),
      conversationHistory,
    });
  };

  const handleFollowUpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = followUpInput.trim();
    if (q && onFollowUp) {
      onFollowUp(q);
      setFollowUpInput('');
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-2xl border border-purple-200 p-5 animate-pulse" aria-live="polite" aria-busy="true" role="status">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-5 h-5 rounded bg-purple-200" />
          <div className="h-4 bg-purple-200 rounded w-24" />
        </div>
        <div className="space-y-2">
          <div className="h-3 bg-purple-100 rounded w-full" />
          <div className="h-3 bg-purple-100 rounded w-5/6" />
          <div className="h-3 bg-purple-100 rounded w-4/6" />
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="bg-red-50 rounded-2xl border border-red-200 p-5">
        <div className="flex items-center gap-2 text-red-700">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm font-medium">{error}</span>
        </div>
      </div>
    );
  }

  // No answer
  if (!answer) return null;

  return (
    <div className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-2xl border border-purple-200 p-5 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-purple-600" />
          <h3 className="font-bold text-purple-900 text-sm">Análise IA</h3>
        </div>
        <button
          onClick={handleDownloadPDF}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-purple-700 bg-purple-100 hover:bg-purple-200 transition-colors"
          title="Baixar resposta como PDF"
        >
          <Download className="w-3.5 h-3.5" />
          Baixar PDF
        </button>
      </div>

      {/* Answer text */}
      <div className="text-sm text-gray-800 leading-relaxed">
        <div className={isExpanded ? '' : 'line-clamp-6'}>
          {answer.split('\n\n').map((paragraph, i) => (
            <p key={i} className="mb-3 last:mb-0">
              {paragraph.split('\n').map((line, j) => (
                <Fragment key={j}>
                  {j > 0 && <br />}
                  {formatLine(line)}
                </Fragment>
              ))}
            </p>
          ))}
        </div>
        {answer.length > 400 && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="mt-2 text-purple-600 hover:text-purple-800 text-xs font-medium transition-colors"
          >
            {isExpanded ? 'Ver menos' : 'Ver mais'}
          </button>
        )}
      </div>

      {/* Legal Sources */}
      {legalSources && legalSources.length > 0 && (
        <div className="mt-4 pt-3 border-t border-purple-200/50">
          <p className="text-xs font-medium text-purple-700 mb-2">Fundamentação legal:</p>
          <div className="flex flex-wrap gap-2">
            {legalSources.map((source) => {
              const isExternal = source.url.startsWith('http');
              const IconComp = source.type === 'lei-article' ? Scale : Gavel;

              if (isExternal) {
                return (
                  <a
                    key={source.title}
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white/70 border border-indigo-200 rounded-lg text-xs text-indigo-800 hover:bg-indigo-50 hover:border-indigo-300 transition-colors cursor-pointer"
                    title={source.title}
                  >
                    <IconComp className="w-3 h-3 flex-shrink-0" />
                    <span className="truncate max-w-[200px]">{source.title}</span>
                    <ExternalLink className="w-3 h-3 flex-shrink-0 text-indigo-400" />
                  </a>
                );
              }

              return (
                <Link
                  key={source.title}
                  href={source.url}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white/70 border border-indigo-200 rounded-lg text-xs text-indigo-800 hover:bg-indigo-50 hover:border-indigo-300 transition-colors cursor-pointer"
                  title={source.title}
                >
                  <IconComp className="w-3 h-3 flex-shrink-0" />
                  <span className="truncate max-w-[200px]">{source.title}</span>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Document Sources */}
      {sources && sources.length > 0 && (
        <div className="mt-3 pt-3 border-t border-purple-200/50">
          <p className="text-xs font-medium text-purple-700 mb-2">Fontes consultadas:</p>
          <div className="flex flex-wrap gap-2">
            {sources.map((source) => {
              const content = (
                <>
                  <SourceIcon category={source.category} />
                  <span className="truncate max-w-[180px]">{source.title}</span>
                  <span className="text-purple-500 font-medium">
                    {Math.round(source.relevance * 100)}%
                  </span>
                </>
              );

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
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white/70 border border-purple-200 rounded-lg text-xs text-purple-800 hover:bg-purple-50 hover:border-purple-300 transition-colors cursor-pointer"
                      title={source.excerpt}
                    >
                      {content}
                    </a>
                  );
                }
                return (
                  <Link
                    key={source.documentId}
                    href={effectiveUrl}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white/70 border border-purple-200 rounded-lg text-xs text-purple-800 hover:bg-purple-50 hover:border-purple-300 transition-colors cursor-pointer"
                    title={source.excerpt}
                  >
                    {content}
                  </Link>
                );
              }

              return (
                <span
                  key={source.documentId}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white/70 border border-purple-200 rounded-lg text-xs text-purple-800"
                  title={source.excerpt}
                >
                  {content}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Disclaimer */}
      <div className="mt-3 pt-3 border-t border-purple-200/50">
        <p className="text-[10px] text-purple-500/70 leading-relaxed">
          <AlertCircle className="w-3 h-3 inline-block mr-1 -mt-0.5" />
          Esta resposta foi gerada por Inteligencia Artificial e pode conter imprecisoes. E responsabilidade do aluno consultar as fontes originais para verificacao da correcao das informacoes apresentadas.
        </p>
      </div>

      {/* Follow-up input */}
      {onFollowUp && (
        <form onSubmit={handleFollowUpSubmit} className="mt-3 pt-3 border-t border-purple-200/50">
          <div className="flex gap-2">
            <input
              type="text"
              value={followUpInput}
              onChange={(e) => setFollowUpInput(e.target.value)}
              placeholder="Refinar pergunta..."
              className="flex-1 px-3 py-1.5 text-xs border border-purple-200 rounded-lg bg-white/70 focus:outline-none focus:ring-1 focus:ring-purple-400 placeholder:text-purple-400"
            />
            <button
              type="submit"
              disabled={!followUpInput.trim()}
              className="px-3 py-1.5 text-xs font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 disabled:bg-purple-300 disabled:cursor-not-allowed transition-colors"
            >
              Enviar
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
