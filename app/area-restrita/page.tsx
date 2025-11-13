'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, LogOut, Clock, GraduationCap, CheckCircle, Heart, FileText, Scale, BookOpen, Video, Globe, Bot } from 'lucide-react';
import { courses } from '@/data/courses';
import { useAuth } from '@/hooks/use-auth';
import { useFavorites } from '@/hooks/use-favorites';
import { useSearch, type GlossaryTermType } from '@/hooks/use-search';
import { searchAndFilterDocuments } from '@/lib/search-utils';
import EnrollmentStatusBanner from '@/components/EnrollmentStatusBanner';
import CoursesSidebar from '@/components/CoursesSidebar';
import HighlightedMaterials from '@/components/HighlightedMaterials';
import DocumentsByCategory from '@/components/DocumentsByCategory';
import DocumentDetailModal from '@/components/DocumentDetailModal';
import CourseVideos from '@/components/CourseVideos';
import RecommendedSites from '@/components/RecommendedSites';
import SearchBar from '@/components/SearchBar';
import SearchFilters from '@/components/SearchFilters';
import PDFExportPanel from '@/components/PDFExportPanel';
import { GlossarySearchResults } from '@/components/GlossarySearchResults';
import { ArticleAutocomplete } from '@/components/ArticleAutocomplete';
import { TopArticlesWidget } from '@/components/TopArticlesWidget';
import { ArticleTreeNavigator } from '@/components/ArticleTreeNavigator';

interface DocumentType {
  id: string;
  title: string;
  description?: string;
  type: string;
  url?: string;
  category: string;
  uploadedAt?: string;
  tags?: string;
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
  const { user, isLoading, logout } = useAuth();
  const { isFavorite, toggleFavorite, favoriteIds } = useFavorites();
  const search = useSearch();

  // Estado dos documentos por curso
  const [courseDocuments, setCourseDocuments] = useState<Record<string, DocumentType[]>>({});

  // Estado dos vídeos por curso
  const [courseVideos, setCourseVideos] = useState<Record<string, VideoType[]>>({});

  // Estado dos sites por curso
  const [courseSites, setCourseSites] = useState<Record<string, SiteType[]>>({});

  // Curso selecionado (inicialmente null, será o primeiro curso após carregamento)
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);

  // Modal de detalhes
  const [selectedDocument, setSelectedDocument] = useState<DocumentType | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Estado dos termos de glossário encontrados na busca
  const [glossaryResults, setGlossaryResults] = useState<GlossaryTermType[]>([]);

  // Estado da tab ativa (para navegação por seções)
  const [activeTab, setActiveTab] = useState<'documentos' | 'lei' | 'glossario' | 'videos' | 'sites'>('documentos');

  // Função para registrar acesso
  const logAccess = async (action: string, courseId: string, documentId?: string) => {
    try {
      await fetch('/api/access-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, courseId, documentId }),
      });
    } catch (error) {
      console.error('Erro ao registrar acesso:', error);
    }
  };

  // Handlers
  const handleDownload = (doc: DocumentType, courseId: string) => {
    logAccess('download', courseId, doc.id);
  };

  const handleView = (doc: DocumentType, courseId: string) => {
    logAccess('view', courseId, doc.id);
  };

  const handleDocumentClick = (doc: DocumentType) => {
    setSelectedDocument(doc);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedDocument(null);
  };

  // Redirecionar se não autenticado
  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login');
    }
  }, [isLoading, user, router]);

  // Buscar documentos, vídeos e sites dos cursos matriculados (BATCH - 1 request)
  useEffect(() => {
    const fetchCourseData = async () => {
      if (!user) return;

      const userEnrollments = user.enrollments || [];
      const enrolledCourseIds = user.role === 'admin'
        ? courses.map(c => c.id)
        : userEnrollments.map(e => e.courseId);

      if (enrolledCourseIds.length === 0) return;

      try {
        // OTIMIZAÇÃO: Batch request - reduz 15+ requests para 1 único request
        const courseIdsParam = enrolledCourseIds.join(',');
        const response = await fetch(`/api/area-restrita/batch-data?courseIds=${courseIdsParam}`);

        if (response.ok) {
          const data = await response.json();

          // Atualizar estados com dados já agrupados por courseId
          setCourseDocuments(data.data.documents || {});
          setCourseVideos(data.data.videos || {});
          setCourseSites(data.data.sites || {});

          // Selecionar primeiro curso automaticamente
          if (enrolledCourseIds.length > 0 && !selectedCourseId) {
            setSelectedCourseId(enrolledCourseIds[0]);
          }
        } else {
          console.error('Erro ao buscar dados batch:', response.statusText);
        }
      } catch (error) {
        console.error('Erro ao buscar dados da área restrita:', error);
      }
    };

    fetchCourseData();
  }, [user, selectedCourseId]);

  const handleLogout = async () => {
    await logout();
  };

  // Computed values - MUST be before early returns to follow Rules of Hooks
  const userEnrollments = useMemo(() => user?.enrollments || [], [user?.enrollments]);
  const enrolledCourseIds = user?.role === 'admin'
    ? courses.map(c => c.id)
    : userEnrollments.map(e => e.courseId);

  // TODOS os cursos com flag isEnrolled
  const allCoursesWithEnrollment = courses.map(course => ({
    ...course,
    isEnrolled: enrolledCourseIds.includes(course.id),
  }));

  // Curso selecionado atual (usando useMemo para evitar problemas de hooks)
  const selectedCourse = useMemo(
    () => courses.find(c => c.id === selectedCourseId),
    [selectedCourseId]
  );

  const isSelectedCourseEnrolled = useMemo(
    () => selectedCourse ? enrolledCourseIds.includes(selectedCourse.id) : false,
    [selectedCourse, enrolledCourseIds]
  );

  const selectedCourseDocuments = useMemo(
    () => {
      const docs = selectedCourseId && isSelectedCourseEnrolled ? (courseDocuments[selectedCourseId] || []) : [];
      console.log(`[DEBUG] selectedCourseId: ${selectedCourseId}, isEnrolled: ${isSelectedCourseEnrolled}, docs: ${docs.length}`);
      if (docs.length > 0) {
        const onDocs = docs.filter(d => d.category === 'orientacao-normativa');
        console.log(`[DEBUG] ONs encontradas: ${onDocs.length}`);
        console.log('[DEBUG] Primeira ON:', docs.find(d => d.category === 'orientacao-normativa')?.title);
      }
      return docs;
    },
    [selectedCourseId, isSelectedCourseEnrolled, courseDocuments]
  );

  const selectedCourseVideos = useMemo(
    () => selectedCourseId && isSelectedCourseEnrolled ? (courseVideos[selectedCourseId] || []) : [],
    [selectedCourseId, isSelectedCourseEnrolled, courseVideos]
  );

  const selectedCourseSites = useMemo(
    () => selectedCourseId && isSelectedCourseEnrolled ? (courseSites[selectedCourseId] || []) : [],
    [selectedCourseId, isSelectedCourseEnrolled, courseSites]
  );

  const selectedEnrollment = useMemo(
    () => userEnrollments.find(e => e.courseId === selectedCourseId),
    [userEnrollments, selectedCourseId]
  );

  // Lista de cursos disponíveis para os filtros
  const availableCourses = useMemo(() => {
    return courses
      .filter(c => enrolledCourseIds.includes(c.id))
      .map(c => ({ id: c.id, title: c.title }));
  }, [enrolledCourseIds]);

  // Documentos filtrados pela busca
  const searchableDocuments = useMemo(() => {
    if (search.scope === 'current') {
      // Apenas documentos do curso atual
      return selectedCourseDocuments;
    } else {
      // Todos os documentos de todos os cursos matriculados
      return Object.values(courseDocuments).flat();
    }
  }, [search.scope, selectedCourseDocuments, courseDocuments]);

  const filteredDocuments = useMemo(() => {
    if (!search.isSearchActive) {
      return selectedCourseDocuments; // Sem busca ativa, mostra todos do curso atual
    }

    return searchAndFilterDocuments(
      searchableDocuments,
      search.searchTerm,
      search.filters,
      favoriteIds
    );
  }, [searchableDocuments, search.searchTerm, search.filters, search.isSearchActive, favoriteIds, selectedCourseDocuments]);

  // Buscar termos do glossário quando há termo de busca
  useEffect(() => {
    const fetchGlossaryResults = async () => {
      if (!search.searchTerm || search.searchTerm.length < 2) {
        setGlossaryResults([]);
        return;
      }

      try {
        const response = await fetch(
          `/api/area-restrita/search-all?q=${encodeURIComponent(search.searchTerm)}&courseId=${selectedCourseId || 'all'}`
        );
        if (response.ok) {
          const data = await response.json();
          setGlossaryResults(data.glossaryTerms || []);
        }
      } catch (error) {
        console.error('Erro ao buscar glossário:', error);
      }
    };

    fetchGlossaryResults();
  }, [search.searchTerm, selectedCourseId]);

  // Contagem de documentos por curso
  const documentCounts = Object.keys(courseDocuments).reduce((acc, courseId) => {
    acc[courseId] = courseDocuments[courseId].length;
    return acc;
  }, {} as Record<string, number>);

  // Handler para seleção de curso (redireciona se bloqueado)
  const handleCourseSelect = (courseId: string) => {
    const course = allCoursesWithEnrollment.find(c => c.id === courseId);
    if (course && !course.isEnrolled) {
      // Redirecionar para página de curso bloqueado
      router.push(`/area-restrita/curso-bloqueado?courseId=${courseId}`);
    } else {
      setSelectedCourseId(courseId);
    }
  };

  // Loading state - AFTER all hooks
  if (isLoading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-700 font-medium">Verificando acesso...</p>
        </div>
      </main>
    );
  }

  // Not authenticated - AFTER all hooks
  if (!user) {
    return null;
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <div className="flex">
        {/* Sidebar de Cursos */}
        <CoursesSidebar
          courses={allCoursesWithEnrollment}
          selectedCourseId={selectedCourseId}
          onCourseSelect={handleCourseSelect}
          documentCounts={documentCounts}
        />

        {/* Conteúdo Principal */}
        <div className="flex-1 p-4 pb-20 lg:p-8 lg:pb-8 lg:ml-80">
          <div className="max-w-5xl mx-auto">
            {/* Header com info do usuário - Compacto no mobile */}
            <div className="bg-white rounded-2xl shadow-lg p-3 lg:p-6 mb-4 lg:mb-8 border-2 border-gray-200">
              {/* Mobile: Header ultra-compacto */}
              <div className="lg:hidden flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-green-700 rounded-full flex items-center justify-center shadow-md">
                    <span className="text-white font-bold text-sm">
                      {user.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-gray-900">
                      Olá, {user.name.split(' ')[0]}
                    </h2>
                    <p className="text-xs text-gray-600">
                      {enrolledCourseIds.length} {enrolledCourseIds.length === 1 ? 'curso' : 'cursos'}
                    </p>
                  </div>
                </div>
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>

              {/* Desktop: Header completo original */}
              <div className="hidden lg:flex lg:flex-row lg:justify-between lg:items-start gap-6">
                {/* Informações do usuário */}
                <div className="flex items-start gap-4">
                  <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-green-700 rounded-full flex items-center justify-center shadow-lg flex-shrink-0">
                    <CheckCircle className="w-8 h-8 text-white" />
                  </div>
                  <div className="flex-1">
                    <h2 className="text-2xl font-bold text-gray-900 mb-1">Bem-vindo, {user.name}</h2>
                    <p className="text-lg text-gray-700 font-medium">
                      {enrolledCourseIds.length} {enrolledCourseIds.length === 1 ? 'curso' : 'cursos'} matriculado{enrolledCourseIds.length !== 1 ? 's' : ''}
                    </p>
                    <p className="text-sm text-gray-600 mt-1">{user.email}</p>
                  </div>
                </div>

                {/* Botões de ação - apenas desktop */}
                <div className="flex items-center gap-3">
                  <a
                    href="/area-restrita/assistente"
                    className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors font-medium"
                  >
                    <Bot className="w-4 h-4" />
                    <span>Assistente IA</span>
                  </a>
                  <a
                    href="/area-restrita/favoritos"
                    className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:text-pink-600 hover:bg-pink-50 rounded-lg transition-colors font-medium"
                  >
                    <Heart className="w-4 h-4" />
                    <span>Favoritos</span>
                  </a>
                  <a
                    href="/area-restrita/historico"
                    className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors font-medium"
                  >
                    <Clock className="w-4 h-4" />
                    <span>Histórico</span>
                  </a>
                  <button
                    onClick={handleLogout}
                    className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors font-medium"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Sair</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Banner de Status do Acesso */}
            {selectedCourse && isSelectedCourseEnrolled && (
              <EnrollmentStatusBanner courseId={selectedCourse.id} />
            )}

            {/* Tabs de Cursos - apenas mobile */}
            {enrolledCourseIds.length > 0 && (
              <div className="lg:hidden mb-4">
                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide snap-x snap-mandatory">
                  {allCoursesWithEnrollment.filter(c => c.isEnrolled).map((course) => {
                    const isSelected = selectedCourseId === course.id;
                    const docCount = documentCounts[course.id] || 0;

                    return (
                      <button
                        key={course.id}
                        onClick={() => setSelectedCourseId(course.id)}
                        className={`flex-shrink-0 snap-start px-4 py-3 rounded-xl border-2 transition-all min-w-[160px] ${
                          isSelected
                            ? 'bg-gradient-to-r from-blue-600 to-purple-600 border-blue-600 text-white shadow-lg'
                            : 'bg-white border-gray-300 text-gray-700 hover:border-blue-400'
                        }`}
                      >
                        <div className="text-left">
                          <h3 className={`font-bold text-xs line-clamp-2 mb-1 ${
                            isSelected ? 'text-white' : 'text-gray-900'
                          }`}>
                            {course.title}
                          </h3>
                          <p className={`text-xs ${
                            isSelected ? 'text-blue-100' : 'text-gray-500'
                          }`}>
                            {docCount} {docCount === 1 ? 'material' : 'materiais'}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
                <style jsx>{`
                  .scrollbar-hide::-webkit-scrollbar {
                    display: none;
                  }
                  .scrollbar-hide {
                    -ms-overflow-style: none;
                    scrollbar-width: none;
                  }
                `}</style>
              </div>
            )}

            {/* Conteúdo do Curso Selecionado */}
            {enrolledCourseIds.length > 0 ? (
              <>
                {selectedCourse && isSelectedCourseEnrolled ? (
                  <div>
                    {/* Informações do Curso */}
                    <div className="bg-white rounded-2xl shadow-lg p-4 lg:p-8 mb-4 lg:mb-6 border-2 border-gray-200">
                      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-3 lg:mb-4 gap-3 lg:gap-4">
                        <div className="inline-block">
                          <h1 className="text-base lg:text-3xl font-bold mb-1 lg:mb-2 text-gray-900 line-clamp-2 lg:line-clamp-none">{selectedCourse.title}</h1>
                          <div className="h-1 w-16 lg:w-32 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full"></div>
                        </div>
                        {selectedEnrollment?.turma && (
                          <div className="bg-blue-50 px-3 py-1.5 lg:px-4 lg:py-2 rounded-lg border border-blue-200 self-start lg:self-auto">
                            <p className="text-xs lg:text-sm text-blue-900 font-medium flex items-center gap-2">
                              <GraduationCap className="w-3.5 h-3.5 lg:w-4 lg:h-4" />
                              Turma: {selectedEnrollment.turma}
                            </p>
                          </div>
                        )}
                      </div>
                      <p className="text-sm lg:text-lg text-gray-700 leading-relaxed">
                        {selectedCourse.description}
                      </p>
                    </div>

                    {/* Busca Tradicional (Secundária) */}
                    <div className="mb-6">
                      <details className="bg-white border-2 border-gray-200 rounded-xl shadow-sm overflow-hidden">
                        <summary className="px-6 py-4 cursor-pointer hover:bg-gray-50 transition-colors flex items-center gap-2 font-semibold text-gray-700">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                          </svg>
                          Busca
                        </summary>

                        <div className="p-6 pt-4 border-t border-gray-200">
                          {/* Campo de busca único */}
                          <SearchBar
                            value={search.searchTerm}
                            onChange={search.setSearchTerm}
                            onClear={search.clearSearch}
                            scope={search.scope}
                            onScopeToggle={search.toggleScope}
                            onFiltersClick={() => search.setIsFiltersOpen(true)}
                            activeFiltersCount={search.activeFiltersCount}
                            resultsCount={search.isSearchActive ? filteredDocuments.length : undefined}
                            currentCourseName={selectedCourse?.title}
                          />

                          {/* Nota: Filtros de artigos acessíveis via botão "Filtros" acima */}
                        </div>
                      </details>
                    </div>

                    {/* Banner Assistente IA - Compacto */}
                    <div className="mb-6">
                      <div className="relative overflow-hidden bg-gradient-to-r from-blue-600 to-cyan-600 rounded-xl shadow-lg border-2 border-blue-300">
                        <div className="relative p-4 lg:p-5">
                          <div className="flex items-center gap-4">
                            {/* Ícone */}
                            <div className="flex-shrink-0">
                              <div className="bg-white/20 backdrop-blur-sm p-3 rounded-lg">
                                <Bot className="w-8 h-8 text-white" />
                              </div>
                            </div>

                            {/* Conteúdo */}
                            <div className="flex-1">
                              <h3 className="text-lg lg:text-xl font-bold text-white mb-1">
                                Assistente IA com Busca Semântica
                              </h3>
                              <p className="text-sm text-white/90 mb-3">
                                Faça perguntas sobre seus documentos e receba respostas com citações
                              </p>
                            </div>

                            {/* Botão CTA */}
                            <a
                              href="/area-restrita/assistente"
                              className="hidden lg:flex items-center gap-2 bg-white text-blue-700 px-5 py-2.5 rounded-lg font-semibold text-sm shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200 group"
                            >
                              <Bot className="w-4 h-4 group-hover:rotate-12 transition-transform" />
                              Abrir Assistente
                            </a>
                          </div>

                          {/* Botão Mobile (full width) */}
                          <a
                            href="/area-restrita/assistente"
                            className="lg:hidden mt-3 flex items-center justify-center gap-2 bg-white text-blue-700 px-5 py-3 rounded-lg font-semibold text-sm shadow-lg"
                          >
                            <Bot className="w-4 h-4" />
                            Abrir Assistente IA
                          </a>
                        </div>
                      </div>
                    </div>

                    {/* Tabs de Navegação - Apenas sem busca ativa */}
                    {!search.isSearchActive && (
                      <div className="bg-white rounded-2xl shadow-lg border-2 border-gray-200 mb-6 overflow-hidden">
                        <div className="flex overflow-x-auto scrollbar-hide">
                          <button
                            onClick={() => setActiveTab('documentos')}
                            className={`flex items-center gap-2 px-6 py-4 font-semibold text-sm whitespace-nowrap transition-colors border-b-4 min-w-fit ${
                              activeTab === 'documentos'
                                ? 'border-blue-600 text-blue-600 bg-blue-50'
                                : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                            }`}
                          >
                            <FileText className="w-4 h-4" />
                            Documentos
                            <span className={`px-2 py-0.5 rounded-full text-xs ${
                              activeTab === 'documentos' ? 'bg-blue-200 text-blue-800' : 'bg-gray-200 text-gray-600'
                            }`}>
                              {selectedCourseDocuments.length}
                            </span>
                          </button>

                          <button
                            onClick={() => setActiveTab('lei')}
                            className={`flex items-center gap-2 px-6 py-4 font-semibold text-sm whitespace-nowrap transition-colors border-b-4 min-w-fit ${
                              activeTab === 'lei'
                                ? 'border-indigo-600 text-indigo-600 bg-indigo-50'
                                : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                            }`}
                          >
                            <Scale className="w-4 h-4" />
                            Lei 14.133
                          </button>

                          {glossaryResults.length > 0 && (
                            <button
                              onClick={() => setActiveTab('glossario')}
                              className={`flex items-center gap-2 px-6 py-4 font-semibold text-sm whitespace-nowrap transition-colors border-b-4 min-w-fit ${
                                activeTab === 'glossario'
                                  ? 'border-green-600 text-green-600 bg-green-50'
                                  : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                              }`}
                            >
                              <BookOpen className="w-4 h-4" />
                              Glossário
                              <span className={`px-2 py-0.5 rounded-full text-xs ${
                                activeTab === 'glossario' ? 'bg-green-200 text-green-800' : 'bg-gray-200 text-gray-600'
                              }`}>
                                {glossaryResults.length}
                              </span>
                            </button>
                          )}

                          {selectedCourseVideos.length > 0 && (
                            <button
                              onClick={() => setActiveTab('videos')}
                              className={`flex items-center gap-2 px-6 py-4 font-semibold text-sm whitespace-nowrap transition-colors border-b-4 min-w-fit ${
                                activeTab === 'videos'
                                  ? 'border-purple-600 text-purple-600 bg-purple-50'
                                  : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                              }`}
                            >
                              <Video className="w-4 h-4" />
                              Vídeos
                              <span className={`px-2 py-0.5 rounded-full text-xs ${
                                activeTab === 'videos' ? 'bg-purple-200 text-purple-800' : 'bg-gray-200 text-gray-600'
                              }`}>
                                {selectedCourseVideos.length}
                              </span>
                            </button>
                          )}

                          {selectedCourseSites.length > 0 && (
                            <button
                              onClick={() => setActiveTab('sites')}
                              className={`flex items-center gap-2 px-6 py-4 font-semibold text-sm whitespace-nowrap transition-colors border-b-4 min-w-fit ${
                                activeTab === 'sites'
                                  ? 'border-teal-600 text-teal-600 bg-teal-50'
                                  : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                              }`}
                            >
                              <Globe className="w-4 h-4" />
                              Sites Recomendados
                              <span className={`px-2 py-0.5 rounded-full text-xs ${
                                activeTab === 'sites' ? 'bg-teal-200 text-teal-800' : 'bg-gray-200 text-gray-600'
                              }`}>
                                {selectedCourseSites.length}
                              </span>
                            </button>
                          )}
                        </div>
                        <style jsx>{`
                          .scrollbar-hide::-webkit-scrollbar {
                            display: none;
                          }
                          .scrollbar-hide {
                            -ms-overflow-style: none;
                            scrollbar-width: none;
                          }
                        `}</style>
                      </div>
                    )}

                    {/* Top 10 Artigos Mais Consultados - Tab Lei */}
                    {!search.isSearchActive && activeTab === 'lei' && (
                      <div className="mb-6">
                        <TopArticlesWidget
                          limit={10}
                          showStats={true}
                          onArticleClick={(articleNum) => {
                            search.updateFilters({
                              leiArticles: [articleNum]
                            });
                          }}
                        />
                      </div>
                    )}

                    {/* Navegador da Estrutura da Lei - Tab Lei */}
                    {!search.isSearchActive && activeTab === 'lei' && (
                      <div className="mb-6">
                        <ArticleTreeNavigator
                          onArticleClick={(articleNum) => {
                            router.push(`/artigo/${articleNum}`);
                          }}
                        />
                      </div>
                    )}

                    {/* Materiais Destacados (Apostila, Conteúdo, Bibliografia) - Tab Documentos */}
                    {!search.isSearchActive && activeTab === 'documentos' && (
                      <HighlightedMaterials
                        documents={selectedCourseDocuments}
                        courseId={selectedCourse.id}
                        onDownload={(doc) => handleDownload(doc, selectedCourse.id)}
                      />
                    )}

                    {/* Resultados do Glossário - Apenas quando há busca ativa */}
                    {search.isSearchActive && glossaryResults.length > 0 && (
                      <GlossarySearchResults
                        terms={glossaryResults}
                        searchQuery={search.searchTerm}
                      />
                    )}

                    {/* Glossário - Tab Glossário */}
                    {!search.isSearchActive && activeTab === 'glossario' && glossaryResults.length > 0 && (
                      <GlossarySearchResults
                        terms={glossaryResults}
                        searchQuery={search.searchTerm}
                      />
                    )}

                    {/* Documentos Agrupados por Categoria - Tab Documentos ou quando há busca */}
                    {(search.isSearchActive || activeTab === 'documentos') && (
                      <DocumentsByCategory
                        documents={filteredDocuments}
                        courseId={selectedCourse.id}
                        onDocumentClick={handleDocumentClick}
                        isFavorite={isFavorite}
                        toggleFavorite={toggleFavorite}
                      />
                    )}

                    {/* Vídeos do YouTube - Tab Vídeos */}
                    {!search.isSearchActive && activeTab === 'videos' && selectedCourseVideos.length > 0 && (
                      <CourseVideos
                        videos={selectedCourseVideos}
                        displayMode="thumbnails"
                      />
                    )}

                    {/* Sites de Interesse - Tab Sites */}
                    {!search.isSearchActive && activeTab === 'sites' && (
                      <RecommendedSites sites={selectedCourseSites} />
                    )}
                  </div>
                ) : (
                  <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-6 lg:p-8 text-center">
                    <p className="text-base lg:text-lg text-blue-800 font-medium">
                      Selecione um curso na barra lateral para ver os materiais
                    </p>
                  </div>
                )}

                {/* Aviso Importante */}
                <div className="bg-gradient-to-r from-orange-50 to-red-50 border-l-4 border-orange-500 p-6 lg:p-6 rounded-r-xl mt-8">
                  <h3 className="text-base lg:text-lg font-bold mb-2 text-orange-900">Importante</h3>
                  <p className="text-sm lg:text-base text-orange-800 font-medium leading-relaxed">
                    Este material é de uso exclusivo dos alunos matriculados. O compartilhamento não autorizado pode resultar na suspensão do acesso.
                  </p>
                </div>
              </>
            ) : (
              /* Usuário sem matrícula */
              <div className="bg-white rounded-2xl shadow-lg p-6 lg:p-8 border-2 border-gray-200 text-center">
                <div className="w-20 h-20 bg-gradient-to-br from-blue-600 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
                  <GraduationCap className="w-10 h-10 text-white" />
                </div>
                <h2 className="text-xl lg:text-2xl font-bold text-gray-900 mb-3">Nenhum Curso Matriculado</h2>
                <p className="text-base lg:text-lg text-gray-700 mb-6 leading-relaxed">
                  Você ainda não está matriculado em nenhum curso. Entre em contato com o professor para receber seu QR Code de acesso.
                </p>
                {user.role === 'admin' && (
                  <a
                    href="/admin"
                    className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 lg:py-3 rounded-xl font-bold hover:from-blue-700 hover:to-purple-700 transition-all shadow-lg text-base"
                  >
                    Acessar Painel Admin
                  </a>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Filtros Avançados - Drawer Lateral */}
      <SearchFilters
        isOpen={search.isFiltersOpen}
        onClose={() => search.setIsFiltersOpen(false)}
        filters={search.filters}
        onUpdateFilters={search.updateFilters}
        onClearFilters={search.clearFilters}
        availableCourses={availableCourses}
      />

      {/* Modal de Detalhes do Documento */}
      {selectedDocument && selectedCourse && (
        <DocumentDetailModal
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          document={selectedDocument}
          courseTitle={selectedCourse.title}
          onDownload={() => handleDownload(selectedDocument, selectedCourse.id)}
          onView={selectedDocument.type === 'link' ? () => handleView(selectedDocument, selectedCourse.id) : undefined}
        />
      )}

      {/* Painel de Exportação PDF - Fase 3C */}
      <PDFExportPanel
        documents={selectedCourseDocuments}
        userName={user.name}
        userEmail={user.email}
        favoriteIds={favoriteIds}
      />

      {/* Bottom Navigation - apenas mobile */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t-2 border-gray-200 shadow-2xl z-50 pb-safe">
        <div className="flex items-center justify-around h-16">
          <a
            href="/area-restrita"
            className="flex flex-col items-center justify-center flex-1 h-full text-blue-600 hover:bg-blue-50 transition-colors"
          >
            <GraduationCap className="w-6 h-6 mb-1" />
            <span className="text-xs font-medium">Início</span>
          </a>
          <a
            href="/area-restrita/assistente"
            className="flex flex-col items-center justify-center flex-1 h-full text-gray-600 hover:text-purple-600 hover:bg-purple-50 transition-colors"
          >
            <Bot className="w-6 h-6 mb-1" />
            <span className="text-xs font-medium">IA</span>
          </a>
          <a
            href="/area-restrita/favoritos"
            className="flex flex-col items-center justify-center flex-1 h-full text-gray-600 hover:text-pink-600 hover:bg-pink-50 transition-colors"
          >
            <Heart className="w-6 h-6 mb-1" />
            <span className="text-xs font-medium">Favoritos</span>
          </a>
          <button
            onClick={handleLogout}
            className="flex flex-col items-center justify-center flex-1 h-full text-gray-600 hover:text-red-600 hover:bg-red-50 transition-colors"
          >
            <LogOut className="w-6 h-6 mb-1" />
            <span className="text-xs font-medium">Sair</span>
          </button>
        </div>
      </nav>
    </main>
  );
}
