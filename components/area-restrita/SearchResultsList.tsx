'use client';

import { Fragment, useState } from 'react';
import Link from 'next/link';
import {
  FileText,
  Scale,
  BookOpen,
  Video,
  Globe,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Heart,
  Play,
  Sparkles,
  AlertCircle,
  Gavel,
  CheckSquare,
  Square,
  Download,
} from 'lucide-react';
import type {
  SearchResultItem,
  ContentType,
  DocumentResult,
  LeiArticleResult,
  GlossaryResult,
  VideoResult,
  SiteResult,
  LegislativeActResult,
} from '@/lib/types/global-search';
import { CONTENT_TYPE_CONFIG } from '@/lib/types/global-search';
import type { AISource, LegalSource } from '@/hooks/use-global-search';

interface SearchResultsListProps {
  results: SearchResultItem[];
  query: string;
  isLoading: boolean;
  onDocumentClick?: (doc: DocumentResult) => void;
  onArticleClick?: (articleNum: string) => void;
  isFavorite?: (docId: string) => boolean;
  onToggleFavorite?: (docId: string) => void;
  aiAnswer?: string | null;
  aiSources?: AISource[];
  aiLegalSources?: LegalSource[];
  isAiLoading?: boolean;
  aiError?: string | null;
  onFollowUp?: (query: string) => void;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  onAskAIAboutDoc?: (docTitle: string) => void;
  aiConversationHistory?: { role: 'user' | 'assistant'; content: string }[];
}

const TYPE_ICONS: Record<ContentType, typeof FileText> = {
  document: FileText,
  'course-material': FileText,
  lei: Scale,
  glossary: BookOpen,
  video: Video,
  site: Globe,
  'legislative-act': Gavel,
};

// Highlight search term in text
function highlightText(text: string, query: string): React.ReactNode {
  if (!query || query.length < 2) return text;

  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  const parts = text.split(regex);

  return parts.map((part, i) =>
    regex.test(part) ? (
      <mark key={i} className="bg-yellow-200 text-yellow-900 rounded px-0.5">
        {part}
      </mark>
    ) : (
      part
    )
  );
}

// Source icon by type
function SourceIcon({ category }: { category: string }) {
  switch (category) {
    case 'lei-artigo':
      return <Scale className="w-3 h-3" />;
    case 'ato-normativo':
      return <Gavel className="w-3 h-3" />;
    case 'acordao':
      return <Gavel className="w-3 h-3" />;
    case 'manual-tcu':
      return <BookOpen className="w-3 h-3" />;
    case 'apostila':
    case 'conteudo-programatico':
    case 'outro':
      return <BookOpen className="w-3 h-3" />;
    case 'enunciados':
      return <Scale className="w-3 h-3" />;
    case 'orientacao-normativa':
      return <Gavel className="w-3 h-3" />;
    case 'decor':
    case 'parecer-vinculante':
      return <FileText className="w-3 h-3" />;
    default:
      return <FileText className="w-3 h-3" />;
  }
}

// Format markdown-like text in AI answer (bold, bullet points)
function formatLine(text: string): React.ReactNode {
  // Check if line is a bullet point
  const bulletMatch = text.match(/^(\s*)[*\-]\s+(.*)/);
  const content = bulletMatch ? bulletMatch[2] : text;
  const isBullet = !!bulletMatch;

  // Format bold (**text**)
  const parts = content.split(/(\*\*[^*]+\*\*)/g);
  const formatted = parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    return part;
  });

  if (isBullet) {
    return <span className="flex gap-1.5 ml-2"><span className="text-purple-400">&#8226;</span><span>{formatted}</span></span>;
  }
  return formatted;
}

// AI Answer Card
function AIAnswerCard({
  answer,
  sources,
  legalSources,
  isLoading,
  error,
  onFollowUp,
  query,
  conversationHistory,
}: {
  answer?: string | null;
  sources?: AISource[];
  legalSources?: LegalSource[];
  isLoading?: boolean;
  error?: string | null;
  onFollowUp?: (query: string) => void;
  query?: string;
  conversationHistory?: { role: 'user' | 'assistant'; content: string }[];
}) {
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
      <div className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-2xl border border-purple-200 p-5 animate-pulse">
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
          className="p-1.5 rounded-lg text-purple-500 hover:text-purple-700 hover:bg-purple-100 transition-colors"
          title="Baixar como PDF"
        >
          <Download className="w-4 h-4" />
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

              if (source.url) {
                const isExternal = source.url.startsWith('http');
                if (isExternal) {
                  return (
                    <a
                      key={source.documentId}
                      href={source.url}
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
                    href={source.url}
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

// Document Result Card
function DocumentResultCard({
  doc,
  query,
  onClick,
  isFavorite,
  onToggleFavorite,
  isSelected,
  onToggleSelect,
  onAskAI,
}: {
  doc: DocumentResult;
  query: string;
  onClick?: () => void;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
  isSelected?: boolean;
  onToggleSelect?: () => void;
  onAskAI?: (docTitle: string) => void;
}) {
  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-xl border p-4 hover:shadow-md transition-all cursor-pointer group ${
        isSelected
          ? 'border-brand-400 bg-brand-50/30 ring-1 ring-brand-300'
          : 'border-gray-200 hover:border-brand-300'
      }`}
    >
      <div className="flex items-start gap-3">
        {/* Checkbox */}
        {onToggleSelect && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleSelect();
            }}
            className={`p-1 rounded transition-colors flex-shrink-0 mt-0.5 ${
              isSelected
                ? 'text-brand-600'
                : 'text-gray-300 hover:text-brand-500'
            }`}
            title={isSelected ? 'Desmarcar' : 'Selecionar para PDF'}
          >
            {isSelected ? (
              <CheckSquare className="w-5 h-5" />
            ) : (
              <Square className="w-5 h-5" />
            )}
          </button>
        )}
        <div className="p-2 rounded-lg bg-brand-50 text-brand-600 flex-shrink-0">
          <FileText className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h4 className="font-semibold text-gray-900 text-sm line-clamp-2 group-hover:text-brand-600 transition-colors">
              {highlightText(doc.title, query)}
            </h4>
            {onToggleFavorite && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleFavorite();
                }}
                className={`p-1.5 rounded-lg transition-colors ${
                  isFavorite
                    ? 'text-pink-500 bg-pink-50'
                    : 'text-gray-400 hover:text-pink-500 hover:bg-pink-50'
                }`}
              >
                <Heart className={`w-4 h-4 ${isFavorite ? 'fill-current' : ''}`} />
              </button>
            )}
          </div>
          {doc.description && (
            <p className="text-sm text-gray-600 mt-1 line-clamp-2">
              {highlightText(doc.description, query)}
            </p>
          )}
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
              {doc.category}
            </span>
            {doc.courseName && (
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-brand-50 text-brand-700">
                {doc.courseName}
              </span>
            )}
            {onAskAI && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onAskAI(doc.title);
                }}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-purple-50 text-purple-700 hover:bg-purple-100 transition-colors"
                title="Perguntar à IA sobre este documento"
              >
                <Sparkles className="w-3 h-3" />
                Perguntar à IA
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Lei Article Result Card
function LeiArticleResultCard({
  article,
  query,
  onClick,
}: {
  article: LeiArticleResult;
  query: string;
  onClick?: () => void;
}) {
  return (
    <Link
      href={`/area-restrita/artigo/${article.numero}`}
      onClick={onClick}
      className="block bg-white rounded-xl border border-gray-200 p-4 hover:border-indigo-300 hover:shadow-md transition-all group"
    >
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600 flex-shrink-0">
          <Scale className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-gray-900 text-sm group-hover:text-indigo-600 transition-colors">
            Artigo {article.numero}
          </h4>
          <p className="text-sm text-gray-600 mt-1 line-clamp-3">
            {highlightText(article.ementa.slice(0, 200) + '...', query)}
          </p>
          {article.excerpts && article.excerpts.length > 0 && (
            <div className="mt-2 text-xs text-indigo-600 bg-indigo-50 px-2 py-1 rounded">
              {article.excerpts.length} trecho(s) relevante(s)
            </div>
          )}
          <div className="flex items-center gap-2 mt-2">
            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
              {article.capitulo}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}

// Glossary Result Card
function GlossaryResultCard({ term, query }: { term: GlossaryResult; query: string }) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 hover:border-green-300 hover:shadow-md transition-all">
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-green-50 text-green-600 flex-shrink-0">
          <BookOpen className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <Link
              href={`/glossario/${term.slug}`}
              className="font-semibold text-gray-900 text-sm hover:text-green-600 transition-colors"
            >
              {highlightText(term.term, query)}
            </Link>
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1 text-gray-400 hover:text-gray-600"
            >
              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>
          <p className={`text-sm text-gray-600 mt-1 ${isExpanded ? '' : 'line-clamp-2'}`}>
            {highlightText(term.shortDef || term.definition, query)}
          </p>
          {term.category && (
            <span className="inline-block mt-2 px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700">
              {term.category}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// Video Result Card
function VideoResultCard({ video, query }: { video: VideoResult; query: string }) {
  return (
    <a
      href={video.youtubeUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="block bg-white rounded-xl border border-gray-200 overflow-hidden hover:border-red-300 hover:shadow-md transition-all group"
    >
      <div className="flex">
        {/* Thumbnail */}
        <div className="relative w-32 h-20 bg-gray-100 flex-shrink-0">
          {video.thumbnailUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={video.thumbnailUrl}
              alt={video.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-red-100">
              <Video className="w-8 h-8 text-red-500" />
            </div>
          )}
          <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity">
            <Play className="w-8 h-8 text-white" />
          </div>
        </div>
        {/* Content */}
        <div className="p-3 flex-1 min-w-0">
          <h4 className="font-semibold text-gray-900 text-sm line-clamp-1 group-hover:text-red-600 transition-colors">
            {highlightText(video.title, query)}
          </h4>
          {video.description && (
            <p className="text-xs text-gray-500 mt-1 line-clamp-2">{video.description}</p>
          )}
          {video.courseName && (
            <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-700">
              {video.courseName}
            </span>
          )}
        </div>
      </div>
    </a>
  );
}

// Site Result Card
function SiteResultCard({ site, query }: { site: SiteResult; query: string }) {
  return (
    <a
      href={site.url}
      target="_blank"
      rel="noopener noreferrer"
      className="block bg-white rounded-xl border border-gray-200 p-4 hover:border-teal-300 hover:shadow-md transition-all group"
    >
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-teal-50 text-teal-600 flex-shrink-0">
          {site.faviconUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={site.faviconUrl} alt="" className="w-5 h-5 rounded" />
          ) : (
            <Globe className="w-5 h-5" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="font-semibold text-gray-900 text-sm group-hover:text-teal-600 transition-colors">
              {highlightText(site.title, query)}
            </h4>
            <ExternalLink className="w-3.5 h-3.5 text-gray-400" />
          </div>
          <p className="text-sm text-gray-600 mt-1 line-clamp-2">
            {highlightText(site.description, query)}
          </p>
          {site.category && (
            <span className="inline-block mt-2 px-2 py-0.5 rounded-full text-xs font-medium bg-teal-50 text-teal-700">
              {site.category}
            </span>
          )}
        </div>
      </div>
    </a>
  );
}

// Legislative Act Result Card
function LegislativeActResultCard({ act, query }: { act: LegislativeActResult; query: string }) {
  const typeLabels: Record<string, string> = {
    decreto: 'Decreto',
    portaria: 'Portaria',
    in: 'Instrução Normativa',
    'ordem-servico': 'Ordem de Serviço',
    lei: 'Lei',
    'medida-provisoria': 'Medida Provisória',
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 hover:border-amber-300 hover:shadow-md transition-all">
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-amber-50 text-amber-600 flex-shrink-0">
          <Gavel className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-gray-900 text-sm">
            {highlightText(act.fullNumber, query)}
          </h4>
          <p className="text-sm text-gray-600 mt-1 line-clamp-3">
            {highlightText(act.ementa.slice(0, 250), query)}
          </p>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
              {typeLabels[act.type] || act.type}
            </span>
            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
              {act.issuer}
            </span>
            {act.leiArticles.length > 0 && (
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700">
                Art. {act.leiArticles.slice(0, 3).join(', ')}{act.leiArticles.length > 3 ? '...' : ''}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-2">
            {act.officialUrl && (
              <a
                href={act.officialUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-1 text-xs text-amber-700 hover:text-amber-900"
              >
                <ExternalLink className="w-3 h-3" />
                Texto oficial
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function SearchResultsList({
  results,
  query,
  isLoading,
  onDocumentClick,
  onArticleClick,
  isFavorite,
  onToggleFavorite,
  aiAnswer,
  aiSources,
  aiLegalSources,
  isAiLoading,
  aiError,
  onFollowUp,
  selectedIds,
  onToggleSelect,
  onAskAIAboutDoc,
  aiConversationHistory,
}: SearchResultsListProps) {
  const showAiCard = isAiLoading || aiError || aiAnswer;

  if (isLoading && !showAiCard) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 animate-pulse">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-gray-200" />
              <div className="flex-1">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
                <div className="h-3 bg-gray-200 rounded w-1/2" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (results.length === 0 && !showAiCard) {
    return null;
  }

  // Group results by type
  const groupedResults = results.reduce(
    (acc, result) => {
      if (!acc[result.type]) {
        acc[result.type] = [];
      }
      acc[result.type].push(result);
      return acc;
    },
    {} as Record<ContentType, SearchResultItem[]>
  );

  return (
    <div className="space-y-6">
      {/* AI Answer Card - appears above results */}
      {showAiCard && (
        <AIAnswerCard
          answer={aiAnswer}
          sources={aiSources}
          legalSources={aiLegalSources}
          isLoading={isAiLoading}
          error={aiError}
          onFollowUp={onFollowUp}
          query={query}
          conversationHistory={aiConversationHistory}
        />
      )}

      {/* AI Recommended Sources - semantic results as clickable cards */}
      {aiSources && aiSources.length > 0 && !isAiLoading && aiAnswer && (
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

              if (source.url) {
                const isExternal = source.url.startsWith('http');
                if (isExternal) {
                  return (
                    <a
                      key={source.documentId}
                      href={source.url}
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
                    href={source.url}
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
      )}

      {/* Loading skeleton for traditional results */}
      {isLoading && results.length === 0 && (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 animate-pulse">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-gray-200" />
                <div className="flex-1">
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
                  <div className="h-3 bg-gray-200 rounded w-1/2" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Section divider between AI sources and traditional results */}
      {showAiCard && Object.keys(groupedResults).length > 0 && (
        <div className="flex items-center gap-3 pt-2">
          <div className="flex-1 h-px bg-gray-200" />
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">
            Resultados textuais ({results.length})
          </span>
          <div className="flex-1 h-px bg-gray-200" />
        </div>
      )}

      {/* Grouped traditional results — ordered by priority */}
      {(Object.entries(groupedResults) as [ContentType, SearchResultItem[]][])
        .sort(([a], [b]) => {
          const TYPE_PRIORITY: Record<string, number> = {
            'course-material': 1,
            'document': 2,
            'legislative-act': 3,
            'lei': 4,
            'glossary': 5,
            'video': 6,
            'site': 7,
          };
          return (TYPE_PRIORITY[a] ?? 10) - (TYPE_PRIORITY[b] ?? 10);
        })
        .map(
        ([type, rawItems]) => {
          const config = CONTENT_TYPE_CONFIG[type];
          const Icon = TYPE_ICONS[type];

          // Sub-sort documents by category priority
          const items = type === 'document' ? [...rawItems].sort((a, b) => {
            const CAT_PRIORITY: Record<string, number> = {
              'apostila': 1,
              'conteudo-programatico': 1,
              'outro': 2,
              'bibliografia': 2,
              'enunciados': 3,
              'orientacao-normativa': 3,
              'lei-artigo': 4,
              'ato-normativo': 4,
              'acordao': 5,
              'manual-tcu': 5,
              'decor': 6,
              'parecer-vinculante': 6,
              'sumula': 7,
              'parecer': 7,
            };
            const catA = (a.data as DocumentResult).category || '';
            const catB = (b.data as DocumentResult).category || '';
            return (CAT_PRIORITY[catA] ?? 10) - (CAT_PRIORITY[catB] ?? 10);
          }) : rawItems;

          return (
            <div key={type}>
              {/* Section Header */}
              <div className="flex items-center gap-2 mb-3">
                <Icon className={`w-5 h-5 ${config.color}`} />
                <h3 className="font-bold text-gray-900">{config.labelPlural}</h3>
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                  {items.length}
                </span>
              </div>

              {/* Results Grid */}
              <div className="grid gap-3">
                {items.map((item) => {
                  switch (item.type) {
                    case 'document':
                      const doc = item.data as DocumentResult;
                      return (
                        <DocumentResultCard
                          key={doc.id}
                          doc={doc}
                          query={query}
                          onClick={() => onDocumentClick?.(doc)}
                          isFavorite={isFavorite?.(doc.id)}
                          onToggleFavorite={() => onToggleFavorite?.(doc.id)}
                          isSelected={selectedIds?.has(doc.id)}
                          onToggleSelect={onToggleSelect ? () => onToggleSelect(doc.id) : undefined}
                          onAskAI={onAskAIAboutDoc}
                        />
                      );
                    case 'lei':
                      const article = item.data as LeiArticleResult;
                      return (
                        <LeiArticleResultCard
                          key={article.numero}
                          article={article}
                          query={query}
                          onClick={() => onArticleClick?.(article.numero)}
                        />
                      );
                    case 'glossary':
                      const term = item.data as GlossaryResult;
                      return <GlossaryResultCard key={term.id} term={term} query={query} />;
                    case 'video':
                      const video = item.data as VideoResult;
                      return <VideoResultCard key={video.id} video={video} query={query} />;
                    case 'site':
                      const site = item.data as SiteResult;
                      return <SiteResultCard key={site.id} site={site} query={query} />;
                    case 'legislative-act':
                      const act = item.data as LegislativeActResult;
                      return <LegislativeActResultCard key={act.id} act={act} query={query} />;
                    default:
                      return null;
                  }
                })}
              </div>
            </div>
          );
        }
      )}
    </div>
  );
}
