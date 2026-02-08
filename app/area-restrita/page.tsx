'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Loader2,
  LogOut,
  Heart,
  CheckCircle,
  Clock,
  MessageSquare,
  ChevronRight,
  Home,
} from 'lucide-react';
import Link from 'next/link';
import { courses } from '@/data/courses';
import { useAuth } from '@/hooks/use-auth';
import { useFavorites } from '@/hooks/use-favorites';
import { useGlobalSearch } from '@/hooks/use-global-search';
import { useContentTree } from '@/hooks/use-content-tree';
import {
  GlobalSearchBar,
  ContentTree,
  SearchResultsList,
  MobileTreeDrawer,
  MobileTreeTrigger,
} from '@/components/area-restrita';
import DocumentDetailModal from '@/components/DocumentDetailModal';
import DocumentsByCategory from '@/components/DocumentsByCategory';
import CourseArea from '@/components/area-restrita/CourseArea';
import CourseVideos from '@/components/CourseVideos';
import RecommendedSites from '@/components/RecommendedSites';
import { ArticleTreeNavigator } from '@/components/ArticleTreeNavigator';
import LegislativeActsPanel from '@/components/LegislativeActsPanel';
import type { DocumentResult } from '@/lib/types/global-search';

// Categorias que devem ser agrupadas sob "Pareceres"
const PARECER_CATEGORIES = ['parecer', 'parecer-vinculante', 'decor'];

// Mapeamento de categorias para nomes amigáveis
const CATEGORY_LABELS: Record<string, string> = {
  'pareceres': 'Pareceres',
  'orientacao-normativa': 'Orientações Normativas',
  'enunciados': 'Enunciados',
  'acordao': 'Acórdãos TCU',
  'sumula': 'Súmulas',
  'outro': 'Outros',
};

function getCategoryLabel(category: string): string {
  return CATEGORY_LABELS[category] || category.charAt(0).toUpperCase() + category.slice(1);
}

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
}

export default function AreaRestritaPage() {
  const router = useRouter();
  const { user, isLoading: authLoading, logout } = useAuth();
  const { isFavorite, toggleFavorite } = useFavorites();

  // Global search state
  const search = useGlobalSearch();

  // Content tree state
  const contentTree = useContentTree();

  // Mobile drawer state
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);

  // Course data state (for tree navigation display)
  const [courseDocuments, setCourseDocuments] = useState<Record<string, DocumentType[]>>({});
  const [courseVideos, setCourseVideos] = useState<Record<string, VideoType[]>>({});
  const [courseSites, setCourseSites] = useState<Record<string, SiteType[]>>({});
  const [isDataLoading, setIsDataLoading] = useState(true);

  // Document modal state
  const [selectedDocument, setSelectedDocument] = useState<DocumentType | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

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
        }
      } catch (error) {
        console.error('Error fetching course data:', error);
      } finally {
        setIsDataLoading(false);
      }
    };

    fetchCourseData();
  }, [user, enrolledCourseIds]);

  // Get current content based on tree selection
  const currentContent = useMemo(() => {
    if (!contentTree.selection) {
      // No selection - show all documents from all enrolled courses
      const allDocs = Object.values(courseDocuments).flat();
      return {
        type: 'documents' as const,
        documents: allDocs,
        videos: [] as VideoType[],
        sites: [] as SiteType[],
        title: 'Base de Conhecimento',
      };
    }

    const { type, courseId, category } = contentTree.selection;

    switch (type) {
      case 'document': {
        let docs: DocumentType[] = [];
        let title = 'Base de Conhecimento';

        if (courseId) {
          docs = courseDocuments[courseId] || [];
          const course = courses.find((c) => c.id === courseId);
          title = course?.title || 'Curso';

          if (category) {
            if (category === 'pareceres') {
              docs = docs.filter((d) => PARECER_CATEGORIES.includes(d.category));
            } else {
              docs = docs.filter((d) => d.category === category);
            }
            title = `${getCategoryLabel(category)} - ${title}`;
          }
        } else {
          docs = Object.values(courseDocuments).flat();
          if (category) {
            if (category === 'pareceres') {
              docs = docs.filter((d) => PARECER_CATEGORIES.includes(d.category));
            } else {
              docs = docs.filter((d) => d.category === category);
            }
            title = getCategoryLabel(category);
          }
        }

        return { type: 'documents' as const, documents: docs, videos: [], sites: [], title };
      }

      case 'course-material': {
        let docs: DocumentType[] = [];
        let title = 'Materiais do Curso';

        if (courseId) {
          docs = courseDocuments[courseId] || [];
          const course = courses.find((c) => c.id === courseId);
          title = `Materiais - ${course?.title || 'Curso'}`;
          if (category) {
            docs = docs.filter((d) => d.category === category);
          }
        } else {
          docs = Object.values(courseDocuments).flat();
        }

        // Filter to only course material categories
        docs = docs.filter((d) =>
          ['apostila', 'conteudo-programatico', 'bibliografia', 'material-complementar'].includes(d.category)
        );

        return { type: 'course-material' as const, documents: docs, videos: [], sites: [], title };
      }

      case 'lei':
        return { type: 'lei' as const, documents: [], videos: [], sites: [], title: 'Lei 14.133/2021' };

      case 'legislative-act':
        return { type: 'legislative-act' as const, documents: [], videos: [], sites: [], title: 'Atos Normativos Infralegais' };

      case 'glossary':
        return { type: 'glossary' as const, documents: [], videos: [], sites: [], title: 'Glossário' };

      case 'video': {
        let videos: VideoType[] = [];
        let title = 'Vídeos';

        if (courseId) {
          videos = courseVideos[courseId] || [];
          const course = courses.find((c) => c.id === courseId);
          title = `Vídeos - ${course?.title || 'Curso'}`;
        } else {
          videos = Object.values(courseVideos).flat();
        }

        return { type: 'videos' as const, documents: [], videos, sites: [], title };
      }

      case 'site': {
        const allSites = Object.values(courseSites).flat();
        // Remove duplicates by id
        const uniqueSites = allSites.filter(
          (site, index, self) => index === self.findIndex((s) => s.id === site.id)
        );
        return { type: 'sites' as const, documents: [], videos: [], sites: uniqueSites, title: 'Sites Recomendados' };
      }

      default:
        return { type: 'documents' as const, documents: [], videos: [], sites: [], title: '' };
    }
  }, [contentTree.selection, courseDocuments, courseVideos, courseSites]);

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
      {/* Header */}
      <header className="bg-white border-b-2 border-gray-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 py-3 lg:py-4">
          <div className="flex items-center justify-between">
            {/* User Info */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => contentTree.clearSelection()}
                className="p-2 rounded-lg text-brand-600 hover:bg-brand-50 transition-colors"
                title="Voltar ao Início"
              >
                <Home className="w-5 h-5 lg:w-6 lg:h-6" />
              </button>
              <div className="w-10 h-10 lg:w-12 lg:h-12 bg-gradient-to-br from-green-500 to-green-700 rounded-full flex items-center justify-center shadow-md">
                <span className="text-white font-bold text-sm lg:text-lg">
                  {user.name.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="hidden sm:block">
                <h2 className="text-sm lg:text-lg font-bold text-gray-900">
                  Bem-vindo, {user.name.split(' ')[0]}
                </h2>
                <p className="text-xs lg:text-sm text-gray-600">
                  {enrolledCourseIds.length} {enrolledCourseIds.length === 1 ? 'curso' : 'cursos'}
                </p>
              </div>
              <CheckCircle className="w-5 h-5 lg:w-6 lg:h-6 text-green-600 sm:hidden" />
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 lg:gap-3">
              <Link
                href="/area-restrita/favoritos"
                className="flex items-center gap-1.5 px-3 py-2 text-gray-700 hover:text-pink-600 hover:bg-pink-50 rounded-lg transition-colors font-medium text-sm focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
              >
                <Heart className="w-4 h-4" />
                <span className="hidden lg:inline">Favoritos</span>
              </Link>
              <Link
                href="/area-restrita/historico"
                className="hidden lg:flex items-center gap-1.5 px-3 py-2 text-gray-700 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors font-medium text-sm focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
              >
                <Clock className="w-4 h-4" />
                <span>Histórico</span>
              </Link>
              <button
                onClick={handleLogout}
                className="flex items-center gap-1.5 px-3 py-2 text-gray-700 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors font-medium text-sm focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden lg:inline">Sair</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
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
          />
        </div>

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
            <aside className="hidden lg:block w-64 flex-shrink-0">
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

                {/* AI Assistant Banner */}
                <div className="mt-4 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-2xl p-4 text-white shadow-lg">
                  <div className="flex items-start gap-3">
                    <MessageSquare className="w-6 h-6 flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-bold text-sm">Assistente IA</h4>
                      <p className="text-xs text-purple-100 mt-1">
                        Tire dúvidas sobre licitações com IA
                      </p>
                      <Link
                        href="/area-restrita/assistente"
                        className="inline-flex items-center gap-1 mt-2 text-xs font-medium text-white hover:text-purple-200 transition-colors"
                      >
                        Acessar
                        <ChevronRight className="w-3 h-3" />
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            </aside>
          )}

          {/* Main Content Area */}
          <div className="flex-1 min-w-0">
            {/* Search Results */}
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
              />
            ) : (
              /* Tree Navigation Content */
              <div>
                {/* Section Title */}
                {currentContent.title && (
                  <div className="mb-4">
                    <h2 className="text-xl lg:text-2xl font-bold text-gray-900">
                      {currentContent.title}
                    </h2>
                  </div>
                )}

                {/* Content Based on Selection */}
                {isDataLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
                  </div>
                ) : (
                  <>
                    {/* Course Area Highlight (home/no selection) */}
                    {currentContent.type === 'documents' && !contentTree.selection && (
                      <CourseArea
                        documents={courseDocuments}
                        enrolledCourseIds={enrolledCourseIds}
                        onDocumentClick={handleDocumentClick}
                      />
                    )}

                    {/* Documents */}
                    {currentContent.type === 'documents' && currentContent.documents.length > 0 && (
                      <DocumentsByCategory
                        documents={currentContent.documents}
                        courseId={contentTree.selection?.courseId || enrolledCourseIds[0] || ''}
                        onDocumentClick={handleDocumentClick}
                        isFavorite={isFavorite}
                        toggleFavorite={(docId) => toggleFavorite(docId, contentTree.selection?.courseId || enrolledCourseIds[0] || '')}
                      />
                    )}

                    {/* Course Materials */}
                    {currentContent.type === 'course-material' && currentContent.documents.length > 0 && (
                      <CourseArea
                        documents={courseDocuments}
                        enrolledCourseIds={enrolledCourseIds}
                        onDocumentClick={handleDocumentClick}
                      />
                    )}

                    {currentContent.type === 'course-material' && currentContent.documents.length === 0 && (
                      <div className="bg-white rounded-2xl border-2 border-gray-200 p-8 text-center">
                        <p className="text-gray-500">Nenhum material do curso disponível.</p>
                      </div>
                    )}

                    {/* Lei 14.133 */}
                    {currentContent.type === 'lei' && (
                      <ArticleTreeNavigator
                        basePath="/area-restrita/artigo"
                        onArticleClick={(articleNum) => router.push(`/area-restrita/artigo/${articleNum}`)}
                      />
                    )}

                    {/* Atos Normativos Infralegais */}
                    {currentContent.type === 'legislative-act' && (
                      <LegislativeActsPanel />
                    )}

                    {/* Glossary Redirect */}
                    {currentContent.type === 'glossary' && (
                      <div className="bg-white rounded-2xl border-2 border-gray-200 p-8 text-center">
                        <p className="text-gray-600 mb-4">
                          O glossário completo está disponível na página pública.
                        </p>
                        <Link
                          href="/glossario"
                          className="inline-flex items-center gap-2 px-6 py-3 bg-green-600 text-white font-medium rounded-xl hover:bg-green-700 transition-colors"
                        >
                          Acessar Glossário
                          <ChevronRight className="w-4 h-4" />
                        </Link>
                      </div>
                    )}

                    {/* Videos */}
                    {currentContent.type === 'videos' && currentContent.videos.length > 0 && (
                      <CourseVideos videos={currentContent.videos} displayMode="thumbnails" />
                    )}

                    {/* Sites */}
                    {currentContent.type === 'sites' && currentContent.sites.length > 0 && (
                      <RecommendedSites sites={currentContent.sites} />
                    )}

                    {/* Empty States */}
                    {currentContent.type === 'documents' && currentContent.documents.length === 0 && (
                      <div className="bg-white rounded-2xl border-2 border-gray-200 p-8 text-center">
                        <p className="text-gray-500">Nenhum documento encontrado nesta categoria.</p>
                      </div>
                    )}

                    {currentContent.type === 'videos' && currentContent.videos.length === 0 && (
                      <div className="bg-white rounded-2xl border-2 border-gray-200 p-8 text-center">
                        <p className="text-gray-500">Nenhum vídeo disponível.</p>
                      </div>
                    )}

                    {currentContent.type === 'sites' && currentContent.sites.length === 0 && (
                      <div className="bg-white rounded-2xl border-2 border-gray-200 p-8 text-center">
                        <p className="text-gray-500">Nenhum site recomendado.</p>
                      </div>
                    )}
                  </>
                )}
              </div>
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

      {/* Mobile Bottom Navigation */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t-2 border-gray-200 shadow-2xl z-50 pb-safe">
        <div className="flex items-center justify-around h-16">
          <Link
            href="/area-restrita"
            className="flex flex-col items-center justify-center flex-1 h-full text-brand-600 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
          >
            <CheckCircle className="w-6 h-6 mb-1" />
            <span className="text-xs font-medium">Início</span>
          </Link>
          <Link
            href="/area-restrita/favoritos"
            className="flex flex-col items-center justify-center flex-1 h-full text-gray-600 hover:text-pink-600 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
          >
            <Heart className="w-6 h-6 mb-1" />
            <span className="text-xs font-medium">Favoritos</span>
          </Link>
          <Link
            href="/area-restrita/assistente"
            className="flex flex-col items-center justify-center flex-1 h-full text-gray-600 hover:text-purple-600 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
          >
            <MessageSquare className="w-6 h-6 mb-1" />
            <span className="text-xs font-medium">IA</span>
          </Link>
          <button
            onClick={handleLogout}
            className="flex flex-col items-center justify-center flex-1 h-full text-gray-600 hover:text-red-600 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
          >
            <LogOut className="w-6 h-6 mb-1" />
            <span className="text-xs font-medium">Sair</span>
          </button>
        </div>
      </nav>
    </main>
  );
}
