'use client';

import { useState, Suspense } from 'react';
import { BookOpen, Loader2, AlertCircle, X } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { CROSS_REFERENCES } from '@/data/lei-14133-cross-references';
import {
 LeiSidebar,
 type LeiHierarchy,
 type LeiArticleListItem,
} from '@/components/lei-14133/LeiSidebar';
import { LeiAreaHeader } from '@/components/lei-14133/LeiAreaHeader';
import { LeiArticleCard } from '@/components/lei-14133/LeiArticleCard';
import { LeiCrossReferences } from '@/components/lei-14133/LeiCrossReferences';
import { LeiEnunciadosList } from '@/components/lei-14133/LeiEnunciadosList';
import { LeiProfessorComment } from '@/components/lei-14133/LeiProfessorComment';
import { LeiCuratedCrossRefs } from '@/components/lei-14133/LeiCuratedCrossRefs';
import { LeiSuggestedReadings } from '@/components/lei-14133/LeiSuggestedReadings';
import { LeiExpandableArticleDocuments } from '@/components/lei-14133/LeiExpandableArticleDocuments';
import {
 LeiAISearchResults,
 type AISearchResponse,
} from '@/components/lei-14133/LeiAISearchResults';
import { useLei14133Preview, type LeiArticle } from '@/hooks/use-lei14133-preview';

function LeiComentadaContent() {
 useAuth();
 const reader = useLei14133Preview('/area-restrita/lei-comentada');

 // AI search state (so usado nessa pagina)
 const [isAISearching, setIsAISearching] = useState(false);
 const [aiSearchResults, setAiSearchResults] = useState<AISearchResponse | null>(null);
 const [showAIResults, setShowAIResults] = useState(false);

 // Per-doc expansion state (so usado nessa pagina)
 const [expandedDocumentId, setExpandedDocumentId] = useState<string | null>(null);

 const handleSidebarSelect = (item: LeiArticleListItem) => {
 const full = reader.apiData?.articles.find((a) => a.numero === item.numero);
 if (full) reader.selectArticle(full);
 };

 const handleAISearch = async () => {
 const q = reader.searchQuery.trim();
 if (!q || q.length < 3) return;

 setIsAISearching(true);
 setShowAIResults(true);

 try {
 const response = await fetch('/api/lei-14133/search', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ query: q }),
 });
 if (!response.ok) throw new Error('Erro na busca com IA');
 const data: AISearchResponse = await response.json();
 setAiSearchResults(data);
 } catch (err) {
 console.error('[Busca IA] Erro:', err);
 setAiSearchResults(null);
 } finally {
 setIsAISearching(false);
 }
 };

 const handleAIResultClick = (articleNumber: string) => {
 const article = reader.apiData?.articles.find((a) => a.numero === articleNumber);
 if (!article) return;
 setShowAIResults(false);
 reader.selectArticle(article);
 };

 const toggleDocumentExpanded = (documentId: string) => {
 setExpandedDocumentId((prev) => (prev === documentId ? null : documentId));
 };

 if (reader.loading) {
 return (
 <div className="min-h-screen bg-surface-raised flex items-center justify-center">
 <div className="text-center">
 <Loader2 className="w-12 h-12 animate-spin text-brand-600 mx-auto mb-4" />
 <p className="text-ink-secondary">Carregando Lei 14.133/2021...</p>
 </div>
 </div>
 );
 }

 if (reader.error || !reader.apiData) {
 return (
 <div className="min-h-screen bg-surface-raised flex items-center justify-center p-4">
 <div className="bg-surface-raised border border-border-subtle rounded-[3px] p-6 max-w-md">
 <AlertCircle className="w-12 h-12 text-semantic-error mx-auto mb-4" />
 <h2 className="text-xl font-bold text-ink-primary text-center mb-2">Erro ao Carregar Lei</h2>
 <p className="text-semantic-error text-center mb-4">{reader.error || 'Erro desconhecido'}</p>
 </div>
 </div>
 );
 }

 const { apiData, selectedArticle } = reader;
 const hierarchyForSidebar = reader.filteredHierarchy as LeiHierarchy | null;

 const relatedTopics = selectedArticle
 ? CROSS_REFERENCES.filter((r) => r.articles.includes(selectedArticle.numero))
 : [];

 const sidebar = (
 <LeiSidebar
 hierarchy={hierarchyForSidebar}
 selectedNumero={selectedArticle?.numero ?? null}
 expandedTitulos={reader.expandedTitulos}
 expandedCapitulos={reader.expandedCapitulos}
 onToggleTitulo={reader.toggleTitulo}
 onToggleCapitulo={reader.toggleCapitulo}
 onSelectArticle={handleSidebarSelect}
 articleRefs={reader.articleRefs}
 />
 );

 return (
 <div className="min-h-screen bg-surface-raised">
 <LeiAreaHeader
 searchQuery={reader.searchQuery}
 onSearchChange={reader.setSearchQuery}
 onAISearch={handleAISearch}
 isAISearching={isAISearching}
 onlyWithDocuments={reader.onlyWithDocuments}
 onToggleOnlyWithDocs={reader.toggleOnlyWithDocs}
 totalArticles={apiData.total}
 totalWithDocs={apiData.totalWithDocuments}
 />

 {showAIResults && (
 <LeiAISearchResults
 isSearching={isAISearching}
 results={aiSearchResults}
 onClose={() => setShowAIResults(false)}
 onResultClick={handleAIResultClick}
 />
 )}

 <div className="container mx-auto px-4 py-6">
 <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
 <div className="hidden lg:block lg:col-span-4">
 <div className="bg-surface-page rounded-[3px] sticky top-6 max-h-[calc(100vh-8rem)] overflow-y-auto">
 <div className="p-4 border-b border-border-subtle">
 <h2 className="text-lg font-bold text-ink-primary">Estrutura da Lei</h2>
 <p className="text-sm text-ink-secondary">
 {Object.keys(reader.filteredHierarchy || {}).length} títulos
 </p>
 </div>
 {sidebar}
 </div>
 </div>

 <div className="lg:col-span-8">
 {selectedArticle ? (
 <ArticleSections
 article={selectedArticle}
 relatedTopics={relatedTopics}
 allArticles={apiData.articles}
 onSelectArticle={reader.selectArticle}
 loadingDocs={reader.loadingDocs}
 relatedDocs={reader.relatedDocs}
 expandedCategories={reader.expandedCategories}
 onToggleCategory={reader.toggleCategory}
 expandedDocumentId={expandedDocumentId}
 onToggleDocument={toggleDocumentExpanded}
 />
 ) : (
 <div className="bg-surface-page rounded-[3px] p-12 text-center">
 <BookOpen className="w-16 h-16 text-border-strong mx-auto mb-4" />
 <p className="text-ink-secondary text-lg mb-2">Selecione um artigo</p>
 <p className="text-ink-muted text-sm">
 Navegue pela estrutura da lei ao lado e selecione um artigo para ver seus documentos
 </p>
 </div>
 )}
 </div>
 </div>
 </div>

 {/* Mobile FAB */}
 <button
 onClick={reader.openMobileDrawer}
 className="lg:hidden fixed bottom-6 right-6 z-40 w-14 h-14 bg-brand-600 text-surface-page rounded-full flex items-center justify-center hover:bg-brand-800 transition-colors"
 aria-label="Abrir navegação"
 >
 <BookOpen className="w-6 h-6" />
 </button>

 {/* Mobile Drawer (com slide-in animation) */}
 {reader.mobileDrawerOpen && (
 <div className="lg:hidden fixed inset-0 z-50">
 <div className="absolute inset-0 bg-black/50" onClick={reader.closeMobileDrawer} />
 <div
 className="absolute top-0 left-0 h-full w-[80vw] max-w-sm bg-surface-page overflow-y-auto"
 style={{ animation: 'slide-in-left 0.2s ease-out' }}
 >
 <div className="p-4 border-b border-border-subtle flex items-center justify-between sticky top-0 bg-surface-page z-10">
 <h2 className="text-lg font-bold text-ink-primary">Estrutura da Lei</h2>
 <button onClick={reader.closeMobileDrawer} className="p-2 hover:bg-surface-deep rounded-[3px]">
 <X className="w-5 h-5" />
 </button>
 </div>
 {sidebar}
 </div>
 </div>
 )}

 <style jsx>{`
 @keyframes slide-in-left {
 from { transform: translateX(-100%); }
 to { transform: translateX(0); }
 }
 `}</style>
 </div>
 );
}

interface ArticleSectionsProps {
 article: LeiArticle;
 relatedTopics: { topic: string; articles: string[] }[];
 allArticles: LeiArticle[];
 onSelectArticle: (article: LeiArticle) => void;
 loadingDocs: boolean;
 relatedDocs: ReturnType<typeof useLei14133Preview>['relatedDocs'];
 expandedCategories: Set<string>;
 onToggleCategory: (name: string) => void;
 expandedDocumentId: string | null;
 onToggleDocument: (id: string) => void;
}

function ArticleSections({
 article,
 relatedTopics,
 allArticles,
 onSelectArticle,
 loadingDocs,
 relatedDocs,
 expandedCategories,
 onToggleCategory,
 expandedDocumentId,
 onToggleDocument,
}: ArticleSectionsProps) {
 return (
 <div className="space-y-6">
 <LeiArticleCard
 numero={article.numero}
 titulo={article.titulo}
 capituloCompleto={article.capituloCompleto}
 ementa={article.ementa}
 documentCount={article.documentCount}
 statusVariant="editorial"
 />

 {article.professorComment && <LeiProfessorComment comment={article.professorComment} />}

 {article.crossRefs && (
 <LeiCuratedCrossRefs
 refs={article.crossRefs}
 allArticles={allArticles}
 onSelectArticle={onSelectArticle}
 />
 )}

 {article.suggestedReadings && <LeiSuggestedReadings readings={article.suggestedReadings} />}

 <LeiCrossReferences
 selectedNumero={article.numero}
 topics={relatedTopics}
 allArticles={allArticles}
 onSelectArticle={onSelectArticle}
 />

 {article.documentCount > 0 ? (
 <LeiExpandableArticleDocuments
 loading={loadingDocs}
 data={relatedDocs}
 expandedCategories={expandedCategories}
 onToggleCategory={onToggleCategory}
 expandedDocumentId={expandedDocumentId}
 onToggleDocument={onToggleDocument}
 />
 ) : (
 <div className="bg-surface-raised border border-border-subtle rounded-[3px] p-6 text-center">
 <AlertCircle className="w-12 h-12 text-amber-accent mx-auto mb-3" />
 <p className="text-amber-accent-deep font-medium mb-2">Nenhum documento catalogado para este artigo</p>
 <p className="text-sm text-amber-accent-deep">
 Este artigo ainda não possui documentos vinculados. Estamos trabalhando para ampliar a cobertura da lei.
 </p>
 </div>
 )}

 {article.enunciados && <LeiEnunciadosList enunciados={article.enunciados} />}
 </div>
 );
}

export default function LeiComentadaPage() {
 return (
 <Suspense
 fallback={
 <div className="min-h-screen bg-surface-raised flex items-center justify-center">
 <div className="text-center">
 <Loader2 className="w-12 h-12 animate-spin text-brand-600 mx-auto mb-4" />
 <p className="text-ink-secondary">Carregando Lei 14.133/2021...</p>
 </div>
 </div>
 }
 >
 <LeiComentadaContent />
 </Suspense>
 );
}
