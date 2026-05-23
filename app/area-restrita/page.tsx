'use client';

import { useEffect, useState, useMemo, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { Loader2, ArrowLeft } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useEnrolledCourses } from '@/hooks/use-enrolled-courses';
import { useFavorites } from '@/hooks/use-favorites';
import { useGlobalSearch, type SearchSnapshot } from '@/hooks/use-global-search';
import { useSearchPdfExport } from '@/hooks/use-search-pdf-export';
import {
  GlobalSearchBar,
  SearchHistoryPanel,
  AreaRestritaHeader,
  MobileBottomNav,
  RecentActivity,
  WelcomeBanner,
  DashboardHero,
  QuickAccessBar,
  DashboardCourseCard,
} from '@/components/area-restrita';
import { SearchResultsList } from '@/components/area-restrita/SearchResultsList';

const PdfExportBar = dynamic(() => import('@/components/area-restrita/PdfExportBar').then(mod => ({ default: mod.PdfExportBar })));
const PDFExportPanel = dynamic(() => import('@/components/area-restrita/PDFExportPanel').then(mod => ({ default: mod.PDFExportPanel })));
const DocumentDetailModal = dynamic(() => import('@/components/DocumentDetailModal'));
const DocumentsByCategory = dynamic(() => import('@/components/DocumentsByCategory'));
const LegislativeActsPanel = dynamic(() => import('@/components/LegislativeActsPanel'));
const GlossaryPanel = dynamic(() => import('@/components/glossary/GlossaryPanel').then(mod => ({ default: mod.GlossaryPanel })));
import type { DocumentResult } from '@/lib/types/global-search';

interface DocumentType {
  id: string;
  title: string;
  description?: string;
  type: string;
  url?: string;
  category: string;
  uploadedAt?: string;
  tags?: string;
  courseId?: string;
  isCommon?: boolean;
  entityType?: string;
}

type InlineView =
  | 'home'
  | 'legislative-acts'
  | 'glossary'
  | { type: 'category'; category: string };

function AreaRestritaContent() {
  const router = useRouter();
  const urlSearchParams = useSearchParams();
  const { user, isLoading: authLoading, logout, activePlan } = useAuth();
  const { isFavorite, toggleFavorite, favoriteIds } = useFavorites();
  const search = useGlobalSearch();

  // Inline view state (replaces tree sidebar)
  const [inlineView, setInlineView] = useState<InlineView>('home');

  // Course data state
  const [courseDocuments, setCourseDocuments] = useState<Record<string, DocumentType[]>>({});
  const [modulesData, setModulesData] = useState<Record<string, { moduleCount: number; lessonCount: number }>>({});
  const [isDataLoading, setIsDataLoading] = useState(true);

  // Search history visibility
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  // Document modal state
  const [selectedDocument, setSelectedDocument] = useState<DocumentType | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // PDF export during search
  const pdfExport = useSearchPdfExport(search.results, search.query, search.aiAnswer);

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [authLoading, user, router]);

  // Restaurar query da URL no mount: tenta primeiro recuperar snapshot
  // completo de sessionStorage (resultados + IA) — sem refetch. Se snapshot
  // não existir ou estiver stale (>30 min), cai pra setQuery normal que
  // dispara busca debounced.
  const didRestoreRef = useRef(false);
  const SNAPSHOT_KEY = 'area-restrita:last-search';
  const SNAPSHOT_TTL_MS = 30 * 60 * 1000; // 30 min

  useEffect(() => {
    if (didRestoreRef.current) return;
    const q = urlSearchParams?.get('q') ?? '';
    if (!q) {
      didRestoreRef.current = true;
      return;
    }

    // Tenta restaurar snapshot
    if (typeof window !== 'undefined') {
      try {
        const raw = window.sessionStorage.getItem(SNAPSHOT_KEY);
        if (raw) {
          const snap = JSON.parse(raw) as SearchSnapshot;
          const fresh = Date.now() - (snap.savedAt ?? 0) < SNAPSHOT_TTL_MS;
          if (fresh && snap.query === q) {
            search.restoreSnapshot(snap);
            didRestoreRef.current = true;
            return;
          }
        }
      } catch {
        // sessionStorage indisponível (modo privado, etc.) — segue fluxo normal
      }
    }

    if (q !== search.query) {
      search.setQuery(q);
    }
    didRestoreRef.current = true;
  }, [urlSearchParams, search]);

  // Persistir snapshot em sessionStorage quando os resultados estabilizam.
  // Salvamos apenas quando: query >= 2 chars, NÃO está carregando IA, e há
  // resposta IA OU há resultados. Evita salvar estados intermediários.
  useEffect(() => {
    if (!didRestoreRef.current) return;
    if (search.query.length < 2) return;
    if (search.isAiLoading || search.isLoading) return;
    if (!search.aiAnswer && search.results.length === 0) return;

    if (typeof window === 'undefined') return;
    try {
      const snap: SearchSnapshot = {
        query: search.query,
        results: search.results,
        counts: search.counts,
        aiAnswer: search.aiAnswer,
        aiSources: search.aiSources,
        aiLegalSources: search.aiLegalSources,
        aiConversationHistory: search.aiConversationHistory,
        ticMode: search.ticMode,
        savedAt: Date.now(),
      };
      window.sessionStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snap));
    } catch {
      // sessionStorage cheio ou indisponível — não-fatal
    }
  }, [
    search.query,
    search.results,
    search.counts,
    search.aiAnswer,
    search.aiSources,
    search.aiLegalSources,
    search.aiConversationHistory,
    search.ticMode,
    search.isAiLoading,
    search.isLoading,
  ]);

  // Sincronizar query → URL para que router.back() de outra rota volte com a
  // busca preenchida. Usa replace (sem entrada de histórico nova) e debounce.
  useEffect(() => {
    if (!didRestoreRef.current) return;
    const t = setTimeout(() => {
      const params = new URLSearchParams(urlSearchParams?.toString() ?? '');
      if (search.query.length >= 2) {
        params.set('q', search.query);
      } else {
        params.delete('q');
      }
      const next = params.toString();
      const current = urlSearchParams?.toString() ?? '';
      if (next !== current) {
        const url = next ? `?${next}` : '/area-restrita';
        router.replace(url, { scroll: false });
      }
    }, 400);
    return () => clearTimeout(t);
  }, [search.query, router, urlSearchParams]);

  // Cursos do usuário (fonte única — sidebar, header e dashboard)
  const enrolledCourses = useEnrolledCourses();
  const enrolledCourseIds = useMemo(
    () => enrolledCourses.map((c) => c.id),
    [enrolledCourses],
  );

  // Fetch course data
  useEffect(() => {
    const fetchCourseData = async () => {
      if (!user || enrolledCourseIds.length === 0) {
        setIsDataLoading(false);
        return;
      }

      try {
        const courseIdsParam = enrolledCourseIds.join(',');
        const response = await fetch(`/api/area-restrita/batch-data?courseIds=${courseIdsParam}`);

        if (response.ok) {
          const data = await response.json();
          setCourseDocuments(data.data.documents || {});
          setModulesData(data.data.modules || {});
        }
      } catch (error) {
        console.error('Error fetching course data:', error);
      } finally {
        setIsDataLoading(false);
      }
    };

    fetchCourseData();
  }, [user, enrolledCourseIds]);

  // All documents flat (usado nas inline views por categoria)
  const allDocuments = useMemo(
    () => Object.values(courseDocuments).flat(),
    [courseDocuments],
  );

  // Documents filtered by category for inline view
  const categoryDocuments = useMemo(() => {
    if (typeof inlineView !== 'object') return [];
    const cat = inlineView.category;
    const PARECER_CATEGORIES = ['parecer', 'parecer-vinculante', 'decor'];
    if (cat === 'pareceres') {
      return allDocuments.filter((d) => PARECER_CATEGORIES.includes(d.category));
    }
    return allDocuments.filter((d) => d.category === cat);
  }, [inlineView, allDocuments]);

  // Handlers
  const handleDocumentClick = (doc: DocumentType | DocumentResult | { id: string; title: string; category: string; url?: string }) => {
    const docType: DocumentType = {
      id: doc.id,
      title: doc.title,
      description: 'description' in doc ? doc.description || undefined : undefined,
      type: 'type' in doc ? doc.type : 'pdf',
      category: doc.category,
      url: doc.url || undefined,
    };
    setSelectedDocument(docType);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedDocument(null);
  };

  const handleLogout = async () => {
    await logout();
  };

  // Loading state
  if (authLoading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-brand-600 mx-auto mb-4" />
          <p className="text-gray-700 font-medium">Verificando acesso...</p>
        </div>
      </main>
    );
  }

  // Not authenticated
  if (!user) {
    return null;
  }

  return (
    <main className="min-h-screen bg-gray-50/50">
      <AreaRestritaHeader
        userName={user.name}
        enrolledCount={enrolledCourseIds.length}
        activePlan={activePlan}
        onHomeClick={() => {
          setInlineView('home');
          search.clearSearch();
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        onLogout={handleLogout}
      />

      <div className="max-w-5xl mx-auto px-4 py-6 lg:py-8 space-y-6">
        {/* Welcome Banner (first visit) */}
        <WelcomeBanner />

        {/* Hero Search */}
        <DashboardHero>
          <GlobalSearchBar
            query={search.query}
            onQueryChange={search.setQuery}
            onClear={search.clearSearch}
            isLoading={search.isLoading}
            counts={search.counts}
            activeTypes={search.filters.types}
            onToggleType={search.toggleType}
            aiEnabled={search.aiEnabled}
            onAIToggle={() => search.setAiEnabled(!search.aiEnabled)}
            isAiLoading={search.isAiLoading}
            onSubmit={search.triggerAISearch}
            ticMode={search.ticMode}
            onTicToggle={() => search.setTicMode(!search.ticMode)}
          />
          {!search.isSearchActive && (
            <SearchHistoryPanel
              isVisible={true}
              collapsed={!isSearchFocused}
              onToggle={() => setIsSearchFocused((v) => !v)}
              onSelectQuery={(q) => {
                search.setQuery(q);
                search.triggerAISearch();
                setIsSearchFocused(false);
              }}
            />
          )}
        </DashboardHero>

        {/* Content Area
         *
         * Importante: a Home e as Inline Views ficam SEMPRE montadas e são
         * apenas escondidas via `hidden` quando há busca ativa. Sem isto, a
         * árvore Home/Inline desmonta e remonta a cada caractere entre 1→2
         * chars (limite `isSearchActive`), causando o flash visual que o
         * usuário relatou ao digitar. SearchResultsList continua condicional
         * pois é caro e sem estado a preservar quando fechado.
         */}
        {search.isSearchActive && (
          <SearchResultsList
            results={search.results}
            query={search.query}
            isLoading={search.isLoading}
            onDocumentClick={handleDocumentClick}
            onArticleClick={(num) => router.push(`/area-restrita/artigo/${num}`)}
            isFavorite={isFavorite}
            onToggleFavorite={(docId) => toggleFavorite(docId, enrolledCourseIds[0] || '')}
            aiAnswer={search.aiAnswer}
            aiSources={search.aiSources}
            aiLegalSources={search.aiLegalSources}
            isAiLoading={search.isAiLoading}
            aiError={search.aiError}
            onFollowUp={search.sendFollowUp}
            selectedIds={pdfExport.selectedDocIds}
            onToggleSelect={pdfExport.toggleDocSelect}
            onAskAIAboutDoc={(docTitle) => {
              search.sendFollowUp(`Sobre o documento "${docTitle}": ${search.query}`);
            }}
            aiConversationHistory={search.aiConversationHistory}
          />
        )}

        {/* Home (mantida montada — escondida durante busca ou em inline view) */}
        <div
          hidden={search.isSearchActive || inlineView !== 'home'}
          className="space-y-6"
        >
          {/* Quick Access Pills */}
          <QuickAccessBar onShowInlineView={(view) => setInlineView(view)} />

          {/* Continue Studying */}
          <RecentActivity onDocumentClick={handleDocumentClick} />

          {/* Course Cards */}
          {!isDataLoading && (
            <DashboardCourseCard
              documents={courseDocuments}
              enrolledCourseIds={enrolledCourseIds}
              modulesData={modulesData}
              onDocumentClick={handleDocumentClick}
            />
          )}

          {/* Important Notice */}
          <div className="bg-orange-50 border-l-4 border-orange-500 p-4 lg:p-6 rounded-r-xl">
            <h3 className="text-base font-bold text-orange-900 mb-1">Importante</h3>
            <p className="text-sm text-orange-800">
              Este material é de uso exclusivo dos alunos matriculados. O compartilhamento não
              autorizado pode resultar na suspensão do acesso.
            </p>
          </div>
        </div>

        {/* Inline Content Views (escondidas durante busca ou em home) */}
        <div hidden={search.isSearchActive || inlineView === 'home'}>
          <button
            onClick={() => setInlineView('home')}
            className="flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-brand-600 mb-4 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar ao Início
          </button>

          {inlineView === 'legislative-acts' && <LegislativeActsPanel />}
          {inlineView === 'glossary' && <GlossaryPanel articleBasePath="/area-restrita/artigo" />}
          {typeof inlineView === 'object' && inlineView.type === 'category' && (
            <DocumentsByCategory
              documents={categoryDocuments}
              courseId={enrolledCourseIds[0] || ''}
              onDocumentClick={handleDocumentClick}
              isFavorite={isFavorite}
              toggleFavorite={(docId) => toggleFavorite(docId, enrolledCourseIds[0] || '')}
            />
          )}
        </div>
      </div>

      {/* Document Detail Modal */}
      {isModalOpen && selectedDocument && (
        <DocumentDetailModal
          documentId={selectedDocument.id}
          onClose={handleCloseModal}
          isFavorite={isFavorite(selectedDocument.id)}
          onToggleFavorite={() => toggleFavorite(selectedDocument.id, selectedDocument.courseId || enrolledCourseIds[0] || '')}
        />
      )}

      {/* PDF Export Panel - available when NOT searching */}
      {!search.isSearchActive && typeof inlineView === 'object' && inlineView.type === 'category' && (
        <PDFExportPanel
          documents={categoryDocuments}
          userName={user.name}
          userEmail={user.email}
          favoriteIds={favoriteIds}
        />
      )}

      {/* PDF Export Bar - available during search */}
      {search.isSearchActive && pdfExport.documentResults.length > 0 && (
        <PdfExportBar
          selectedCount={pdfExport.selectedDocIds.size}
          totalDocumentCount={pdfExport.documentResults.length}
          onSelectAll={pdfExport.selectAllDocs}
          onClearSelection={pdfExport.clearDocSelection}
          onExport={pdfExport.handleExportPdf}
          isExporting={pdfExport.isExporting}
        />
      )}

      <MobileBottomNav onLogout={handleLogout} />
    </main>
  );
}

// Wrapper com Suspense (requerido pelo Next.js 15 para useSearchParams)
export default function AreaRestritaPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-blue-50 via-white to-blue-50">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      }
    >
      <AreaRestritaContent />
    </Suspense>
  );
}
