'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Heart, Download, FileText, ArrowLeft, Trash2, BookOpen } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { courses } from '@/data/courses';

interface Document {
  id: string;
  title: string;
  description: string | null;
  type: string;
  category: string;
  url: string;
  uploadedAt: Date;
}

interface FavoriteWithDocument {
  id: string;
  documentId: string;
  courseId: string;
  createdAt: string;
  document: Document | null;
}

interface GroupedFavorites {
  courseId: string;
  courseTitle: string;
  favorites: FavoriteWithDocument[];
}

export default function FavoritosPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const [favorites, setFavorites] = useState<FavoriteWithDocument[]>([]);
  const [isLoadingFavorites, setIsLoadingFavorites] = useState(true);
  const [removingId, setRemovingId] = useState<string | null>(null);

  // Redirecionar se não autenticado
  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login');
    }
  }, [isLoading, user, router]);

  // Buscar favoritos e documentos
  useEffect(() => {
    const loadFavorites = async () => {
      if (!user) return;

      try {
        // Buscar favoritos do usuário
        const favResponse = await fetch('/api/favorites');
        if (!favResponse.ok) {
          throw new Error('Erro ao buscar favoritos');
        }

        const favData = await favResponse.json();
        const userFavorites = favData.favorites || [];

        // Buscar detalhes de cada documento
        const favoritesWithDocs = await Promise.all(
          userFavorites.map(async (fav: { id: string; documentId: string; courseId: string; createdAt: string }) => {
            try {
              const docResponse = await fetch(`/api/documents/${fav.documentId}`);
              if (docResponse.ok) {
                const docData = await docResponse.json();
                return {
                  ...fav,
                  document: docData.document,
                };
              }
            } catch (error) {
              console.error(`Erro ao buscar documento ${fav.documentId}:`, error);
            }
            return {
              ...fav,
              document: null,
            };
          })
        );

        // Filtrar favoritos com documentos válidos
        const validFavorites = favoritesWithDocs.filter(fav => fav.document !== null);
        setFavorites(validFavorites);
      } catch (error) {
        console.error('Erro ao carregar favoritos:', error);
      } finally {
        setIsLoadingFavorites(false);
      }
    };

    loadFavorites();
  }, [user]);

  // Agrupar favoritos por curso
  const groupedFavorites: GroupedFavorites[] = favorites.reduce((acc, fav) => {
    const existing = acc.find(g => g.courseId === fav.courseId);
    if (existing) {
      existing.favorites.push(fav);
    } else {
      const course = courses.find(c => c.id === fav.courseId);
      acc.push({
        courseId: fav.courseId,
        courseTitle: course?.title || 'Curso não encontrado',
        favorites: [fav],
      });
    }
    return acc;
  }, [] as GroupedFavorites[]);

  // Remover favorito
  const handleRemoveFavorite = async (documentId: string) => {
    setRemovingId(documentId);
    try {
      const response = await fetch(`/api/favorites?documentId=${documentId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setFavorites(prev => prev.filter(fav => fav.documentId !== documentId));
      } else {
        alert('Erro ao remover favorito');
      }
    } catch (error) {
      console.error('Erro ao remover favorito:', error);
      alert('Erro ao remover favorito');
    } finally {
      setRemovingId(null);
    }
  };

  // Download documento
  const handleDownload = async (doc: Document) => {
    try {
      const response = await fetch(`/api/documents/${doc.id}/download`);
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = doc.title;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (error) {
      console.error('Erro ao baixar documento:', error);
    }
  };

  // Ícone por categoria
  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'apostila':
      case 'conteudo-programatico':
      case 'bibliografia':
        return <BookOpen className="w-5 h-5" />;
      default:
        return <FileText className="w-5 h-5" />;
    }
  };

  // Label da categoria
  const getCategoryLabel = (category: string) => {
    const labels: Record<string, string> = {
      'apostila': 'Apostila',
      'acordao': 'Acórdão',
      'parecer': 'Parecer',
      'edital': 'Edital',
      'artigo': 'Artigo',
      'conteudo-programatico': 'Conteúdo Programático',
      'bibliografia': 'Bibliografia',
      'outro': 'Outro',
    };
    return labels[category] || category;
  };

  if (isLoading || isLoadingFavorites) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando favoritos...</p>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 py-12 px-4">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => router.push('/area-restrita')}
            className="flex items-center gap-2 text-gray-700 hover:text-blue-600 mb-6 font-medium transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            Voltar para área restrita
          </button>

          <div className="flex items-center gap-4 mb-4">
            <div className="w-16 h-16 bg-gradient-to-br from-pink-500 to-red-500 rounded-full flex items-center justify-center shadow-lg">
              <Heart className="w-8 h-8 text-white fill-current" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Meus Favoritos</h1>
              <p className="text-gray-600">
                {favorites.length} {favorites.length === 1 ? 'documento favoritado' : 'documentos favoritados'}
              </p>
            </div>
          </div>
        </div>

        {/* Conteúdo */}
        {favorites.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-lg p-12 text-center border-2 border-gray-200">
            <Heart className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Nenhum favorito ainda</h2>
            <p className="text-gray-600 mb-6">
              Clique no coração ao lado dos documentos para adicioná-los aos favoritos.
            </p>
            <button
              onClick={() => router.push('/area-restrita')}
              className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-xl font-bold hover:from-blue-700 hover:to-purple-700 transition-all shadow-lg"
            >
              Explorar Documentos
            </button>
          </div>
        ) : (
          <div className="space-y-8">
            {groupedFavorites.map((group) => (
              <div key={group.courseId} className="bg-white rounded-2xl shadow-lg border-2 border-gray-200 overflow-hidden">
                {/* Header do Curso */}
                <div className="bg-gradient-to-r from-blue-500 to-purple-500 text-white p-6">
                  <h2 className="text-2xl font-bold">{group.courseTitle}</h2>
                  <p className="text-blue-100 mt-1">
                    {group.favorites.length} {group.favorites.length === 1 ? 'documento' : 'documentos'}
                  </p>
                </div>

                {/* Lista de Documentos */}
                <div className="p-6 space-y-4">
                  {group.favorites.map((fav) => {
                    if (!fav.document) return null;

                    return (
                      <div
                        key={fav.id}
                        className="flex items-start gap-4 p-4 bg-gradient-to-r from-gray-50 to-white border-2 border-gray-200 rounded-xl hover:border-blue-300 hover:shadow-md transition-all"
                      >
                        {/* Ícone */}
                        <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0 text-blue-600">
                          {getCategoryIcon(fav.document.category)}
                        </div>

                        {/* Conteúdo */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <h3 className="font-bold text-gray-900 mb-1">{fav.document.title}</h3>
                              {fav.document.description && (
                                <p className="text-sm text-gray-600 mb-2 line-clamp-2">
                                  {fav.document.description}
                                </p>
                              )}
                              <div className="flex items-center gap-3 flex-wrap">
                                <span className="inline-block px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
                                  {getCategoryLabel(fav.document.category)}
                                </span>
                                <span className="text-xs text-gray-500">
                                  Adicionado em {new Date(fav.createdAt).toLocaleDateString('pt-BR')}
                                </span>
                              </div>
                            </div>

                            {/* Ações */}
                            <div className="flex items-center gap-2 flex-shrink-0">
                              {fav.document.type === 'pdf' && (
                                <button
                                  onClick={() => handleDownload(fav.document!)}
                                  className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                  title="Baixar documento"
                                >
                                  <Download className="w-5 h-5" />
                                </button>
                              )}
                              <button
                                onClick={() => handleRemoveFavorite(fav.documentId)}
                                disabled={removingId === fav.documentId}
                                className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                                title="Remover dos favoritos"
                              >
                                {removingId === fav.documentId ? (
                                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-red-600"></div>
                                ) : (
                                  <Trash2 className="w-5 h-5" />
                                )}
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
