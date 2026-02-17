'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Heart, Download, FileText, ArrowLeft, Trash2, BookOpen, Scale, ExternalLink, Calendar, Building, StickyNote, Check, Loader2 } from 'lucide-react';
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
  annotation: string | null;
  createdAt: string;
  document: Document | null;
}

interface LegislativeAct {
  id: string;
  title: string;
  fullNumber: string;
  type: string;
  issuer: string;
  publishDate: string;
  officialUrl: string | null;
  ementa: string;
  favoritedAt?: string;
}

interface GroupedFavorites {
  courseId: string;
  courseTitle: string;
  favorites: FavoriteWithDocument[];
}

interface ONFavorite {
  id: string;
  documentId: string;
  createdAt: string;
  document: Document;
}

const TYPE_LABELS: Record<string, string> = {
  'decreto': 'Decreto',
  'portaria': 'Portaria',
  'in': 'Instrução Normativa',
  'ordem-servico': 'Ordem de Serviço',
  'lei': 'Lei',
  'medida-provisoria': 'Medida Provisória',
  'orientacao-normativa': 'Orientação Normativa',
  'parecer-vinculante': 'Parecer Vinculante',
};

const TYPE_COLORS: Record<string, string> = {
  'decreto': 'bg-blue-100 text-blue-800',
  'portaria': 'bg-green-100 text-green-800',
  'in': 'bg-purple-100 text-purple-800',
  'ordem-servico': 'bg-yellow-100 text-yellow-800',
  'lei': 'bg-red-100 text-red-800',
  'medida-provisoria': 'bg-orange-100 text-orange-800',
  'orientacao-normativa': 'bg-indigo-100 text-indigo-800',
  'parecer-vinculante': 'bg-teal-100 text-teal-800',
};

export default function FavoritosPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const [favorites, setFavorites] = useState<FavoriteWithDocument[]>([]);
  const [onFavorites, setOnFavorites] = useState<ONFavorite[]>([]);
  const [legislativeActs, setLegislativeActs] = useState<LegislativeAct[]>([]);
  const [isLoadingFavorites, setIsLoadingFavorites] = useState(true);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'documents' | 'ons' | 'acts'>('documents');
  const [editingAnnotation, setEditingAnnotation] = useState<string | null>(null);
  const [annotationText, setAnnotationText] = useState('');
  const [savingAnnotation, setSavingAnnotation] = useState<string | null>(null);
  const [annotationTimers, setAnnotationTimers] = useState<Record<string, ReturnType<typeof setTimeout>>>({});

  // Redirecionar se não autenticado
  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login');
    }
  }, [isLoading, user, router]);

  // Buscar favoritos de documentos e atos
  useEffect(() => {
    const loadFavorites = async () => {
      if (!user) return;

      try {
        // Buscar favoritos de documentos e atos em paralelo
        const [docResponse, actResponse] = await Promise.all([
          fetch('/api/favorites'),
          fetch('/api/favorites/legislative-acts'),
        ]);

        // Processar documentos
        if (docResponse.ok) {
          const favData = await docResponse.json();
          const userFavorites = favData.favorites || [];

          const favoritesWithDocs = await Promise.all(
            userFavorites.map(async (fav: { id: string; documentId: string; courseId: string | null; createdAt: string }) => {
              try {
                const docFetchResponse = await fetch(`/api/documents/${fav.documentId}`);
                if (docFetchResponse.ok) {
                  const docData = await docFetchResponse.json();
                  return {
                    ...fav,
                    document: docData.document || docData,
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

          const validFavorites = favoritesWithDocs.filter(fav => fav.document !== null);

          // Separar ONs dos documentos regulares
          const ons = validFavorites.filter(fav => fav.document?.category === 'orientacao-normativa');
          const regularDocs = validFavorites.filter(fav => fav.document?.category !== 'orientacao-normativa');

          setFavorites(regularDocs);
          setOnFavorites(ons as ONFavorite[]);
        }

        // Processar atos normativos
        if (actResponse.ok) {
          const actData = await actResponse.json();
          setLegislativeActs(actData.favorites || []);
        }
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

  // Salvar anotacao com auto-save debounce
  const saveAnnotation = async (favoriteId: string, text: string) => {
    setSavingAnnotation(favoriteId);
    try {
      const response = await fetch(`/api/favorites/${favoriteId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ annotation: text || null }),
      });
      if (response.ok) {
        // Atualizar favorito no estado local
        setFavorites(prev => prev.map(fav =>
          fav.id === favoriteId ? { ...fav, annotation: text || null } : fav
        ));
        setOnFavorites(prev => prev.map(fav =>
          fav.id === favoriteId ? { ...fav, annotation: text || null } as typeof fav : fav
        ));
      }
    } catch (error) {
      console.error('Erro ao salvar anotacao:', error);
    } finally {
      setSavingAnnotation(null);
    }
  };

  const handleAnnotationChange = (favoriteId: string, text: string) => {
    setAnnotationText(text);
    // Limpar timer anterior
    if (annotationTimers[favoriteId]) {
      clearTimeout(annotationTimers[favoriteId]);
    }
    // Debounce de 1s
    const timer = setTimeout(() => {
      saveAnnotation(favoriteId, text);
    }, 1000);
    setAnnotationTimers(prev => ({ ...prev, [favoriteId]: timer }));
  };

  const toggleAnnotation = (favoriteId: string, currentAnnotation: string | null) => {
    if (editingAnnotation === favoriteId) {
      setEditingAnnotation(null);
    } else {
      setEditingAnnotation(favoriteId);
      setAnnotationText(currentAnnotation || '');
    }
  };

  // Remover favorito de documento
  const handleRemoveDocumentFavorite = async (documentId: string) => {
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

  // Remover favorito de ato normativo
  const handleRemoveActFavorite = async (actId: string) => {
    setRemovingId(actId);
    try {
      const response = await fetch(`/api/legislative-acts/${actId}/favorite`, {
        method: 'POST',
      });

      if (response.ok) {
        setLegislativeActs(prev => prev.filter(act => act.id !== actId));
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

  // Remover favorito de ON
  const handleRemoveONFavorite = async (documentId: string) => {
    setRemovingId(documentId);
    try {
      const response = await fetch(`/api/favorites?documentId=${documentId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setOnFavorites(prev => prev.filter(fav => fav.documentId !== documentId));
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

  const totalFavorites = favorites.length + onFavorites.length + legislativeActs.length;

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
                {totalFavorites} {totalFavorites === 1 ? 'item favoritado' : 'itens favoritados'}
              </p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        {totalFavorites > 0 && (
          <div className="flex flex-wrap gap-2 mb-6">
            <button
              onClick={() => setActiveTab('documents')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
                activeTab === 'documents'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
              }`}
            >
              <FileText className="w-4 h-4" />
              Documentos ({favorites.length})
            </button>
            <button
              onClick={() => setActiveTab('ons')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
                activeTab === 'ons'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
              }`}
            >
              <BookOpen className="w-4 h-4" />
              ONs - AGU ({onFavorites.length})
            </button>
            <button
              onClick={() => setActiveTab('acts')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
                activeTab === 'acts'
                  ? 'bg-purple-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
              }`}
            >
              <Scale className="w-4 h-4" />
              Atos Normativos ({legislativeActs.length})
            </button>
          </div>
        )}

        {/* Conteúdo */}
        {totalFavorites === 0 ? (
          <div className="bg-white rounded-2xl shadow-lg p-12 text-center border-2 border-gray-200">
            <Heart className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Nenhum favorito ainda</h2>
            <p className="text-gray-600 mb-6">
              Clique no coração ao lado dos documentos ou atos normativos para adicioná-los aos favoritos.
            </p>
            <button
              onClick={() => router.push('/area-restrita')}
              className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-xl font-bold hover:from-blue-700 hover:to-purple-700 transition-all shadow-lg"
            >
              Explorar Documentos
            </button>
          </div>
        ) : (
          <>
            {/* Tab de Documentos */}
            {activeTab === 'documents' && (
              <div className="space-y-8">
                {favorites.length === 0 ? (
                  <div className="bg-white rounded-2xl shadow-lg p-8 text-center border-2 border-gray-200">
                    <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-600">Nenhum documento favoritado ainda.</p>
                  </div>
                ) : (
                  groupedFavorites.map((group) => (
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
                                    <button
                                      onClick={() => toggleAnnotation(fav.id, fav.annotation)}
                                      className={`p-2 rounded-lg transition-colors ${
                                        fav.annotation
                                          ? 'text-amber-600 bg-amber-50 hover:bg-amber-100'
                                          : 'text-gray-400 hover:text-amber-600 hover:bg-amber-50'
                                      }`}
                                      title={fav.annotation ? 'Editar anotacao' : 'Adicionar anotacao'}
                                    >
                                      <StickyNote className="w-5 h-5" />
                                    </button>
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
                                      onClick={() => handleRemoveDocumentFavorite(fav.documentId)}
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

                                {/* Anotação expandível */}
                                {editingAnnotation === fav.id && (
                                  <div className="mt-3 pt-3 border-t border-gray-200">
                                    <div className="flex items-center justify-between mb-1">
                                      <label className="text-xs font-semibold text-gray-600">Anotacao de estudo</label>
                                      {savingAnnotation === fav.id ? (
                                        <span className="flex items-center gap-1 text-xs text-gray-400">
                                          <Loader2 className="w-3 h-3 animate-spin" />
                                          Salvando...
                                        </span>
                                      ) : annotationText !== (fav.annotation || '') ? null : fav.annotation ? (
                                        <span className="flex items-center gap-1 text-xs text-green-600">
                                          <Check className="w-3 h-3" />
                                          Salvo
                                        </span>
                                      ) : null}
                                    </div>
                                    <textarea
                                      value={annotationText}
                                      onChange={(e) => handleAnnotationChange(fav.id, e.target.value)}
                                      placeholder="Adicione suas anotacoes sobre este documento..."
                                      className="w-full p-3 text-sm border border-gray-300 rounded-lg resize-y min-h-[80px] max-h-[200px] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                                      maxLength={5000}
                                    />
                                    <p className="text-xs text-gray-400 mt-1 text-right">{annotationText.length}/5000</p>
                                  </div>
                                )}

                                {/* Mostrar anotação existente (quando não editando) */}
                                {editingAnnotation !== fav.id && fav.annotation && (
                                  <button
                                    onClick={() => toggleAnnotation(fav.id, fav.annotation)}
                                    className="mt-2 w-full text-left p-2 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800 hover:bg-amber-100 transition-colors"
                                  >
                                    <span className="font-medium text-xs text-amber-600 block mb-0.5">Anotacao:</span>
                                    <span className="line-clamp-2">{fav.annotation}</span>
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Tab de Orientações Normativas - AGU */}
            {activeTab === 'ons' && (
              <div className="space-y-4">
                {onFavorites.length === 0 ? (
                  <div className="bg-white rounded-2xl shadow-lg p-8 text-center border-2 border-gray-200">
                    <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-600">Nenhuma Orientação Normativa favoritada ainda.</p>
                    <Link
                      href="/area-restrita/lei-comentada"
                      className="inline-block mt-4 text-indigo-600 hover:text-indigo-700 font-medium"
                    >
                      Explorar Lei 14.133 Comentada
                    </Link>
                  </div>
                ) : (
                  <div className="bg-white rounded-2xl shadow-lg border-2 border-gray-200 overflow-hidden">
                    <div className="bg-gradient-to-r from-indigo-600 to-blue-600 text-white p-6">
                      <h2 className="text-2xl font-bold flex items-center gap-3">
                        <BookOpen className="w-7 h-7" />
                        Orientações Normativas - AGU
                      </h2>
                      <p className="text-indigo-100 mt-1">
                        {onFavorites.length} {onFavorites.length === 1 ? 'ON favoritada' : 'ONs favoritadas'}
                      </p>
                    </div>

                    <div className="p-6 space-y-4">
                      {onFavorites.map((fav) => (
                        <div
                          key={fav.id}
                          className="flex items-start gap-4 p-4 bg-gradient-to-r from-gray-50 to-white border-2 border-gray-200 rounded-xl hover:border-indigo-300 hover:shadow-md transition-all"
                        >
                          {/* Ícone */}
                          <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center flex-shrink-0 text-indigo-600">
                            <BookOpen className="w-6 h-6" />
                          </div>

                          {/* Conteúdo */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1">
                                <span className="inline-block px-2 py-0.5 bg-indigo-100 text-indigo-800 rounded text-xs font-medium mb-1">
                                  Orientação Normativa
                                </span>
                                <h3 className="font-bold text-gray-900 mb-1">{fav.document.title}</h3>
                                {fav.document.description && (
                                  <p className="text-sm text-gray-600 mb-2 line-clamp-2">
                                    {fav.document.description}
                                  </p>
                                )}
                                <span className="text-xs text-gray-500">
                                  Adicionado em {new Date(fav.createdAt).toLocaleDateString('pt-BR')}
                                </span>
                              </div>

                              {/* Ações */}
                              <div className="flex items-center gap-2 flex-shrink-0">
                                {fav.document.url && (
                                  <a
                                    href={fav.document.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                    title="Acessar documento oficial"
                                  >
                                    <ExternalLink className="w-5 h-5" />
                                  </a>
                                )}
                                <button
                                  onClick={() => handleRemoveONFavorite(fav.documentId)}
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
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Tab de Atos Normativos */}
            {activeTab === 'acts' && (
              <div className="space-y-4">
                {legislativeActs.length === 0 ? (
                  <div className="bg-white rounded-2xl shadow-lg p-8 text-center border-2 border-gray-200">
                    <Scale className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-600">Nenhum ato normativo favoritado ainda.</p>
                    <Link
                      href="/area-restrita/lei-comentada"
                      className="inline-block mt-4 text-blue-600 hover:text-blue-700 font-medium"
                    >
                      Explorar Lei 14.133 Comentada
                    </Link>
                  </div>
                ) : (
                  <div className="bg-white rounded-2xl shadow-lg border-2 border-gray-200 overflow-hidden">
                    <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-6">
                      <h2 className="text-2xl font-bold flex items-center gap-3">
                        <Scale className="w-7 h-7" />
                        Atos Normativos Favoritados
                      </h2>
                      <p className="text-indigo-100 mt-1">
                        {legislativeActs.length} {legislativeActs.length === 1 ? 'ato normativo' : 'atos normativos'}
                      </p>
                    </div>

                    <div className="p-6 space-y-4">
                      {legislativeActs.map((act) => {
                        const typeLabel = TYPE_LABELS[act.type] || act.type;
                        const typeColor = TYPE_COLORS[act.type] || 'bg-gray-100 text-gray-800';

                        return (
                          <div
                            key={act.id}
                            className="flex items-start gap-4 p-4 bg-gradient-to-r from-gray-50 to-white border-2 border-gray-200 rounded-xl hover:border-indigo-300 hover:shadow-md transition-all"
                          >
                            {/* Ícone */}
                            <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center flex-shrink-0 text-indigo-600">
                              <Scale className="w-6 h-6" />
                            </div>

                            {/* Conteúdo */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-4">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${typeColor}`}>
                                      {typeLabel}
                                    </span>
                                  </div>
                                  <h3 className="font-bold text-gray-900 mb-1">{act.fullNumber}</h3>
                                  <p className="text-sm text-gray-700 mb-2">{act.title}</p>
                                  <p className="text-xs text-gray-600 line-clamp-2 mb-2">{act.ementa}</p>
                                  <div className="flex items-center gap-4 text-xs text-gray-500">
                                    <span className="flex items-center gap-1">
                                      <Building className="w-3 h-3" />
                                      {act.issuer}
                                    </span>
                                    <span className="flex items-center gap-1">
                                      <Calendar className="w-3 h-3" />
                                      {new Date(act.publishDate).toLocaleDateString('pt-BR')}
                                    </span>
                                    {act.favoritedAt && (
                                      <span>
                                        Favoritado em {new Date(act.favoritedAt).toLocaleDateString('pt-BR')}
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {/* Ações */}
                                <div className="flex items-center gap-2 flex-shrink-0">
                                  {act.officialUrl && (
                                    <a
                                      href={act.officialUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                      title="Acessar documento oficial"
                                    >
                                      <ExternalLink className="w-5 h-5" />
                                    </a>
                                  )}
                                  <button
                                    onClick={() => handleRemoveActFavorite(act.id)}
                                    disabled={removingId === act.id}
                                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                                    title="Remover dos favoritos"
                                  >
                                    {removingId === act.id ? (
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
                )}
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
