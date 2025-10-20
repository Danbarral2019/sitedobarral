'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Plus, Loader2, Eye, Edit, Trash2, Calendar, CheckCircle, XCircle, BookOpen, FileText
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Pagination } from '@/components/ui/pagination';
import AdminLayout from '@/components/AdminLayout';

interface PublicationData {
  id: string;
  type: string;
  title: string;
  description: string;
  author: string;
  publishedAt: string;
  isPublished: boolean;
  publisher?: string | null;
  journal?: string | null;
  eventDate?: string | null;
  location?: string | null;
  createdAt: string;
  updatedAt: string;
}

export default function AdminPublicacoesPage() {
  const router = useRouter();
  const { success, error: errorToast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [publications, setPublications] = useState<PublicationData[]>([]);
  const [filteredPublications, setFilteredPublications] = useState<PublicationData[]>([]);
  const [filterType, setFilterType] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    verifyAdmin();
    loadPublications();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (filterType === 'all') {
      setFilteredPublications(publications);
    } else {
      setFilteredPublications(publications.filter(p => p.type === filterType));
    }
    setCurrentPage(1);
  }, [filterType, publications]);

  const verifyAdmin = async () => {
    try {
      const response = await fetch('/api/auth/verify');

      if (!response.ok) {
        router.push('/validar-acesso');
        return;
      }

      const data = await response.json();

      if (data.user.role !== 'admin') {
        router.push('/area-restrita');
        return;
      }
    } catch (error) {
      console.error('Erro ao verificar admin:', error);
      router.push('/validar-acesso');
    } finally {
      setIsLoading(false);
    }
  };

  const loadPublications = async () => {
    try {
      const response = await fetch('/api/admin/publications');
      const data = await response.json();
      setPublications(data.publications || []);
    } catch (error) {
      console.error('Erro ao carregar publicações:', error);
      errorToast('Erro ao carregar publicações', 'Tente novamente.');
    }
  };

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`Tem certeza que deseja deletar "${title}"?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/publications/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Erro ao deletar publicação');
      }

      success('Publicação deletada!', 'A publicação foi removida com sucesso.');
      loadPublications();
    } catch (error) {
      console.error('Erro ao deletar publicação:', error);
      errorToast('Erro ao deletar', 'Tente novamente.');
    }
  };

  const getTypeLabel = (type: string) => {
    const types: Record<string, string> = {
      livro: 'Livro',
      artigo: 'Artigo',
      noticia: 'Notícia'
    };
    return types[type] || type;
  };

  const getTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      livro: 'bg-blue-100 text-blue-800',
      artigo: 'bg-purple-100 text-purple-800',
      noticia: 'bg-pink-100 text-pink-800'
    };
    return colors[type] || 'bg-gray-100 text-gray-800';
  };

  // Calcular paginação
  const totalPages = Math.ceil(filteredPublications.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedPublications = filteredPublications.slice(startIndex, endIndex);

  if (isLoading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-blue-600" />
      </main>
    );
  }

  return (
    <AdminLayout>
      <div className="p-8">
        <div className="max-w-7xl mx-auto">
          <div className="mb-8">
            <div className="flex justify-between items-start">
              <div>
                <h2 className="text-3xl font-bold text-gray-900 mb-2">Gerenciar Publicações</h2>
                <p className="text-gray-600">Livros, artigos e notícias acadêmicas</p>
              </div>
              <Link
                href="/admin/publicacoes/new"
                className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-xl font-bold hover:from-blue-700 hover:to-purple-700 transition-all shadow-lg flex items-center gap-2"
              >
                <Plus className="w-5 h-5" />
                Nova Publicação
              </Link>
            </div>
          </div>

          {/* Filtros */}
          <div className="mb-6 flex gap-3">
            <button
              onClick={() => setFilterType('all')}
              className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
                filterType === 'all'
                  ? 'bg-gray-900 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-100'
              }`}
            >
              Todas ({publications.length})
            </button>
            <button
              onClick={() => setFilterType('livro')}
              className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
                filterType === 'livro'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-100'
              }`}
            >
              <BookOpen className="w-4 h-4 inline mr-1" />
              Livros ({publications.filter(p => p.type === 'livro').length})
            </button>
            <button
              onClick={() => setFilterType('artigo')}
              className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
                filterType === 'artigo'
                  ? 'bg-purple-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-100'
              }`}
            >
              <FileText className="w-4 h-4 inline mr-1" />
              Artigos ({publications.filter(p => p.type === 'artigo').length})
            </button>
            <button
              onClick={() => setFilterType('noticia')}
              className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
                filterType === 'noticia'
                  ? 'bg-pink-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-100'
              }`}
            >
              <Calendar className="w-4 h-4 inline mr-1" />
              Notícias ({publications.filter(p => p.type === 'noticia').length})
            </button>
          </div>

          <div className="bg-white rounded-2xl shadow-lg border-2 border-gray-200 overflow-hidden">
            {filteredPublications.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <svg className="w-16 h-16 mx-auto mb-4 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
                <p>Nenhuma publicação encontrada</p>
                <Link
                  href="/admin/publicacoes/new"
                  className="inline-block mt-4 text-blue-600 hover:text-blue-700 font-semibold"
                >
                  Criar primeira publicação
                </Link>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gradient-to-r from-blue-50 to-purple-50">
                      <tr>
                        <th className="px-6 py-4 text-left text-sm font-bold text-gray-900">Tipo</th>
                        <th className="px-6 py-4 text-left text-sm font-bold text-gray-900">Título</th>
                        <th className="px-6 py-4 text-left text-sm font-bold text-gray-900">Autor</th>
                        <th className="px-6 py-4 text-left text-sm font-bold text-gray-900">Data</th>
                        <th className="px-6 py-4 text-left text-sm font-bold text-gray-900">Status</th>
                        <th className="px-6 py-4 text-right text-sm font-bold text-gray-900">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {paginatedPublications.map((pub) => (
                        <tr key={pub.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4">
                            <span className={`px-3 py-1 rounded-full text-xs font-bold ${getTypeColor(pub.type)}`}>
                              {getTypeLabel(pub.type)}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <p className="font-semibold text-gray-900 line-clamp-1">{pub.title}</p>
                            <p className="text-sm text-gray-600 line-clamp-1">{pub.description}</p>
                          </td>
                          <td className="px-6 py-4">
                            <p className="text-sm text-gray-700">{pub.author}</p>
                          </td>
                          <td className="px-6 py-4">
                            <p className="text-sm text-gray-700 flex items-center gap-1">
                              <Calendar className="w-4 h-4" />
                              {new Date(pub.publishedAt).toLocaleDateString('pt-BR')}
                            </p>
                          </td>
                          <td className="px-6 py-4">
                            {pub.isPublished ? (
                              <span className="px-3 py-1 bg-green-100 text-green-800 text-xs font-bold rounded-full flex items-center gap-1 w-fit">
                                <CheckCircle className="w-3 h-3" />
                                Publicado
                              </span>
                            ) : (
                              <span className="px-3 py-1 bg-gray-100 text-gray-800 text-xs font-bold rounded-full flex items-center gap-1 w-fit">
                                <XCircle className="w-3 h-3" />
                                Rascunho
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center justify-end gap-2">
                              <Link
                                href="/publicacoes"
                                target="_blank"
                                className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                title="Ver página pública"
                              >
                                <Eye className="w-4 h-4" />
                              </Link>
                              <Link
                                href={`/admin/publicacoes/${pub.id}/edit`}
                                className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                                title="Editar"
                              >
                                <Edit className="w-4 h-4" />
                              </Link>
                              <button
                                onClick={() => handleDelete(pub.id, pub.title)}
                                className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                title="Deletar"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {totalPages > 1 && (
                  <div className="p-6 border-t border-gray-200">
                    <Pagination
                      currentPage={currentPage}
                      totalPages={totalPages}
                      onPageChange={setCurrentPage}
                      itemsPerPage={itemsPerPage}
                      totalItems={filteredPublications.length}
                    />
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
