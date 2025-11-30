'use client';

/**
 * Configuração da lista de Atos Normativos
 * Usa o padrão genérico ResourceList (Fase 7)
 *
 * NOTA: 'use client' aqui sinaliza que este arquivo contém lógica de cliente
 * e deve ser usado apenas em Client Components (LegislacaoClient.tsx)
 */

import { Eye, Edit, Trash2, Scale, Calendar, ExternalLink, FileText, Download } from 'lucide-react';
import { createListConfig } from '@/components/admin/ResourceListContainer';
import { AdminListConfig, FilterConfig } from '@/lib/types/admin-list';
import { LegislativeAct, LegislativeActStats } from '@/lib/legislacao';

// Helper functions
const TYPE_LABELS: Record<string, string> = {
  'decreto': 'Decreto',
  'portaria': 'Portaria',
  'in': 'IN',
  'ordem-servico': 'Ordem de Serviço',
  'lei': 'Lei',
  'medida-provisoria': 'Medida Provisória'
};

const TYPE_COLORS: Record<string, string> = {
  'decreto': 'bg-blue-100 text-blue-800',
  'portaria': 'bg-green-100 text-green-800',
  'in': 'bg-purple-100 text-purple-800',
  'ordem-servico': 'bg-yellow-100 text-yellow-800',
  'lei': 'bg-red-100 text-red-800',
  'medida-provisoria': 'bg-orange-100 text-orange-800'
};

function getTypeLabel(type: string): string {
  return TYPE_LABELS[type] || type;
}

function getTypeColor(type: string): string {
  return TYPE_COLORS[type] || 'bg-gray-100 text-gray-800';
}

interface LegislacaoConfigProps {
  types: string[];
  issuers: string[];
  years: number[];
  stats: LegislativeActStats;
}

export function createLegislacaoConfig({
  types,
  issuers,
  years,
  stats
}: LegislacaoConfigProps): AdminListConfig<LegislativeAct> {
  // Build filters dynamically
  const filters: FilterConfig[] = [
    {
      id: 'type',
      label: 'Tipo',
      type: 'select',
      options: [
        { value: '', label: 'Todos' },
        ...types.map(t => ({ value: t, label: getTypeLabel(t) }))
      ],
    },
    {
      id: 'issuer',
      label: 'Emissor',
      type: 'select',
      options: [
        { value: '', label: 'Todos' },
        ...issuers.map(i => ({ value: i, label: i }))
      ],
    },
    {
      id: 'year',
      label: 'Ano',
      type: 'select',
      options: [
        { value: '', label: 'Todos' },
        ...years.map(y => ({ value: y.toString(), label: y.toString() }))
      ],
    },
  ];

  return createListConfig<LegislativeAct>({
    title: 'Atos Normativos',
    description: 'Leis, decretos, portarias e instruções normativas',

    // Busca
    showSearch: true,
    searchPlaceholder: 'Buscar por título, número ou ementa...',

    // Estatísticas (usando valores agregados do banco, não da página)
    showStats: true,
    getStats: () => [
      {
        label: 'Total',
        value: stats.total,
        icon: Scale,
        color: 'bg-blue-100 text-blue-600',
      },
      {
        label: 'Com PDF',
        value: stats.withPdf,
        icon: FileText,
        color: 'bg-green-100 text-green-600',
      },
      {
        label: 'Com Link Oficial',
        value: stats.withOfficialUrl,
        icon: ExternalLink,
        color: 'bg-purple-100 text-purple-600',
      },
      {
        label: 'Visualizações',
        value: stats.totalViews,
        icon: Eye,
        color: 'bg-indigo-100 text-indigo-600',
      },
    ],

    // Filtros dinâmicos
    filters,

    // Colunas
    columns: [
      {
        id: 'type',
        label: 'Tipo',
        render: (act) => (
          <span className={`px-3 py-1 rounded-full text-xs font-bold ${getTypeColor(act.type)}`}>
            {getTypeLabel(act.type)}
          </span>
        ),
      },
      {
        id: 'fullNumber',
        label: 'Número',
        render: (act) => (
          <div>
            <p className="font-semibold text-gray-900">{act.fullNumber}</p>
            <p className="text-xs text-gray-500 flex items-center gap-1 mt-1">
              <Calendar className="w-3 h-3" />
              {new Date(act.publishDate).toLocaleDateString('pt-BR')}
            </p>
          </div>
        ),
      },
      {
        id: 'title',
        label: 'Título',
        render: (act) => (
          <div>
            <p className="font-medium text-gray-900 line-clamp-1">{act.title}</p>
            <p className="text-sm text-gray-600 line-clamp-1">{act.ementa.substring(0, 80)}...</p>
          </div>
        ),
      },
      {
        id: 'viewCount',
        label: 'Visualizações',
        render: (act) => (
          <p className="text-sm text-gray-700 flex items-center gap-1">
            <Eye className="w-4 h-4" />
            {act.viewCount}
          </p>
        ),
      },
    ],

    // Ações individuais
    rowActions: [
      {
        id: 'view-public',
        label: 'Ver no site',
        icon: Eye,
        color: 'text-blue-600',
        action: (act) => {
          window.open(`/legislacao/${act.id}`, '_blank', 'noopener,noreferrer');
        },
      },
      {
        id: 'view-official',
        label: 'Ver link oficial',
        icon: ExternalLink,
        color: 'text-purple-600',
        action: (act) => {
          if (act.officialUrl) {
            window.open(act.officialUrl, '_blank', 'noopener,noreferrer');
          }
        },
        show: (act) => !!act.officialUrl,
      },
      {
        id: 'download',
        label: 'Baixar PDF',
        icon: Download,
        color: 'text-green-600',
        action: (act) => {
          if (act.pdfUrl) {
            window.open(act.pdfUrl, '_blank', 'noopener,noreferrer');
          }
        },
        show: (act) => !!act.pdfUrl,
      },
      {
        id: 'edit',
        label: 'Editar',
        icon: Edit,
        color: 'text-orange-600',
        action: (act) => {
          window.location.href = `/admin/legislacao/${act.id}/edit`;
        },
      },
      {
        id: 'delete',
        label: 'Deletar',
        icon: Trash2,
        color: 'text-red-600',
        action: async (act) => {
          if (!confirm(`Tem certeza que deseja deletar "${act.fullNumber}"?`)) {
            return;
          }
          const response = await fetch(`/api/admin/legislacao/${act.id}`, {
            method: 'DELETE'
          });
          if (!response.ok) {
            throw new Error('Failed to delete legislative act');
          }
        },
      },
    ],

    // Estado vazio
    emptyMessage: 'Nenhum ato normativo encontrado',
    emptyIcon: Scale,

    // Paginação
    defaultPageSize: 20,
    pageSizeOptions: [10, 20, 50, 100],

    // Layout da tabela
    actionsPosition: 'beforeLast', // Ações aparecem ANTES de Visualizações
    tableMaxHeight: 'max-h-[600px]', // Scroll vertical com altura máxima
  });
}
