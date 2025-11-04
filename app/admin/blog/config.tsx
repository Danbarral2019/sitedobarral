/**
 * Configuração da lista de Blog Posts
 * Usa o padrão genérico ResourceList (Fase 7)
 */

import Link from 'next/link';
import { Eye, Edit, Trash2, Calendar, CheckCircle, XCircle, Share2, FileText, Clock } from 'lucide-react';
import { createListConfig } from '@/components/admin/ResourceListContainer';
import { AdminListConfig } from '@/lib/types/admin-list';
import { BlogPost, deleteBlogPost } from '@/lib/blog';

export const blogConfig: AdminListConfig<BlogPost> = createListConfig<BlogPost>({
  title: 'Gerenciar Blog',
  description: 'Crie e edite posts do blog',

  // Mostrar busca
  showSearch: true,
  searchPlaceholder: 'Buscar por título, autor ou conteúdo...',

  // Estatísticas
  showStats: true,
  getStats: (items) => [
    {
      label: 'Total de Posts',
      value: items.length,
      icon: FileText,
      color: 'bg-blue-100 text-blue-600',
    },
    {
      label: 'Publicados',
      value: items.filter((p) => p.isPublished).length,
      icon: CheckCircle,
      color: 'bg-green-100 text-green-600',
    },
    {
      label: 'Rascunhos',
      value: items.filter((p) => !p.isPublished).length,
      icon: Clock,
      color: 'bg-gray-100 text-gray-600',
    },
  ],

  // Filtros
  filters: [
    {
      id: 'isPublished',
      label: 'Status',
      type: 'select',
      options: [
        { value: '', label: 'Todos' },
        { value: 'true', label: 'Publicados' },
        { value: 'false', label: 'Rascunhos' },
      ],
    },
  ],

  // Colunas
  columns: [
    {
      id: 'title',
      label: 'Título',
      render: (post) => {
        const tags = post.tags ? JSON.parse(post.tags) : [];

        return (
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
        );
      },
    },
    {
      id: 'author',
      label: 'Autor',
      render: (post) => <p className="text-sm text-gray-700">{post.author}</p>,
    },
    {
      id: 'publishedAt',
      label: 'Data',
      render: (post) => (
        <p className="text-sm text-gray-700 flex items-center gap-1">
          <Calendar className="w-4 h-4" />
          {new Date(post.publishedAt).toLocaleDateString('pt-BR')}
        </p>
      ),
    },
    {
      id: 'isPublished',
      label: 'Status',
      render: (post) =>
        post.isPublished ? (
          <span className="px-3 py-1 bg-green-100 text-green-800 text-xs font-bold rounded-full flex items-center gap-1 w-fit">
            <CheckCircle className="w-3 h-3" />
            Publicado
          </span>
        ) : (
          <span className="px-3 py-1 bg-gray-100 text-gray-800 text-xs font-bold rounded-full flex items-center gap-1 w-fit">
            <XCircle className="w-3 h-3" />
            Rascunho
          </span>
        ),
    },
  ],

  // Ações individuais
  rowActions: [
    {
      id: 'view',
      label: 'Ver post',
      icon: Eye,
      color: 'text-blue-600',
      action: (post) => {
        window.open(`/blog/${post.slug}`, '_blank', 'noopener,noreferrer');
      },
      show: (post) => post.isPublished, // Só mostrar se publicado
    },
    {
      id: 'social',
      label: 'Preparar para redes sociais',
      icon: Share2,
      color: 'text-purple-600',
      action: (post) => {
        window.location.href = `/admin/assistente-social?postId=${post.id}`;
      },
    },
    {
      id: 'edit',
      label: 'Editar',
      icon: Edit,
      color: 'text-orange-600',
      action: (post) => {
        window.location.href = `/admin/blog/${post.id}/edit`;
      },
    },
    {
      id: 'delete',
      label: 'Deletar',
      icon: Trash2,
      color: 'text-red-600',
      action: async (post) => {
        if (!confirm(`Tem certeza que deseja deletar "${post.title}"?`)) {
          return;
        }
        await deleteBlogPost(post.id);
      },
    },
  ],

  // Estado vazio
  emptyMessage: 'Nenhum post criado ainda',
  emptyIcon: FileText,

  // Paginação
  defaultPageSize: 10,
  pageSizeOptions: [10, 25, 50],
});

/**
 * Header customizado com botões de ação
 */
export function BlogHeader() {
  return (
    <div className="mb-8">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Gerenciar Blog</h1>
          <p className="text-gray-600">Crie e edite posts do blog</p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/admin/blog/upload-word"
            className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-6 py-3 rounded-xl font-bold hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm-1 13H7v-2h6v2zm3-4H7v-2h9v2zm0-4H7V5h9v2z" />
            </svg>
            Upload Word
          </Link>
          <Link
            href="/admin/blog/new"
            className="bg-gradient-to-r from-orange-600 to-amber-600 text-white px-6 py-3 rounded-xl font-bold hover:from-orange-700 hover:to-amber-700 transition-all shadow-lg flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Novo Post
          </Link>
        </div>
      </div>
    </div>
  );
}
