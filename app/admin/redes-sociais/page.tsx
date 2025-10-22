'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2, RefreshCw, ExternalLink, CheckCircle, XCircle, Clock, Instagram, Linkedin, Settings } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import AdminLayout from '@/components/AdminLayout';

interface BlogPost {
  id: string;
  title: string;
  slug: string;
}

interface SocialMediaPost {
  id: string;
  platform: string;
  status: string;
  postId: string | null;
  postUrl: string | null;
  error: string | null;
  retryCount: number;
  publishedAt: string | null;
  createdAt: string;
  blogPost: BlogPost;
}

type FilterStatus = 'all' | 'published' | 'failed' | 'pending';
type FilterPlatform = 'all' | 'instagram' | 'linkedin';

interface Stats {
  total: number;
  published: number;
  failed: number;
  pending: number;
  byPlatform: Array<{
    platform: string;
    total: number;
    published: number;
    failed: number;
  }>;
}

export default function RedesSociaisPage() {
  const router = useRouter();
  const { success, error: errorToast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [posts, setPosts] = useState<SocialMediaPost[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'published' | 'failed' | 'pending'>('all');
  const [platformFilter, setPlatformFilter] = useState<'all' | 'instagram' | 'linkedin'>('all');

  const verifyAdmin = useCallback(async () => {
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
    }
  }, [router]);

  const loadPosts = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (platformFilter !== 'all') params.set('platform', platformFilter);
      if (filter !== 'all') params.set('status', filter);

      const response = await fetch(`/api/admin/social/posts?${params}`);

      if (!response.ok) {
        throw new Error('Erro ao carregar publicações');
      }

      const data = await response.json();
      setPosts(data.posts);
      setStats(data.stats);
    } catch (error) {
      console.error('Erro ao carregar publicações:', error);
      errorToast('Erro ao carregar', 'Não foi possível carregar as publicações');
    } finally {
      setIsLoading(false);
    }
  }, [filter, platformFilter, errorToast]);

  useEffect(() => {
    verifyAdmin();
  }, [verifyAdmin]);

  useEffect(() => {
    loadPosts();
  }, [loadPosts]);

  const handleRetry = async (postId: string) => {
    setRetryingId(postId);

    try {
      const response = await fetch('/api/admin/social/retry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ socialMediaPostId: postId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao republicar');
      }

      success('Republicado!', 'Post republicado com sucesso nas redes sociais');
      loadPosts(); // Recarregar lista
    } catch (error) {
      console.error('Erro ao republicar:', error);
      errorToast(
        'Erro ao republicar',
        error instanceof Error ? error.message : 'Tente novamente'
      );
    } finally {
      setRetryingId(null);
    }
  };

  const getPlatformIcon = (platform: string) => {
    switch (platform) {
      case 'instagram':
        return <Instagram className="w-5 h-5" />;
      case 'linkedin':
        return <Linkedin className="w-5 h-5" />;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'published':
        return (
          <span className="flex items-center gap-1 px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
            <CheckCircle className="w-4 h-4" />
            Publicado
          </span>
        );
      case 'failed':
        return (
          <span className="flex items-center gap-1 px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm font-medium">
            <XCircle className="w-4 h-4" />
            Falhou
          </span>
        );
      case 'pending':
        return (
          <span className="flex items-center gap-1 px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm font-medium">
            <Clock className="w-4 h-4" />
            Pendente
          </span>
        );
      default:
        return null;
    }
  };

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
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 mb-2">📱 Redes Sociais</h1>
                <p className="text-gray-600">Gerencie publicações automáticas no Instagram e LinkedIn</p>
              </div>
              <Link
                href="/admin/redes-sociais/config"
                className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg font-bold hover:bg-gray-700 transition-colors"
              >
                <Settings className="w-5 h-5" />
                Configurações
              </Link>
            </div>
          </div>

          {/* Estatísticas */}
          {stats && (
            <div className="grid md:grid-cols-4 gap-6 mb-8">
              <div className="bg-white p-6 rounded-xl border-2 border-gray-200">
                <div className="text-3xl font-bold text-gray-900 mb-1">{stats.total}</div>
                <div className="text-sm text-gray-600">Total de Publicações</div>
              </div>
              <div className="bg-green-50 p-6 rounded-xl border-2 border-green-200">
                <div className="text-3xl font-bold text-green-700 mb-1">{stats.published}</div>
                <div className="text-sm text-green-700">Publicadas</div>
              </div>
              <div className="bg-red-50 p-6 rounded-xl border-2 border-red-200">
                <div className="text-3xl font-bold text-red-700 mb-1">{stats.failed}</div>
                <div className="text-sm text-red-700">Falharam</div>
              </div>
              <div className="bg-yellow-50 p-6 rounded-xl border-2 border-yellow-200">
                <div className="text-3xl font-bold text-yellow-700 mb-1">{stats.pending}</div>
                <div className="text-sm text-yellow-700">Pendentes</div>
              </div>
            </div>
          )}

          {/* Filtros */}
          <div className="bg-white p-4 rounded-xl border-2 border-gray-200 mb-6">
            <div className="flex flex-wrap gap-4">
              <div>
                <label className="block text-sm font-bold text-gray-900 mb-2">Status</label>
                <select
                  value={filter}
                  onChange={(e) => setFilter(e.target.value as FilterStatus)}
                  className="px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-600"
                >
                  <option value="all">Todos</option>
                  <option value="published">Publicados</option>
                  <option value="failed">Falharam</option>
                  <option value="pending">Pendentes</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-900 mb-2">Plataforma</label>
                <select
                  value={platformFilter}
                  onChange={(e) => setPlatformFilter(e.target.value as FilterPlatform)}
                  className="px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-600"
                >
                  <option value="all">Todas</option>
                  <option value="instagram">Instagram</option>
                  <option value="linkedin">LinkedIn</option>
                </select>
              </div>
            </div>
          </div>

          {/* Lista de Publicações */}
          <div className="bg-white rounded-xl border-2 border-gray-200 overflow-hidden">
            {posts.length === 0 ? (
              <div className="p-12 text-center">
                <p className="text-gray-500 text-lg">Nenhuma publicação encontrada</p>
                <p className="text-gray-400 text-sm mt-2">
                  Publique um post do blog para ver as publicações aqui
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {posts.map((post) => (
                  <div key={post.id} className="p-6 hover:bg-gray-50 transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="text-blue-600">
                            {getPlatformIcon(post.platform)}
                          </div>
                          <h3 className="text-lg font-bold text-gray-900">
                            {post.blogPost.title}
                          </h3>
                          {getStatusBadge(post.status)}
                        </div>

                        <div className="flex items-center gap-4 text-sm text-gray-600 mb-3">
                          <span>
                            Plataforma: <span className="font-medium capitalize">{post.platform}</span>
                          </span>
                          {post.publishedAt && (
                            <span>
                              Publicado em: {new Date(post.publishedAt).toLocaleString('pt-BR')}
                            </span>
                          )}
                          {post.retryCount > 0 && (
                            <span className="text-orange-600">
                              Tentativas: {post.retryCount}
                            </span>
                          )}
                        </div>

                        {post.error && (
                          <div className="bg-red-50 border-l-4 border-red-500 p-3 mb-3">
                            <p className="text-sm text-red-800 font-medium">Erro:</p>
                            <p className="text-sm text-red-700">{post.error}</p>
                          </div>
                        )}

                        <div className="flex items-center gap-3">
                          <Link
                            href={`/blog/${post.blogPost.slug}`}
                            target="_blank"
                            className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
                          >
                            Ver post no blog
                            <ExternalLink className="w-3 h-3" />
                          </Link>

                          {post.postUrl && (
                            <a
                              href={post.postUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm text-green-600 hover:text-green-700 font-medium flex items-center gap-1"
                            >
                              Ver na rede social
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </div>
                      </div>

                      {post.status === 'failed' && (
                        <button
                          onClick={() => handleRetry(post.id)}
                          disabled={retryingId === post.id}
                          className="ml-4 px-4 py-2 bg-orange-600 text-white rounded-lg font-bold hover:bg-orange-700 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {retryingId === post.id ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              Republicando...
                            </>
                          ) : (
                            <>
                              <RefreshCw className="w-4 h-4" />
                              Republicar
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
