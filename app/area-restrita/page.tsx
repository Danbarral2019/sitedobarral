'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Loader2,
  LogOut,
  Heart,
  CheckCircle,
  Clock,
  ChevronRight,
  Home,
  Scale,
  Search,
  ArrowRight,
  FileText,
  BookOpen,
  List,
  Book,
  CreditCard,
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
  PdfExportBar,
  SearchHistoryPanel,
} from '@/components/area-restrita';
import DocumentDetailModal from '@/components/DocumentDetailModal';
import DocumentsByCategory from '@/components/DocumentsByCategory';
import CourseArea from '@/components/area-restrita/CourseArea';
import NovidadesSection from '@/components/area-restrita/NovidadesSection';
import OnboardingGuide from '@/components/area-restrita/OnboardingGuide';
import CourseVideos from '@/components/CourseVideos';
import RecommendedSites from '@/components/RecommendedSites';
import { ArticleTreeNavigator } from '@/components/ArticleTreeNavigator';
import LegislativeActsPanel from '@/components/LegislativeActsPanel';
import { GlossaryPanel } from '@/components/glossary/GlossaryPanel';
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

// Configuração das categorias para o grid da Base de Conhecimento
const KNOWLEDGE_BASE_CATEGORIES: Array<{
  category: string;
  label: string;
  icon: typeof Scale;
  color: string;
  matchCategories?: readonly string[];
}> = [
  { category: 'acordao', label: 'Acordaos TCU', icon: Scale, color: 'blue' },
  { category: 'pareceres', label: 'Pareceres', icon: FileText, color: 'purple', matchCategories: PARECER_CATEGORIES },
  { category: 'orientacao-normativa', label: 'Orientacoes Normativas', icon: BookOpen, color: 'green' },
  { category: 'enunciados', label: 'Enunciados', icon: List, color: 'amber' },
  { category: 'manual_tcu', label: 'Manual do TCU', icon: Book, color: 'teal' },
];

const CATEGORY_COLORS: Record<string, { bg: string; border: string; iconBg: string; text: string; hover: string }> = {
  blue: { bg: 'bg-blue-50', border: 'border-blue-200', iconBg: 'bg-blue-100', text: 'text-blue-700', hover: 'hover:border-blue-400 hover:shadow-md' },
  purple: { bg: 'bg-purple-50', border: 'border-purple-200', iconBg: 'bg-purple-100', text: 'text-purple-700', hover: 'hover:border-purple-400 hover:shadow-md' },
  green: { bg: 'bg-green-50', border: 'border-green-200', iconBg: 'bg-green-100', text: 'text-green-700', hover: 'hover:border-green-400 hover:shadow-md' },
  amber: { bg: 'bg-amber-50', border: 'border-amber-200', iconBg: 'bg-amber-100', text: 'text-amber-700', hover: 'hover:border-amber-400 hover:shadow-md' },
  teal: { bg: 'bg-teal-50', border: 'border-teal-200', iconBg: 'bg-teal-100', text: 'text-teal-700', hover: 'hover:border-teal-400 hover:shadow-md' },
};

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
  category?: string | null;
}

export default function AreaRestritaPage() {
  const router = useRouter();
  const { user, isLoading: authLoading, logout, activePlan } = useAuth();
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
  const [modulesData, setModulesData] = useState<Record<string, { moduleCount: number; lessonCount: number }>>({});
  const [isDataLoading, setIsDataLoading] = useState(true);

  // Search history visibility
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  // Lei 14.133 quick nav
  const [articleInput, setArticleInput] = useState('');

  // Document modal state
  const [selectedDocument, setSelectedDocument] = useState<DocumentType | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // PDF export selection state
  const [selectedDocIds, setSelectedDocIds] = useState<Set<string>>(new Set());
  const [isExporting, setIsExporting] = useState(false);

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
          // Deduplicate documents across courses (common docs appear in multiple groups)
          const seen = new Set<string>();
          docs = Object.values(courseDocuments).flat().filter((d) => {
            if (seen.has(d.id)) return false;
            seen.add(d.id);
            return true;
          });
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

  // PDF export handlers
  const toggleDocSelect = (id: string) => {
    setSelectedDocIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const documentResults = useMemo(() => {
    return search.results
      .filter(r => r.type === 'document')
      .map(r => r.data as DocumentResult);
  }, [search.results]);

  const selectAllDocs = () => {
    setSelectedDocIds(new Set(documentResults.map(d => d.id)));
  };

  const clearDocSelection = () => setSelectedDocIds(new Set());

  const handleExportPdf = async () => {
    if (selectedDocIds.size === 0) return;
    setIsExporting(true);
    try {
      const res = await fetch('/api/export-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentIds: Array.from(selectedDocIds),
          mode: 'search',
          searchContext: {
            query: search.query,
            aiResponse: search.aiAnswer || undefined,
            searchType: search.aiAnswer ? 'ai' : 'local',
            timestamp: new Date().toISOString(),
          },
        }),
      });
      if (!res.ok) throw new Error('Erro ao gerar PDF');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `documentos-${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Erro ao exportar PDF:', error);
    } finally {
      setIsExporting(false);
    }
  };

  // Clear selection when search changes
  useEffect(() => {
    setSelectedDocIds(new Set());
  }, [search.query]);

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
                onClick={() => {
                  contentTree.clearSelection();
                  search.clearSearch();
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
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
              {/* Badge de plano + link de assinatura */}
              {activePlan ? (
                <button
                  onClick={async () => {
                    const res = await fetch('/api/stripe/portal', { method: 'POST' });
                    const data = await res.json();
                    if (data.url) window.location.href = data.url;
                  }}
                  className="hidden lg:flex items-center gap-1.5 px-3 py-2 text-gray-700 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors font-medium text-sm"
                  title="Gerenciar assinatura"
                >
                  <CreditCard className="w-4 h-4" />
                  <span className="px-1.5 py-0.5 text-xs font-semibold rounded bg-blue-100 text-blue-700">
                    {activePlan === 'premium' ? 'Premium' : 'Básico'}
                  </span>
                </button>
              ) : (
                <Link
                  href="/planos"
                  className="hidden lg:flex items-center gap-1.5 px-3 py-2 text-gray-700 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors font-medium text-sm"
                >
                  <CreditCard className="w-4 h-4" />
                  <span>Planos</span>
                </Link>
              )}
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
          {/* Search History - collapsible below search bar */}
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
                selectedIds={selectedDocIds}
                onToggleSelect={toggleDocSelect}
                onAskAIAboutDoc={(docTitle) => {
                  search.sendFollowUp(`Sobre o documento "${docTitle}": ${search.query}`);
                }}
                aiConversationHistory={search.aiConversationHistory}
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
                    {/* Onboarding Guide (first visit only) */}
                    {currentContent.type === 'documents' && !contentTree.selection && (
                      <OnboardingGuide />
                    )}

                    {/* Lei 14.133 Highlight Card (home/no selection) */}
                    {currentContent.type === 'documents' && !contentTree.selection && (
                      <div className="mb-6 bg-gradient-to-br from-brand-600 to-brand-700 rounded-2xl p-4 text-white shadow-lg overflow-hidden relative">
                        {/* Background decoration */}
                        <div className="absolute top-0 right-0 w-32 h-32 opacity-10">
                          <Scale className="w-full h-full" />
                        </div>

                        <div className="relative z-10">
                          {/* Single-row layout: icon + title + input + button */}
                          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                            <div className="flex items-center gap-3 flex-shrink-0">
                              <div className="p-2 bg-white/20 rounded-xl">
                                <Scale className="w-5 h-5" />
                              </div>
                              <div className="sm:mr-2">
                                <h2 className="text-base lg:text-lg font-bold leading-tight">Lei 14.133/2021 Comentada</h2>
                                <p className="text-xs text-brand-200">195 artigos com jurisprudência</p>
                              </div>
                            </div>

                            <form
                              onSubmit={(e) => {
                                e.preventDefault();
                                const num = articleInput.trim();
                                if (num && /^\d+$/.test(num)) {
                                  router.push(`/area-restrita/artigo/${num}`);
                                }
                              }}
                              className="flex-1 flex gap-2"
                            >
                              <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-300" />
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  pattern="[0-9]*"
                                  placeholder="Ir para Art. ..."
                                  value={articleInput}
                                  onChange={(e) => setArticleInput(e.target.value.replace(/\D/g, ''))}
                                  className="w-full pl-9 pr-3 py-2 bg-white/15 border border-white/20 rounded-xl text-white placeholder-brand-200 text-sm focus:outline-none focus:ring-2 focus:ring-white/40 focus:bg-white/20"
                                />
                              </div>
                              <button
                                type="submit"
                                disabled={!articleInput.trim()}
                                className="px-3 py-2 bg-white text-brand-700 font-bold text-sm rounded-xl hover:bg-brand-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                              >
                                <ArrowRight className="w-4 h-4" />
                              </button>
                            </form>

                            <button
                              onClick={() => contentTree.selectNode({ id: 'lei', type: 'lei', label: 'Lei 14.133/2021', count: 195 })}
                              className="flex-shrink-0 px-4 py-2 bg-white/15 border border-white/25 text-white font-semibold text-sm rounded-xl hover:bg-white/25 transition-colors flex items-center gap-2 justify-center"
                            >
                              Explorar por Temas
                              <ChevronRight className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Novidades Section (home/no selection) */}
                    {currentContent.type === 'documents' && !contentTree.selection && (
                      <NovidadesSection
                        onDocumentClick={(docId) => {
                          setSelectedDocument({ id: docId, title: '', type: 'pdf', category: '', url: '' });
                          setIsModalOpen(true);
                        }}
                      />
                    )}

                    {/* Course Area Highlight (home/no selection) */}
                    {currentContent.type === 'documents' && !contentTree.selection && (
                      <CourseArea
                        documents={courseDocuments}
                        enrolledCourseIds={enrolledCourseIds}
                        onDocumentClick={handleDocumentClick}
                        modulesData={modulesData}
                        sites={courseSites}
                      />
                    )}

                    {/* Documents - category grid when no subcategory selected */}
                    {currentContent.type === 'documents' && contentTree.selection && !contentTree.selection.category && (() => {
                      const allDocs = Object.values(courseDocuments).flat();
                      const categoriesWithCounts = KNOWLEDGE_BASE_CATEGORIES.map((cat) => {
                        const mc = cat.matchCategories;
                        const count = mc
                          ? allDocs.filter((d) => mc.includes(d.category)).length
                          : allDocs.filter((d) => d.category === cat.category).length;
                        return { ...cat, count };
                      }).filter((cat) => cat.count > 0);

                      if (categoriesWithCounts.length === 0) {
                        return (
                          <div className="bg-white rounded-2xl border-2 border-gray-200 p-8 text-center">
                            <p className="text-gray-500">Nenhum documento encontrado na base de conhecimento.</p>
                          </div>
                        );
                      }

                      return (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                          {categoriesWithCounts.map((cat) => {
                            const colors = CATEGORY_COLORS[cat.color] || CATEGORY_COLORS.blue;
                            const Icon = cat.icon;
                            return (
                              <button
                                key={cat.category}
                                onClick={() => contentTree.setSelection({
                                  type: 'document',
                                  category: cat.category,
                                })}
                                className={`${colors.bg} border-2 ${colors.border} ${colors.hover} rounded-xl p-5 text-left transition-all cursor-pointer group`}
                              >
                                <div className={`inline-flex p-2.5 ${colors.iconBg} rounded-lg mb-3`}>
                                  <Icon className={`w-5 h-5 ${colors.text}`} />
                                </div>
                                <h3 className={`font-bold ${colors.text} text-sm mb-1`}>{cat.label}</h3>
                                <p className="text-xs text-gray-500">{cat.count} {cat.count === 1 ? 'documento' : 'documentos'}</p>
                              </button>
                            );
                          })}
                        </div>
                      );
                    })()}

                    {/* Documents - filtered list when subcategory selected */}
                    {currentContent.type === 'documents' && currentContent.documents.length > 0 && contentTree.selection && contentTree.selection.category && (
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
                        modulesData={modulesData}
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

                    {/* Glossário Inline */}
                    {currentContent.type === 'glossary' && (
                      <GlossaryPanel articleBasePath="/area-restrita/artigo" />
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
                    {currentContent.type === 'documents' && currentContent.documents.length === 0 && contentTree.selection && contentTree.selection.category && (
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

      {/* PDF Export Bar */}
      {search.isSearchActive && documentResults.length > 0 && (
        <PdfExportBar
          selectedCount={selectedDocIds.size}
          totalDocumentCount={documentResults.length}
          onSelectAll={selectAllDocs}
          onClearSelection={clearDocSelection}
          onExport={handleExportPdf}
          isExporting={isExporting}
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
