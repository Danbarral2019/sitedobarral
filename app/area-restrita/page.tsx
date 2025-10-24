'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, LogOut, Clock, GraduationCap, CheckCircle, Heart } from 'lucide-react';
import { courses } from '@/data/courses';
import { useAuth } from '@/hooks/use-auth';
import { useFavorites } from '@/hooks/use-favorites';
import EnrollmentStatusBanner from '@/components/EnrollmentStatusBanner';
import CoursesSidebar from '@/components/CoursesSidebar';
import HighlightedMaterials from '@/components/HighlightedMaterials';
import DocumentsByCategory from '@/components/DocumentsByCategory';
import DocumentDetailModal from '@/components/DocumentDetailModal';
import CourseVideos from '@/components/CourseVideos';
import RecommendedSites from '@/components/RecommendedSites';

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
  const { isFavorite, toggleFavorite } = useFavorites();

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

  // Buscar documentos, vídeos e sites dos cursos matriculados
  useEffect(() => {
    const fetchCourseData = async () => {
      if (!user) return;

      const userEnrollments = user.enrollments || [];
      const enrolledCourseIds = user.role === 'admin'
        ? courses.map(c => c.id)
        : userEnrollments.map(e => e.courseId);

      // Buscar documentos
      const docsPromises = enrolledCourseIds.map(async (courseId) => {
        try {
          const response = await fetch(`/api/documents?courseId=${courseId}`);
          if (response.ok) {
            const data = await response.json();
            return { courseId, documents: data.documents || [] };
          }
        } catch (error) {
          console.error(`Erro ao buscar documentos do curso ${courseId}:`, error);
        }
        return { courseId, documents: [] };
      });

      // Buscar vídeos
      const videosPromises = enrolledCourseIds.map(async (courseId) => {
        try {
          const response = await fetch(`/api/course-videos?courseId=${courseId}`);
          if (response.ok) {
            const data = await response.json();
            return { courseId, videos: data.videos || [] };
          }
        } catch (error) {
          console.error(`Erro ao buscar vídeos do curso ${courseId}:`, error);
        }
        return { courseId, videos: [] };
      });

      // Buscar sites
      const sitesPromises = enrolledCourseIds.map(async (courseId) => {
        try {
          const response = await fetch(`/api/recommended-sites?courseId=${courseId}`);
          if (response.ok) {
            const data = await response.json();
            return { courseId, sites: data.sites || [] };
          }
        } catch (error) {
          console.error(`Erro ao buscar sites do curso ${courseId}:`, error);
        }
        return { courseId, sites: [] };
      });

      // Aguardar todas as requisições
      const [docsResults, videosResults, sitesResults] = await Promise.all([
        Promise.all(docsPromises),
        Promise.all(videosPromises),
        Promise.all(sitesPromises),
      ]);

      // Mapear documentos
      const docsMap: Record<string, DocumentType[]> = {};
      docsResults.forEach(({ courseId, documents }) => {
        docsMap[courseId] = documents as DocumentType[];
      });
      setCourseDocuments(docsMap);

      // Mapear vídeos
      const videosMap: Record<string, VideoType[]> = {};
      videosResults.forEach(({ courseId, videos }) => {
        videosMap[courseId] = videos as VideoType[];
      });
      setCourseVideos(videosMap);

      // Mapear sites
      const sitesMap: Record<string, SiteType[]> = {};
      sitesResults.forEach(({ courseId, sites }) => {
        sitesMap[courseId] = sites as SiteType[];
      });
      setCourseSites(sitesMap);

      // Selecionar primeiro curso automaticamente
      if (enrolledCourseIds.length > 0 && !selectedCourseId) {
        setSelectedCourseId(enrolledCourseIds[0]);
      }
    };

    fetchCourseData();
  }, [user, selectedCourseId]);

  const handleLogout = async () => {
    await logout();
  };

  // Loading state
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

  // Not authenticated
  if (!user) {
    return null;
  }

  // Pega os cursos que o usuário está matriculado
  const userEnrollments = user.enrollments || [];
  const enrolledCourseIds = user.role === 'admin'
    ? courses.map(c => c.id)
    : userEnrollments.map(e => e.courseId);

  // TODOS os cursos com flag isEnrolled
  const allCoursesWithEnrollment = courses.map(course => ({
    ...course,
    isEnrolled: enrolledCourseIds.includes(course.id),
  }));

  // Curso selecionado atual
  const selectedCourse = courses.find(c => c.id === selectedCourseId);
  const isSelectedCourseEnrolled = selectedCourse ? enrolledCourseIds.includes(selectedCourse.id) : false;
  const selectedCourseDocuments = selectedCourseId && isSelectedCourseEnrolled ? (courseDocuments[selectedCourseId] || []) : [];
  const selectedCourseVideos = selectedCourseId && isSelectedCourseEnrolled ? (courseVideos[selectedCourseId] || []) : [];
  const selectedCourseSites = selectedCourseId && isSelectedCourseEnrolled ? (courseSites[selectedCourseId] || []) : [];
  const selectedEnrollment = userEnrollments.find(e => e.courseId === selectedCourseId);

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
        <div className="flex-1 p-4 lg:p-8 lg:ml-80">
          <div className="max-w-5xl mx-auto">
            {/* Header com info do usuário */}
            <div className="bg-white rounded-2xl shadow-lg p-6 mb-8 border-2 border-gray-200">
              <div className="flex justify-between items-start flex-wrap gap-4">
                <div className="flex items-start gap-4">
                  <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-green-700 rounded-full flex items-center justify-center shadow-lg flex-shrink-0">
                    <CheckCircle className="w-8 h-8 text-white" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-1">Bem-vindo, {user.name}</h2>
                    <p className="text-gray-700 font-medium">
                      {enrolledCourseIds.length} {enrolledCourseIds.length === 1 ? 'curso' : 'cursos'} matriculado{enrolledCourseIds.length !== 1 ? 's' : ''}
                    </p>
                    <p className="text-sm text-gray-600 mt-1">{user.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <a
                    href="/area-restrita/favoritos"
                    className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:text-pink-600 hover:bg-pink-50 rounded-lg transition-colors font-medium"
                  >
                    <Heart className="w-4 h-4" />
                    Favoritos
                  </a>
                  <a
                    href="/area-restrita/historico"
                    className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors font-medium"
                  >
                    <Clock className="w-4 h-4" />
                    Histórico
                  </a>
                  <button
                    onClick={handleLogout}
                    className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors font-medium"
                  >
                    <LogOut className="w-4 h-4" />
                    Sair
                  </button>
                </div>
              </div>
            </div>

            {/* Conteúdo do Curso Selecionado */}
            {enrolledCourseIds.length > 0 ? (
              <>
                {selectedCourse && isSelectedCourseEnrolled ? (
                  <div>
                    {/* Banner de Status */}
                    <EnrollmentStatusBanner courseId={selectedCourse.id} />

                    {/* Informações do Curso */}
                    <div className="bg-white rounded-2xl shadow-lg p-8 mb-6 border-2 border-gray-200">
                      <div className="flex items-center justify-between mb-4 flex-wrap gap-4">
                        <div className="inline-block">
                          <h1 className="text-3xl font-bold mb-2 text-gray-900">{selectedCourse.title}</h1>
                          <div className="h-1 w-32 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full"></div>
                        </div>
                        {selectedEnrollment?.turma && (
                          <div className="bg-blue-50 px-4 py-2 rounded-lg border border-blue-200">
                            <p className="text-sm text-blue-900 font-medium flex items-center gap-2">
                              <GraduationCap className="w-4 h-4" />
                              Turma: {selectedEnrollment.turma}
                            </p>
                          </div>
                        )}
                      </div>
                      <p className="text-gray-700 text-lg leading-relaxed mb-4">
                        {selectedCourse.description}
                      </p>
                      <div className="flex items-center gap-2 text-gray-600">
                        <Clock className="w-4 h-4" />
                        <span className="text-sm font-medium">Duração: {selectedCourse.duration}</span>
                      </div>
                    </div>

                    {/* Materiais Destacados (Apostila, Conteúdo, Bibliografia) */}
                    <HighlightedMaterials
                      documents={selectedCourseDocuments}
                      courseId={selectedCourse.id}
                      onDownload={(doc) => handleDownload(doc, selectedCourse.id)}
                    />

                    {/* Vídeos do YouTube (se houver) */}
                    <CourseVideos
                      videos={selectedCourseVideos}
                      displayMode="thumbnails"
                    />
                    {/*
                      💡 NOTA: displayMode pode ser "thumbnails" ou "embedded"
                      - thumbnails: Grid de thumbnails que abrem modal ao clicar
                      - embedded: Players do YouTube direto na página
                      Altere acima para testar as duas opções!
                    */}

                    {/* Documentos Agrupados por Categoria */}
                    <DocumentsByCategory
                      documents={selectedCourseDocuments}
                      courseId={selectedCourse.id}
                      onDocumentClick={handleDocumentClick}
                      isFavorite={isFavorite}
                      toggleFavorite={toggleFavorite}
                    />

                    {/* Sites de Interesse (sempre por último) */}
                    <RecommendedSites sites={selectedCourseSites} />
                  </div>
                ) : (
                  <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-8 text-center">
                    <p className="text-blue-800 font-medium">
                      Selecione um curso na barra lateral para ver os materiais
                    </p>
                  </div>
                )}

                {/* Aviso Importante */}
                <div className="bg-gradient-to-r from-orange-50 to-red-50 border-l-4 border-orange-500 p-6 rounded-r-xl mt-8">
                  <h3 className="text-lg font-bold mb-2 text-orange-900">Importante</h3>
                  <p className="text-orange-800 font-medium">
                    Este material é de uso exclusivo dos alunos matriculados. O compartilhamento não autorizado pode resultar na suspensão do acesso.
                  </p>
                </div>
              </>
            ) : (
              /* Usuário sem matrícula */
              <div className="bg-white rounded-2xl shadow-lg p-8 border-2 border-gray-200 text-center">
                <div className="w-20 h-20 bg-gradient-to-br from-blue-600 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
                  <GraduationCap className="w-10 h-10 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-3">Nenhum Curso Matriculado</h2>
                <p className="text-gray-700 mb-6">
                  Você ainda não está matriculado em nenhum curso. Entre em contato com o professor para receber seu QR Code de acesso.
                </p>
                {user.role === 'admin' && (
                  <a
                    href="/admin"
                    className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-xl font-bold hover:from-blue-700 hover:to-purple-700 transition-all shadow-lg"
                  >
                    Acessar Painel Admin
                  </a>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

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
    </main>
  );
}
