'use client';

/**
 * Configuração da lista de Sites Recomendados
 */

import Image from 'next/image';
import Link from 'next/link';
import { Globe, Edit, Trash2, ExternalLink, CheckCircle, XCircle } from 'lucide-react';
import { createListConfig } from '@/components/admin/ResourceListContainer';
import { AdminListConfig } from '@/lib/types/admin-list';
import { RecommendedSite, deleteSite } from '@/lib/sites';

export const sitesConfig: AdminListConfig<RecommendedSite> = createListConfig<RecommendedSite>({
  title: 'Sites Recomendados',
  description: 'Links úteis e sites de referência',

  showSearch: true,
  searchPlaceholder: 'Buscar por título, descrição ou URL...',

  showStats: true,
  getStats: (items) => [
    {
      label: 'Total',
      value: items.length,
      icon: Globe,
      color: 'bg-blue-100 text-blue-600',
    },
    {
      label: 'Ativos',
      value: items.filter((s) => s.isActive).length,
      icon: CheckCircle,
      color: 'bg-green-100 text-green-600',
    },
  ],

  filters: [
    {
      id: 'isActive',
      label: 'Status',
      type: 'select',
      options: [
        { value: '', label: 'Todos' },
        { value: 'true', label: 'Ativos' },
        { value: 'false', label: 'Inativos' },
      ],
    },
  ],

  columns: [
    {
      id: 'title',
      label: 'Site',
      render: (site) => (
        <div className="flex items-center gap-3">
          {site.faviconUrl ? (
            <Image src={site.faviconUrl} alt="" width={20} height={20} unoptimized />
          ) : (
            <Globe className="w-5 h-5 text-gray-400" />
          )}
          <div>
            <p className="font-semibold text-gray-900">{site.title}</p>
            <p className="text-sm text-gray-600 line-clamp-1">{site.description}</p>
          </div>
        </div>
      ),
    },
    {
      id: 'url',
      label: 'URL',
      render: (site) => (
        <a
          href={site.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-blue-600 hover:underline flex items-center gap-1"
        >
          <ExternalLink className="w-4 h-4" />
          {new URL(site.url).hostname}
        </a>
      ),
    },
    {
      id: 'category',
      label: 'Categoria',
      render: (site) => site.category ? (
        <span className="px-3 py-1 bg-gray-100 text-gray-800 text-xs font-bold rounded-full">
          {site.category}
        </span>
      ) : (
        <span className="text-gray-400 text-sm">Sem categoria</span>
      ),
    },
    {
      id: 'isActive',
      label: 'Status',
      render: (site) =>
        site.isActive ? (
          <span className="px-3 py-1 bg-green-100 text-green-800 text-xs font-bold rounded-full flex items-center gap-1 w-fit">
            <CheckCircle className="w-3 h-3" />
            Ativo
          </span>
        ) : (
          <span className="px-3 py-1 bg-gray-100 text-gray-800 text-xs font-bold rounded-full flex items-center gap-1 w-fit">
            <XCircle className="w-3 h-3" />
            Inativo
          </span>
        ),
    },
  ],

  rowActions: [
    {
      id: 'visit',
      label: 'Visitar site',
      icon: ExternalLink,
      color: 'text-blue-600',
      action: (site) => {
        window.open(site.url, '_blank', 'noopener,noreferrer');
      },
    },
    {
      id: 'edit',
      label: 'Editar',
      icon: Edit,
      color: 'text-orange-600',
      action: (site) => {
        window.location.href = `/admin/sites/${site.id}/edit`;
      },
    },
    {
      id: 'delete',
      label: 'Deletar',
      icon: Trash2,
      color: 'text-red-600',
      action: async (site) => {
        if (!confirm(`Tem certeza que deseja deletar "${site.title}"?`)) return;
        await deleteSite(site.id);
      },
    },
  ],

  emptyMessage: 'Nenhum site adicionado ainda',
  emptyIcon: Globe,

  defaultPageSize: 50,
  pageSizeOptions: [25, 50, 100],
});

export function SitesHeader() {
  return (
    <div className="mb-8">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Sites Recomendados</h1>
          <p className="text-gray-600">Links úteis e sites de referência</p>
        </div>
        <Link
          href="/admin/sites/new"
          className="bg-gradient-to-r from-blue-600 to-cyan-600 text-white px-6 py-3 rounded-xl font-bold hover:from-blue-700 hover:to-cyan-700 transition-all shadow-lg flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Novo Site
        </Link>
      </div>
    </div>
  );
}
