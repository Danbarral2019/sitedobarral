'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Plus, Loader2, Eye, Edit, Trash2, Calendar, CheckCircle, XCircle
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Breadcrumb } from '@/components/ui/breadcrumb';
import { Pagination } from '@/components/ui/pagination';

interface BlogPostData {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  author: string;
  publishedAt: string;
  isPublished: boolean;
  tags: string | null;
  createdAt: string;
  updatedAt: string;
}

export default function AdminBlogPage() {
  const router = useRouter();
  const { success, error: errorToast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [posts, setPosts] = useState<BlogPostData[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    verifyAdmin();
    loadPosts();
  }, []);

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

  const loadPosts = async () => {
    try {
      const response = await fetch('/api/admin/blog-posts');
      const data = await response.json();
      setPosts(data.posts || []);
    } catch (error) {
      console.error('Erro ao carregar posts:', error);
      errorToast('Erro ao carregar posts', 'Tente novamente.');
    }
  };

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`Tem certeza que deseja deletar "${title}"?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/blog-posts/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Erro ao deletar post');
      }

      success('Post deletado!', 'O post foi removido com sucesso.');
      loadPosts();
    } catch (error) {
      console.error('Erro ao deletar post:', error);
      errorToast('Erro ao deletar', 'Tente novamente.');
    }
  };

  // Calcular paginação
  const totalPages = Math.ceil(posts.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedPosts = posts.slice(startIndex, endIndex);

  if (isLoading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-blue-600" />
      </main>
    );
  }

  return (
    <main className="py-12 bg-gradient-to-br from-orange-50 via-white to-amber-50 min-h-screen">
      <div className="container mx-auto px-4">
        <div className="max-w-7xl mx-auto">
          <Breadcrumb
            items={[
              { label: 'Admin', href: '/admin' },
              { label: 'Blog' }
            ]}
            className="mb-6"
          />

          <div className="mb-8">
            <div className="flex justify-between items-start">
              <div>
                <h1 className="text-4xl font-bold text-gray-900 mb-2">Gerenciar Blog</h1>
                <p className="text-gray-700">Crie e edite posts do blog</p>
              </div>
              <Link
                href="/admin/blog/new"
                className="bg-gradient-to-r from-orange-600 to-amber-600 text-white px-6 py-3 rounded-xl font-bold hover:from-orange-700 hover:to-amber-700 transition-all shadow-lg flex items-center gap-2"
              >
                <Plus className="w-5 h-5" />
                Novo Post
              </Link>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-lg border-2 border-gray-200 overflow-hidden">
            {posts.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <svg className="w-16 h-16 mx-auto mb-4 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                <p>Nenhum post criado ainda</p>
                <Link
                  href="/admin/blog/new"
                  className="inline-block mt-4 text-orange-600 hover:text-orange-700 font-semibold"
                >
                  Criar primeiro post
                </Link>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gradient-to-r from-orange-50 to-amber-50">
                      <tr>
                        <th className="px-6 py-4 text-left text-sm font-bold text-gray-900">Título</th>
                        <th className="px-6 py-4 text-left text-sm font-bold text-gray-900">Autor</th>
                        <th className="px-6 py-4 text-left text-sm font-bold text-gray-900">Data</th>
                        <th className="px-6 py-4 text-left text-sm font-bold text-gray-900">Status</th>
                        <th className="px-6 py-4 text-right text-sm font-bold text-gray-900">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {paginatedPosts.map((post) => {
                        const tags = post.tags ? JSON.parse(post.tags) : [];

                        return (
                          <tr key={post.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-6 py-4">
                              <div>
                                <p className="font-semibold text-gray-900">{post.title}</p>
                                <p className="text-sm text-gray-600 line-clamp-1">{post.excerpt}</p>
                                {tags.length > 0 && (
                                  <div className="flex gap-1 mt-1">
                                    {tags.slice(0, 3).map((tag: string, i: number) => (
                                      <span key={i} className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded">
                                        {tag}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <p className="text-sm text-gray-700">{post.author}</p>
                            </td>
                            <td className="px-6 py-4">
                              <p className="text-sm text-gray-700 flex items-center gap-1">
                                <Calendar className="w-4 h-4" />
                                {new Date(post.publishedAt).toLocaleDateString('pt-BR')}
                              </p>
                            </td>
                            <td className="px-6 py-4">
                              {post.isPublished ? (
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
                                  href={`/blog/${post.slug}`}
                                  target="_blank"
                                  className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                  title="Ver post"
                                >
                                  <Eye className="w-4 h-4" />
                                </Link>
                                <Link
                                  href={`/admin/blog/${post.id}/edit`}
                                  className="p-2 text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
                                  title="Editar"
                                >
                                  <Edit className="w-4 h-4" />
                                </Link>
                                <button
                                  onClick={() => handleDelete(post.id, post.title)}
                                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                  title="Deletar"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
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
                      totalItems={posts.length}
                    />
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
