'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, ArrowLeft } from 'lucide-react';
import { courses } from '@/data/courses';
import { useAuth } from '@/hooks/use-auth';
import { useFavorites } from '@/hooks/use-favorites';
import { useGlobalSearch } from '@/hooks/use-global-search';
import { useSearchPdfExport } from '@/hooks/use-search-pdf-export';
import {
  GlobalSearchBar,
  SearchResultsList,
  PdfExportBar,
  PDFExportPanel,
  SearchHistoryPanel,
  AreaRestritaHeader,
  MobileBottomNav,
  RecentActivity,
  WelcomeBanner,
  DashboardHero,
  QuickAccessBar,
  DashboardCourseCard,
  KnowledgeBaseSection,
} from '@/components/area-restrita';
import NovidadesSection from '@/components/area-restrita/NovidadesSection';
import DocumentDetailModal from '@/components/DocumentDetailModal';
import DocumentsByCategory from '@/components/DocumentsByCategory';
import LegislativeActsPanel from '@/components/LegislativeActsPanel';
import { GlossaryPanel } from '@/components/glossary/GlossaryPanel';
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

export default function AreaRestritaPage() {
  const router = useRouter();
  const { user, isLoading: authLoading, logout, activePlan } = useAuth();
  const { isFavorite, toggleFavorite, favoriteIds } = useFavorites();
  const search = useGlobalSearch();

  // Inline view state (replaces tree sidebar)
  const [inlineView, setInlineView] = useState<InlineView>('home');

  // Course data state
  const [courseDocuments, setCourseDocuments] = useState<Record<string, DocumentType[]>>({});
  const [modulesData, setModulesData] = useState<Record<string, { moduleCount: number; lessonCount: number }>>({});
  const [isDataLoading, setIsDataLoading] = useState(true);
  const [tribunalDecisionCount, setTribunalDecisionCount] = useState(0);

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

  // Enrolled course IDs
  const enrolledCourseIds = useMemo(() => {
    if (!user) return [];
    return user.role === 'admin'
      ? courses.map((c) => c.id)
      : (user.enrollments?.map((e) => e.courseId) || []);
  }, [user]);

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

  // Fetch tribunal decision count for KnowledgeBaseSection
  useEffect(() => {
    fetch('/api/jurisprudencia?pageSize=1')
      .then(res => res.ok ? res.json() : null)
      .then(data => { if (data?.total) setTribunalDecisionCount(data.total); })
      .catch(() => {});
  }, []);

  // All documents flat for KnowledgeBaseSection
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

        {/* Content Area */}
        {search.isSearchActive ? (
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
        ) : inlineView === 'home' ? (
          <>
            {/* Quick Access Pills */}
            <QuickAccessBar
              onShowInlineView={(view) => setInlineView(view)}
            />

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

            {/* Knowledge Base */}
            {!isDataLoading && (
              <KnowledgeBaseSection
                documents={allDocuments}
                onSelectCategory={(cat) => setInlineView({ type: 'category', category: cat })}
                tribunalDecisionCount={tribunalDecisionCount}
              />
            )}

            {/* Novidades */}
            <NovidadesSection
              onDocumentClick={(docId) => {
                setSelectedDocument({ id: docId, title: '', type: 'pdf', category: '', url: '' });
                setIsModalOpen(true);
              }}
            />

            {/* Important Notice */}
            <div className="bg-orange-50 border-l-4 border-orange-500 p-4 lg:p-6 rounded-r-xl">
              <h3 className="text-base font-bold text-orange-900 mb-1">Importante</h3>
              <p className="text-sm text-orange-800">
                Este material é de uso exclusivo dos alunos matriculados. O compartilhamento não
                autorizado pode resultar na suspensão do acesso.
              </p>
            </div>
          </>
        ) : (
          /* Inline Content Views (Atos Normativos, Glossário, Category) */
          <div>
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
        )}
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
