'use client';

/**
 * Configuração da lista de Glossário
 * Usa o padrão genérico ResourceList (Fase 7)
 */

import Link from 'next/link';
import { Eye, EyeOff, Edit, Trash2, BookOpen, BarChart3, ExternalLink } from 'lucide-react';
import { createListConfig } from '@/components/admin/ResourceListContainer';
import { AdminListConfig } from '@/lib/types/admin-list';
import { GlossaryTerm, deleteGlossaryTerm } from '@/lib/glossario';

// Helper function
function getCategoryColor(category: string | null): string {
  const colors: Record<string, string> = {
    'licitacao': 'bg-blue-100 text-blue-800',
    'contrato': 'bg-green-100 text-green-800',
    'fiscalizacao': 'bg-purple-100 text-purple-800',
    'planejamento': 'bg-yellow-100 text-yellow-800',
    'sancionamento': 'bg-red-100 text-red-800',
    'conceitos-gerais': 'bg-gray-100 text-gray-800',
  };
  return colors[category || ''] || 'bg-gray-100 text-gray-800';
}

export const glossarioConfig: AdminListConfig<GlossaryTerm> = createListConfig<GlossaryTerm>({
  title: 'Gerenciar Glossário',
  description: 'Termos e definições jurídicas',

  // Busca
  showSearch: true,
  searchPlaceholder: 'Buscar termo ou definição...',

  // Estatísticas
  showStats: true,
  getStats: (items) => [
    {
      label: 'Total',
      value: items.length,
      icon: BookOpen,
      color: 'bg-purple-100 text-purple-600',
    },
    {
      label: 'Publicados',
      value: items.filter((t) => t.isPublic).length,
      icon: Eye,
      color: 'bg-green-100 text-green-600',
    },
    {
      label: 'Visualizações',
      value: items.reduce((acc, t) => acc + t.viewCount, 0),
      icon: BarChart3,
      color: 'bg-indigo-100 text-indigo-600',
    },
    {
      label: 'Com Link Externo',
      value: items.filter((t) => t.externalUrl).length,
      icon: ExternalLink,
      color: 'bg-orange-100 text-orange-600',
    },
  ],

  // Filtros
  filters: [
    {
      id: 'category',
      label: 'Categoria',
      type: 'select',
      options: [
        { value: '', label: 'Todas' },
        { value: 'licitacao', label: 'Licitação' },
        { value: 'contrato', label: 'Contrato' },
        { value: 'fiscalizacao', label: 'Fiscalização' },
        { value: 'planejamento', label: 'Planejamento' },
        { value: 'sancionamento', label: 'Sancionamento' },
        { value: 'conceitos-gerais', label: 'Conceitos Gerais' },
      ],
    },
    {
      id: 'isPublic',
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
      id: 'term',
      label: 'Termo',
      render: (term) => (
        <div>
          <p className="font-semibold text-gray-900">{term.term}</p>
          {term.shortDef && (
            <p className="text-sm text-gray-600 italic line-clamp-1">{term.shortDef}</p>
          )}
          <p className="text-xs text-gray-500 mt-1">/{term.slug}</p>
        </div>
      ),
    },
    {
      id: 'definition',
      label: 'Definição',
      render: (term) => (
        <p className="text-sm text-gray-700 line-clamp-2">
          {term.definition.substring(0, 100)}...
        </p>
      ),
    },
    {
      id: 'category',
      label: 'Categoria',
      render: (term) => term.category ? (
        <span className={`px-3 py-1 text-xs font-bold rounded-full ${getCategoryColor(term.category)}`}>
          {term.category}
        </span>
      ) : (
        <span className="text-gray-400 text-sm">Sem categoria</span>
      ),
    },
    {
      id: 'viewCount',
      label: 'Visualizações',
      render: (term) => (
        <p className="text-sm text-gray-700 flex items-center gap-1">
          <BarChart3 className="w-4 h-4" />
          {term.viewCount}
        </p>
      ),
    },
    {
      id: 'isPublic',
      label: 'Status',
      render: (term) =>
        term.isPublic ? (
          <span className="px-3 py-1 bg-green-100 text-green-800 text-xs font-bold rounded-full flex items-center gap-1 w-fit">
            <Eye className="w-3 h-3" />
            Público
          </span>
        ) : (
          <span className="px-3 py-1 bg-gray-100 text-gray-800 text-xs font-bold rounded-full flex items-center gap-1 w-fit">
            <EyeOff className="w-3 h-3" />
            Privado
          </span>
        ),
    },
  ],

  // Ações individuais
  rowActions: [
    {
      id: 'view',
      label: 'Ver no site',
      icon: Eye,
      color: 'text-blue-600',
      action: (term) => {
        window.open(`/glossario/${term.slug}`, '_blank', 'noopener,noreferrer');
      },
      show: (term) => term.isPublic,
    },
    {
      id: 'edit',
      label: 'Editar',
      icon: Edit,
      color: 'text-purple-600',
      action: (term) => {
        window.location.href = `/admin/glossario/${term.id}/edit`;
      },
    },
    {
      id: 'delete',
      label: 'Deletar',
      icon: Trash2,
      color: 'text-red-600',
      action: async (term) => {
        if (!confirm(`Tem certeza que deseja deletar o termo "${term.term}"?`)) {
          return;
        }
        await deleteGlossaryTerm(term.id);
      },
    },
  ],

  // Estado vazio
  emptyMessage: 'Nenhum termo criado ainda',
  emptyIcon: BookOpen,

  // Paginação
  defaultPageSize: 10,
  pageSizeOptions: [10, 25, 50],
});

/**
 * Header customizado com botão de ação
 */
export function GlossarioHeader() {
  return (
    <div className="mb-8">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Gerenciar Glossário</h1>
          <p className="text-gray-600">Termos e definições jurídicas</p>
        </div>
        <Link
          href="/admin/glossario/new"
          className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-6 py-3 rounded-xl font-bold hover:from-purple-700 hover:to-indigo-700 transition-all shadow-lg flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Novo Termo
        </Link>
      </div>
    </div>
  );
}
