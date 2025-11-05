'use client';

/**
 * Configuração da lista de Publicações
 * Usa o padrão genérico ResourceList (Fase 7)
 */

import Link from 'next/link';
import { Eye, Edit, Trash2, Calendar, CheckCircle, XCircle, BookOpen, FileText, Newspaper } from 'lucide-react';
import { createListConfig } from '@/components/admin/ResourceListContainer';
import { AdminListConfig } from '@/lib/types/admin-list';
import { Publication, deletePublication } from '@/lib/publications';

// Helper functions
function getTypeLabel(type: string): string {
  const types: Record<string, string> = {
    livro: 'Livro',
    artigo: 'Artigo',
    noticia: 'Notícia',
  };
  return types[type] || type;
}

function getTypeColor(type: string): string {
  const colors: Record<string, string> = {
    livro: 'bg-blue-100 text-blue-800',
    artigo: 'bg-purple-100 text-purple-800',
    noticia: 'bg-pink-100 text-pink-800',
  };
  return colors[type] || 'bg-gray-100 text-gray-800';
}

export const publicationsConfig: AdminListConfig<Publication> = createListConfig<Publication>({
  title: 'Gerenciar Publicações',
  description: 'Livros, artigos e notícias acadêmicas',

  // Busca
  showSearch: true,
  searchPlaceholder: 'Buscar por título, autor ou descrição...',

  // Estatísticas
  showStats: true,
  getStats: (items) => [
    {
      label: 'Total',
      value: items.length,
      icon: FileText,
      color: 'bg-gray-100 text-gray-600',
    },
    {
      label: 'Livros',
      value: items.filter((p) => p.type === 'livro').length,
      icon: BookOpen,
      color: 'bg-blue-100 text-blue-600',
    },
    {
      label: 'Artigos',
      value: items.filter((p) => p.type === 'artigo').length,
      icon: FileText,
      color: 'bg-purple-100 text-purple-600',
    },
    {
      label: 'Notícias',
      value: items.filter((p) => p.type === 'noticia').length,
      icon: Newspaper,
      color: 'bg-pink-100 text-pink-600',
    },
  ],

  // Filtros
  filters: [
    {
      id: 'type',
      label: 'Tipo',
      type: 'select',
      options: [
        { value: '', label: 'Todos' },
        { value: 'livro', label: 'Livros' },
        { value: 'artigo', label: 'Artigos' },
        { value: 'noticia', label: 'Notícias' },
      ],
    },
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
      id: 'type',
      label: 'Tipo',
      render: (pub) => (
        <span className={`px-3 py-1 rounded-full text-xs font-bold ${getTypeColor(pub.type)}`}>
          {getTypeLabel(pub.type)}
        </span>
      ),
    },
    {
      id: 'title',
      label: 'Título',
      render: (pub) => (
        <div>
          <p className="font-semibold text-gray-900 line-clamp-1">{pub.title}</p>
          <p className="text-sm text-gray-600 line-clamp-1">{pub.description}</p>
        </div>
      ),
    },
    {
      id: 'author',
      label: 'Autor',
      render: (pub) => <p className="text-sm text-gray-700">{pub.author}</p>,
    },
    {
      id: 'publishedAt',
      label: 'Data',
      render: (pub) => (
        <p className="text-sm text-gray-700 flex items-center gap-1">
          <Calendar className="w-4 h-4" />
          {new Date(pub.publishedAt).toLocaleDateString('pt-BR')}
        </p>
      ),
    },
    {
      id: 'isPublished',
      label: 'Status',
      render: (pub) =>
        pub.isPublished ? (
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
      label: 'Ver página pública',
      icon: Eye,
      color: 'text-blue-600',
      action: () => {
        window.open('/publicacoes', '_blank', 'noopener,noreferrer');
      },
    },
    {
      id: 'edit',
      label: 'Editar',
      icon: Edit,
      color: 'text-purple-600',
      action: (pub) => {
        window.location.href = `/admin/publicacoes/${pub.id}/edit`;
      },
    },
    {
      id: 'delete',
      label: 'Deletar',
      icon: Trash2,
      color: 'text-red-600',
      action: async (pub) => {
        if (!confirm(`Tem certeza que deseja deletar "${pub.title}"?`)) {
          return;
        }
        await deletePublication(pub.id);
      },
    },
  ],

  // Estado vazio
  emptyMessage: 'Nenhuma publicação encontrada',
  emptyIcon: BookOpen,

  // Paginação
  defaultPageSize: 10,
  pageSizeOptions: [10, 25, 50],
});

/**
 * Header customizado com botão de ação
 */
export function PublicationsHeader() {
  return (
    <div className="mb-8">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Gerenciar Publicações</h1>
          <p className="text-gray-600">Livros, artigos e notícias acadêmicas</p>
        </div>
        <Link
          href="/admin/publicacoes/new"
          className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-xl font-bold hover:from-blue-700 hover:to-purple-700 transition-all shadow-lg flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Nova Publicação
        </Link>
      </div>
    </div>
  );
}
