'use client';

import type {
  SearchResultItem,
  ContentType,
  DocumentResult,
  LeiArticleResult,
  GlossaryResult,
  VideoResult,
  SiteResult,
  LegislativeActResult,
  FAQResult,
  BlogPostResult,
} from '@/lib/types/global-search';
import { CONTENT_TYPE_CONFIG } from '@/lib/types/global-search';
import type { AISource, LegalSource } from '@/hooks/use-global-search';

import { TYPE_ICONS } from './search-results/search-utils';
import { AIAnswerCard } from './search-results/AIAnswerCard';
import { AIRecommendedSources } from './search-results/AIRecommendedSources';
import { DocumentResultCard } from './search-results/DocumentResultCard';
import { LeiArticleResultCard } from './search-results/LeiArticleResultCard';
import { GlossaryResultCard } from './search-results/GlossaryResultCard';
import { VideoResultCard } from './search-results/VideoResultCard';
import { SiteResultCard } from './search-results/SiteResultCard';
import { FAQResultCard } from './search-results/FAQResultCard';
import { BlogPostResultCard } from './search-results/BlogPostResultCard';
import { LegislativeActResultCard } from './search-results/LegislativeActResultCard';

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

  // Skeleton só quando AINDA não há resultados do request anterior. Se já há
  // resultados (busca prévia), eles permanecem visíveis durante o novo fetch
  // — evita o "piscar" entre query change e nova response chegando.
  if (isLoading && results.length === 0 && !showAiCard) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-white rounded-[6px] border border-border-subtle p-4 animate-pulse">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-[6px] bg-surface-deep" />
              <div className="flex-1">
                <div className="h-4 bg-surface-deep rounded w-3/4 mb-2" />
                <div className="h-3 bg-surface-deep rounded w-1/2" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (results.length === 0 && !showAiCard && !isLoading) {
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
      <AIRecommendedSources
        aiSources={aiSources ?? []}
        isAiLoading={isAiLoading}
        aiAnswer={aiAnswer}
        onAskAIAboutDoc={onAskAIAboutDoc}
      />

      {/* Loading skeleton for traditional results */}
      {isLoading && results.length === 0 && (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-[6px] border border-border-subtle p-4 animate-pulse">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-[6px] bg-surface-deep" />
                <div className="flex-1">
                  <div className="h-4 bg-surface-deep rounded w-3/4 mb-2" />
                  <div className="h-3 bg-surface-deep rounded w-1/2" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Section divider between AI sources and traditional results */}
      {showAiCard && Object.keys(groupedResults).length > 0 && (
        <div className="flex items-center gap-3 pt-2">
          <div className="flex-1 h-px bg-surface-deep" />
          <span className="text-xs font-medium text-ink-muted uppercase tracking-wider">
            Resultados textuais ({results.length})
          </span>
          <div className="flex-1 h-px bg-surface-deep" />
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
            'faq': 6,
            'video': 7,
            'blog': 8,
            'site': 9,
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
                <h3 className="font-bold text-ink-primary">{config.labelPlural}</h3>
                <span className="px-2 py-0.5 rounded-[3px] text-xs font-medium bg-surface-deep text-ink-muted">
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
                    case 'faq':
                      const faq = item.data as FAQResult;
                      return <FAQResultCard key={faq.id} faq={faq} query={query} />;
                    case 'blog':
                      const post = item.data as BlogPostResult;
                      return <BlogPostResultCard key={post.id} post={post} query={query} />;
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
