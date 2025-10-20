'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  FileText, Video, ExternalLink, Download, CheckCircle,
  Loader2, LogOut, BookOpen, GraduationCap, Clock, Heart
} from 'lucide-react';
import { courses } from '@/data/courses';
import { useAuth } from '@/hooks/use-auth';
import { useFavorites } from '@/hooks/use-favorites';
import EnrollmentStatusBanner from '@/components/EnrollmentStatusBanner';
import DocumentFilters, { DocumentFilterState } from '@/components/DocumentFilters';
import { Pagination } from '@/components/ui/pagination';

export default function AreaRestritaPage() {
  const router = useRouter();
  const { user, isLoading, logout } = useAuth();
  const { favorites, isFavorite, toggleFavorite } = useFavorites();

  // Estado dos filtros
  const [filters, setFilters] = useState<DocumentFilterState>({
    searchQuery: '',
    category: '',
    type: '',
    sortBy: 'recent',
  });

  // Estado da paginação (por curso)
  const [currentPages, setCurrentPages] = useState<Record<string, number>>({});
  const DOCS_PER_PAGE = 6;

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

  // Função para lidar com download
  const handleDownload = (doc: Record<string, unknown>, courseId: string) => {
    logAccess('download', courseId, doc.id);
  };

  // Função para lidar com visualização de link
  const handleView = (doc: Record<string, unknown>, courseId: string) => {
    logAccess('view', courseId, doc.id);
  };

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login');
    }
  }, [isLoading, user, router]);

  const handleLogout = async () => {
    await logout();
  };

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

  if (!user) {
    return null; // Redirecionando...
  }

  // Pega os cursos que o usuário está matriculado
  const userEnrollments = user.enrollments || [];
  const userCourses = userEnrollments.map(enrollment =>
    courses.find(c => c.id === enrollment.courseId)
  ).filter(Boolean);

  // Função para filtrar e ordenar documentos
  const filterDocuments = useMemo(() => {  // eslint-disable-line react-hooks/rules-of-hooks
    return (docs: unknown[]) => {
      let filtered = [...docs];

      // Filtro de busca (título ou descrição)
      if (filters.searchQuery) {
        const query = filters.searchQuery.toLowerCase();
        filtered = filtered.filter(
          (doc) =>
            doc.title.toLowerCase().includes(query) ||
            (doc.description && doc.description.toLowerCase().includes(query))
        );
      }

      // Filtro de categoria
      if (filters.category) {
        filtered = filtered.filter((doc) => doc.category === filters.category);
      }

      // Filtro de tipo
      if (filters.type) {
        filtered = filtered.filter((doc) => doc.type === filters.type);
      }

      // Ordenação
      filtered.sort((a, b) => {
        switch (filters.sortBy) {
          case 'title':
            return a.title.localeCompare(b.title);
          case 'category':
            return a.category.localeCompare(b.category);
          case 'recent':
          default:
            // Assumindo que docs mais recentes têm IDs maiores
            return b.id.localeCompare(a.id);
        }
      });

      return filtered;
    };
  }, [filters]);

  return (
    <main className="py-12 bg-gradient-to-br from-blue-50 via-white to-purple-50 min-h-screen">
      <div className="container mx-auto px-4">
        <div className="max-w-6xl mx-auto">
          {/* Header com info do usuário */}
          <div className="bg-white rounded-2xl shadow-lg p-6 mb-8 border-2 border-gray-200">
            <div className="flex justify-between items-start">
              <div className="flex items-start gap-4">
                <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-green-700 rounded-full flex items-center justify-center shadow-lg">
                  <CheckCircle className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-1">Bem-vindo, {user.name}</h2>
                  <p className="text-gray-700 font-medium">
                    {userCourses.length} {userCourses.length === 1 ? 'curso' : 'cursos'} matriculado{userCourses.length !== 1 ? 's' : ''}
                  </p>
                  <p className="text-sm text-gray-600 mt-1">
                    {user.email}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
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

          {userCourses.length > 0 ? (
            <>
              {/* Seção de Favoritos */}
              {favorites.length > 0 && (
                <div className="bg-white rounded-2xl shadow-lg p-8 mb-8 border-2 border-red-200">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 bg-gradient-to-br from-red-500 to-pink-600 rounded-lg flex items-center justify-center">
                      <Heart className="w-5 h-5 text-white fill-current" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-gray-900">Meus Favoritos</h2>
                      <p className="text-sm text-gray-600">
                        {favorites.length} documento{favorites.length !== 1 ? 's' : ''} favorito{favorites.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>

                  <div className="grid md:grid-cols-3 gap-4">
                    {favorites.slice(0, 6).map((fav) => {
                      // Buscar o curso e documento correspondentes
                      const course = userCourses.find(c => c?.id === fav.courseId);
                      const doc = course?.restrictedDocuments?.find(d => d.id === fav.documentId);

                      if (!doc || !course) return null;

                      return (
                        <div
                          key={fav.id}
                          className="bg-gradient-to-r from-red-50 to-pink-50 rounded-lg p-4 border-2 border-red-200 hover:border-red-300 transition-all"
                        >
                          <div className="flex items-start gap-2 mb-2">
                            <div className="w-8 h-8 bg-gradient-to-br from-red-500 to-pink-600 rounded-lg flex items-center justify-center flex-shrink-0">
                              {doc.type === 'video' ? (
                                <Video className="w-4 h-4 text-white" />
                              ) : (
                                <FileText className="w-4 h-4 text-white" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="font-bold text-sm text-gray-900 line-clamp-2">{doc.title}</h4>
                              <p className="text-xs text-gray-600 mt-1">{course.title}</p>
                            </div>
                          </div>
                          <div className="flex gap-2 mt-3">
                            {doc.type === 'link' && doc.url ? (
                              <a
                                href={doc.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={() => handleView(doc, course.id)}
                                className="flex-1 bg-gradient-to-r from-red-600 to-pink-600 text-white px-3 py-1.5 rounded text-xs font-bold hover:from-red-700 hover:to-pink-700 transition-all flex items-center justify-center gap-1"
                              >
                                <ExternalLink className="w-3 h-3" />
                                Acessar
                              </a>
                            ) : (
                              <a
                                href={`/api/documents/${doc.id}/download`}
                                onClick={() => handleDownload(doc, course.id)}
                                className="flex-1 bg-gradient-to-r from-red-600 to-pink-600 text-white px-3 py-1.5 rounded text-xs font-bold hover:from-red-700 hover:to-pink-700 transition-all flex items-center justify-center gap-1"
                              >
                                <Download className="w-3 h-3" />
                                Download
                              </a>
                            )}
                            <button
                              onClick={() => toggleFavorite(doc.id, course.id)}
                              className="p-1.5 text-red-600 bg-red-100 hover:bg-red-200 rounded transition-colors"
                              title="Remover dos favoritos"
                            >
                              <Heart className="w-3 h-3 fill-current" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Lista de cursos matriculados */}
              {userCourses.map((course) => {
                if (!course) return null;

                const enrollment = userEnrollments.find(e => e.courseId === course.id);
                const restrictedDocs = course.restrictedDocuments || [];
                const filteredDocs = filterDocuments(restrictedDocs);

                // Paginação
                const currentPage = currentPages[course.id] || 1;
                const totalPages = Math.ceil(filteredDocs.length / DOCS_PER_PAGE);
                const startIndex = (currentPage - 1) * DOCS_PER_PAGE;
                const endIndex = startIndex + DOCS_PER_PAGE;
                const paginatedDocs = filteredDocs.slice(startIndex, endIndex);

                const handlePageChange = (page: number) => {
                  setCurrentPages(prev => ({ ...prev, [course.id]: page }));
                };

                return (
                  <div key={course.id} className="mb-8">
                    {/* Banner de Status do Acesso */}
                    <EnrollmentStatusBanner courseId={course.id} />

                    {/* Informações do Curso */}
                    <div className="bg-white rounded-2xl shadow-lg p-8 mb-6 border-2 border-gray-200">
                      <div className="flex items-center justify-between mb-4">
                        <div className="inline-block">
                          <h1 className="text-3xl font-bold mb-2 text-gray-900">{course.title}</h1>
                          <div className="h-1 w-32 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full"></div>
                        </div>
                        {enrollment?.turma && (
                          <div className="bg-blue-50 px-4 py-2 rounded-lg border border-blue-200">
                            <p className="text-sm text-blue-900 font-medium flex items-center gap-2">
                              <GraduationCap className="w-4 h-4" />
                              Turma: {enrollment.turma}
                            </p>
                          </div>
                        )}
                      </div>
                      <p className="text-gray-700 text-lg leading-relaxed mb-4">
                        {course.description}
                      </p>
                      <div className="flex items-center gap-2 text-gray-600">
                        <Clock className="w-4 h-4" />
                        <span className="text-sm font-medium">Duração: {course.duration}</span>
                      </div>
                    </div>

                    {/* Bibliografia (sempre pública) */}
                    {course.bibliography && course.bibliography.length > 0 && (
                      <div className="bg-white rounded-2xl shadow-lg p-8 mb-6 border-2 border-gray-200">
                        <div className="flex items-center gap-3 mb-6">
                          <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-purple-700 rounded-lg flex items-center justify-center">
                            <BookOpen className="w-5 h-5 text-white" />
                          </div>
                          <h2 className="text-2xl font-bold text-gray-900">Bibliografia Recomendada</h2>
                        </div>
                        <ul className="space-y-3">
                          {course.bibliography.map((book, index) => (
                            <li key={index} className="flex items-start gap-3 p-3 bg-purple-50 rounded-lg border-l-4 border-purple-500">
                              <span className="text-purple-700 font-bold flex-shrink-0">{index + 1}.</span>
                              <span className="text-gray-800 font-medium">{book}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Filtros de Documentos */}
                    {restrictedDocs.length > 0 && (
                      <DocumentFilters
                        filters={filters}
                        onFilterChange={setFilters}
                      />
                    )}

                    {/* Materiais Restritos */}
                    {restrictedDocs.length > 0 ? (
                      <div className="bg-white rounded-2xl shadow-lg p-8 mb-6 border-2 border-gray-200">
                        <div className="flex items-center justify-between mb-6">
                          <div className="inline-block">
                            <h2 className="text-2xl font-bold mb-2 text-gray-900">Materiais Exclusivos</h2>
                            <div className="h-1 w-24 bg-gradient-to-r from-blue-600 to-green-600 rounded-full"></div>
                          </div>
                          <div className="text-sm text-gray-600 font-medium">
                            {filteredDocs.length} de {restrictedDocs.length} documento{filteredDocs.length !== 1 ? 's' : ''}
                          </div>
                        </div>

                        {filteredDocs.length > 0 ? (
                          <>
                            <div className="grid md:grid-cols-2 gap-6">
                              {paginatedDocs.map((doc) => (
                            <div
                              key={doc.id}
                              className="bg-gradient-to-r from-blue-50 to-cyan-50 rounded-xl p-6 border-2 border-blue-200 hover:border-blue-400 hover:shadow-lg transition-all"
                            >
                              <div className="flex items-start justify-between mb-3">
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-700 rounded-lg flex items-center justify-center flex-shrink-0">
                                    {doc.type === 'video' ? (
                                      <Video className="w-5 h-5 text-white" />
                                    ) : (
                                      <FileText className="w-5 h-5 text-white" />
                                    )}
                                  </div>
                                  <div>
                                    <h3 className="font-bold text-gray-900">{doc.title}</h3>
                                    <span className="text-xs text-gray-600 font-medium">
                                      {doc.category}
                                    </span>
                                  </div>
                                </div>
                                <button
                                  onClick={() => toggleFavorite(doc.id, course.id)}
                                  className={`p-2 rounded-lg transition-colors ${
                                    isFavorite(doc.id)
                                      ? 'text-red-600 bg-red-50 hover:bg-red-100'
                                      : 'text-gray-400 hover:text-red-600 hover:bg-red-50'
                                  }`}
                                  title={isFavorite(doc.id) ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
                                >
                                  <Heart className={`w-5 h-5 ${isFavorite(doc.id) ? 'fill-current' : ''}`} />
                                </button>
                              </div>

                              {doc.description && (
                                <p className="text-sm text-gray-700 mb-4">{doc.description}</p>
                              )}

                              <div className="flex gap-2">
                                {doc.type === 'link' && doc.url ? (
                                  <a
                                    href={doc.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={() => handleView(doc, course.id)}
                                    className="flex-1 bg-gradient-to-r from-blue-600 to-blue-700 text-white px-4 py-2 rounded-lg text-sm font-bold hover:from-blue-700 hover:to-blue-800 transition-all flex items-center justify-center gap-2"
                                  >
                                    <ExternalLink className="w-4 h-4" />
                                    Acessar
                                  </a>
                                ) : (
                                  <a
                                    href={`/api/documents/${doc.id}/download`}
                                    onClick={() => handleDownload(doc, course.id)}
                                    className="flex-1 bg-gradient-to-r from-blue-600 to-blue-700 text-white px-4 py-2 rounded-lg text-sm font-bold hover:from-blue-700 hover:to-blue-800 transition-all flex items-center justify-center gap-2"
                                  >
                                    <Download className="w-4 h-4" />
                                    Download
                                  </a>
                                )}
                              </div>
                            </div>
                          ))}
                            </div>

                            {/* Paginação */}
                            {totalPages > 1 && (
                              <Pagination
                                currentPage={currentPage}
                                totalPages={totalPages}
                                onPageChange={handlePageChange}
                                itemsPerPage={DOCS_PER_PAGE}
                                totalItems={filteredDocs.length}
                              />
                            )}
                          </>
                        ) : (
                          <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-8 text-center">
                            <p className="text-blue-800 font-medium mb-2">
                              Nenhum documento encontrado com os filtros aplicados
                            </p>
                            <p className="text-sm text-blue-700">
                              Tente ajustar os filtros ou limpar a busca
                            </p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="bg-yellow-50 border-2 border-yellow-200 rounded-xl p-6 text-center mb-6">
                        <p className="text-yellow-800 font-medium">
                          Não há materiais exclusivos disponíveis para este curso no momento.
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Aviso Importante */}
              <div className="bg-gradient-to-r from-orange-50 to-red-50 border-l-4 border-orange-500 p-6 rounded-r-xl">
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
    </main>
  );
}
