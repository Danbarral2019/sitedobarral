'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { courses } from '@/data/courses';
import { useAuth } from '@/hooks/use-auth';
import { useFavorites } from '@/hooks/use-favorites';
import { useGlobalSearch } from '@/hooks/use-global-search';
import { useContentTree } from '@/hooks/use-content-tree';
import { useCurrentContent } from '@/hooks/use-current-content';
import { useSearchPdfExport } from '@/hooks/use-search-pdf-export';
import {
  GlobalSearchBar,
  ContentTree,
  SearchResultsList,
  MobileTreeDrawer,
  MobileTreeTrigger,
  PdfExportBar,
  PDFExportPanel,
  SearchHistoryPanel,
  AreaRestritaHeader,
  TreeContentArea,
  MobileBottomNav,
  RecentActivity,
} from '@/components/area-restrita';
import DocumentDetailModal from '@/components/DocumentDetailModal';
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

interface VideoType {
  id: string;
  title: string;
  description?: string | null;
  youtubeUrl: string;
  youtubeId: string;
  thumbnailUrl?: string | null;
}

interface SiteType {
  id: string;
  title: string;
  description: string;
  url: string;
  faviconUrl?: string | null;
  category?: string | null;
}

export default function AreaRestritaPage() {
  const router = useRouter();
  const { user, isLoading: authLoading, logout, activePlan } = useAuth();
  const { isFavorite, toggleFavorite, favoriteIds } = useFavorites();
  const search = useGlobalSearch();
  const contentTree = useContentTree();

  // Mobile drawer state
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);

  // Course data state
  const [courseDocuments, setCourseDocuments] = useState<Record<string, DocumentType[]>>({});
  const [courseVideos, setCourseVideos] = useState<Record<string, VideoType[]>>({});
  const [courseSites, setCourseSites] = useState<Record<string, SiteType[]>>({});
  const [modulesData, setModulesData] = useState<Record<string, { moduleCount: number; lessonCount: number }>>({});
  const [isDataLoading, setIsDataLoading] = useState(true);

  // Search history visibility
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  // Document modal state
  const [selectedDocument, setSelectedDocument] = useState<DocumentType | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Derived content from tree selection
  const currentContent = useCurrentContent(
    contentTree.selection,
    courseDocuments,
    courseVideos,
    courseSites,
  );

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

  // Fetch course data for tree navigation
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
          setCourseVideos(data.data.videos || {});
          setCourseSites(data.data.sites || {});
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

  // Handlers
  const handleDocumentClick = (doc: DocumentType | DocumentResult) => {
    const docType: DocumentType = {
      id: doc.id,
      title: doc.title,
      description: doc.description || undefined,
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

  // Get selected label for mobile trigger
  const selectedLabel = useMemo(() => {
    if (!contentTree.selection) return undefined;
    const node = contentTree.tree.find((n) => n.type === contentTree.selection?.type);
    return node?.label;
  }, [contentTree.selection, contentTree.tree]);

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
    <main className="min-h-screen bg-gradient-to-br from-brand-50 via-white to-brand-50">
      <AreaRestritaHeader
        userName={user.name}
        enrolledCount={enrolledCourseIds.length}
        activePlan={activePlan}
        onHomeClick={() => {
          contentTree.clearSelection();
          search.clearSearch();
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        onLogout={handleLogout}
      />

      <div className="max-w-7xl mx-auto px-4 py-6 lg:py-8">
        {/* Global Search Bar */}
        <div className="mb-6">
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
        </div>

        {/* Recent Activity — Continue de onde parou */}
        {!search.isSearchActive && (
          <RecentActivity onDocumentClick={handleDocumentClick} />
        )}

        {/* Mobile Tree Trigger */}
        {!search.isSearchActive && (
          <div className="mb-6 lg:hidden">
            <MobileTreeTrigger
              onClick={() => setIsMobileDrawerOpen(true)}
              selectedLabel={selectedLabel}
            />
          </div>
        )}

        {/* Content Area */}
        <div className="flex gap-6">
          {/* Sidebar Tree - Desktop Only */}
          {!search.isSearchActive && (
            <aside className="hidden lg:block w-72 flex-shrink-0">
              <div className="sticky top-24">
                <ContentTree
                  tree={contentTree.tree}
                  isLoading={contentTree.isLoading}
                  error={contentTree.error}
                  selection={contentTree.selection}
                  onSelectNode={contentTree.selectNode}
                  expandedNodes={contentTree.expandedNodes}
                  onToggleNode={contentTree.toggleNode}
                />
              </div>
            </aside>
          )}

          {/* Main Content Area */}
          <div className="flex-1 min-w-0">
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
            ) : (
              <TreeContentArea
                currentContent={currentContent}
                selection={contentTree.selection}
                isDataLoading={isDataLoading}
                courseDocuments={courseDocuments}
                enrolledCourseIds={enrolledCourseIds}
                modulesData={modulesData}
                isFavorite={isFavorite}
                toggleFavorite={(docId, courseId) => toggleFavorite(docId, courseId)}
                onDocumentClick={handleDocumentClick}
                onNovidadeClick={(docId) => {
                  setSelectedDocument({ id: docId, title: '', type: 'pdf', category: '', url: '' });
                  setIsModalOpen(true);
                }}
                onSelectCategory={(category) => contentTree.setSelection({ type: 'document', category })}
                onExploreTemas={() => contentTree.selectNode({ id: 'lei', type: 'lei', label: 'Lei 14.133/2021', count: 195 })}
              />
            )}

            {/* Important Notice */}
            {!search.isSearchActive && (
              <div className="mt-8 bg-gradient-to-r from-orange-50 to-red-50 border-l-4 border-orange-500 p-4 lg:p-6 rounded-r-xl">
                <h3 className="text-base font-bold text-orange-900 mb-1">Importante</h3>
                <p className="text-sm text-orange-800">
                  Este material é de uso exclusivo dos alunos matriculados. O compartilhamento não
                  autorizado pode resultar na suspensão do acesso.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Tree Drawer */}
      <MobileTreeDrawer
        isOpen={isMobileDrawerOpen}
        onClose={() => setIsMobileDrawerOpen(false)}
        tree={contentTree.tree}
        isLoading={contentTree.isLoading}
        error={contentTree.error}
        selection={contentTree.selection}
        onSelectNode={contentTree.selectNode}
        expandedNodes={contentTree.expandedNodes}
        onToggleNode={contentTree.toggleNode}
      />

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
      {!search.isSearchActive && (
        <PDFExportPanel
          documents={currentContent.documents}
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
