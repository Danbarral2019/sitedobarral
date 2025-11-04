/**
 * Configuração da lista de Documentos Pendentes
 * Usa o padrão genérico ResourceList (Fase 7)
 */

import { CheckCircle, XCircle, ExternalLink, Calendar, Tag, AlertCircle, FileText } from 'lucide-react';
import { createListConfig } from '@/components/admin/ResourceListContainer';
import { AdminListConfig } from '@/lib/types/admin-list';
import { safeParseArray } from '@/lib/utils';

type PendingDocument = {
  id: string;
  title: string;
  description: string | null;
  category: string;
  type: string;
  url: string;
  uploadedAt: Date;
  douData?: string | null;
  douSecao?: string | null;
  douOrgao?: string | null;
  douEdicao?: string | null;
  tags?: string | null;
  courseId?: string;
};

export const pendingDocumentsConfig: AdminListConfig<PendingDocument> = createListConfig<PendingDocument>({
  title: 'Documentos Pendentes de Aprovação',
  description: 'Revise e aprove documentos importados automaticamente (DOU, TCU, AGU)',

  // Permitir seleção múltipla
  allowSelection: true,

  // Mostrar busca local
  showSearch: true,
  searchPlaceholder: 'Buscar por título, descrição ou categoria...',

  // Estatísticas
  showStats: true,
  getStats: (items) => [
    {
      label: 'Pendentes',
      value: items.length,
      icon: AlertCircle,
      color: 'bg-yellow-100 text-yellow-600',
    },
    {
      label: 'DOU',
      value: items.filter((d) => d.douData).length,
      icon: FileText,
      color: 'bg-blue-100 text-blue-600',
    },
    {
      label: 'Últimas 24h',
      value: items.filter((d) => {
        const dayAgo = new Date();
        dayAgo.setDate(dayAgo.getDate() - 1);
        return new Date(d.uploadedAt) > dayAgo;
      }).length,
      icon: Calendar,
      color: 'bg-purple-100 text-purple-600',
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
        { value: 'portaria', label: 'Portaria' },
        { value: 'decreto', label: 'Decreto' },
        { value: 'edital', label: 'Edital' },
        { value: 'instrucao-normativa', label: 'Instrução Normativa' },
        { value: 'orientacao-normativa', label: 'Orientação Normativa' },
        { value: 'parecer', label: 'Parecer' },
        { value: 'acordao', label: 'Acórdão' },
        { value: 'outros', label: 'Outros' },
      ],
    },
    {
      id: 'period',
      label: 'Período',
      type: 'select',
      defaultValue: 'all',
      options: [
        { value: 'all', label: 'Todos' },
        { value: 'today', label: 'Hoje' },
        { value: 'week', label: 'Esta Semana' },
        { value: 'month', label: 'Este Mês' },
      ],
    },
  ],

  // Colunas (NÃO usar tabela, mas renderização customizada card-based)
  // Vou simplificar e usar apenas as colunas principais
  columns: [
    {
      id: 'title',
      label: 'Documento',
      render: (doc) => (
        <div className="flex-1">
          {/* Título */}
          <h3 className="text-lg font-semibold text-gray-900 mb-2">{doc.title}</h3>

          {/* Descrição */}
          {doc.description && <p className="text-gray-600 mb-3 line-clamp-2">{doc.description}</p>}

          {/* Metadados DOU */}
          {(doc.douData || doc.douSecao || doc.douOrgao) && (
            <div className="flex flex-wrap gap-2 mb-3">
              {doc.douData && (
                <span className="px-3 py-1 bg-purple-100 text-purple-700 text-xs font-medium rounded-full flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {new Date(doc.douData).toLocaleDateString('pt-BR')}
                </span>
              )}
              {doc.douSecao && (
                <span className="px-3 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
                  Seção {doc.douSecao}
                </span>
              )}
              {doc.douOrgao && (
                <span className="px-3 py-1 bg-gray-100 text-gray-700 text-xs font-medium rounded-full">
                  {doc.douOrgao}
                </span>
              )}
              {doc.douEdicao && (
                <span className="px-3 py-1 bg-indigo-100 text-indigo-700 text-xs font-medium rounded-full">
                  Ed. {doc.douEdicao}
                </span>
              )}
            </div>
          )}

          {/* Categoria e Tags */}
          <div className="flex flex-wrap gap-2 mb-3">
            <span className="px-3 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full flex items-center gap-1">
              <Tag className="w-3 h-3" />
              {doc.category}
            </span>

            {doc.tags &&
              safeParseArray(doc.tags)
                .slice(0, 3)
                .map((tag: string, idx: number) => (
                  <span key={idx} className="px-3 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">
                    {tag}
                  </span>
                ))}
          </div>

          {/* Data de Upload */}
          <p className="text-xs text-gray-500">
            Importado em {new Date(doc.uploadedAt).toLocaleString('pt-BR')}
          </p>
        </div>
      ),
    },
  ],

  // Ações individuais
  rowActions: [
    {
      id: 'view',
      label: 'Visualizar documento',
      icon: ExternalLink,
      color: 'text-blue-600',
      action: (doc) => {
        window.open(doc.url, '_blank', 'noopener,noreferrer');
      },
    },
    {
      id: 'approve',
      label: 'Aprovar este documento',
      icon: CheckCircle,
      color: 'text-green-600',
      action: async (doc) => {
        await fetch('/api/admin/documents/approve', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            documentIds: [doc.id],
            action: 'approve',
          }),
        });
      },
    },
    {
      id: 'reject',
      label: 'Rejeitar este documento',
      icon: XCircle,
      color: 'text-red-600',
      action: async (doc) => {
        await fetch('/api/admin/documents/approve', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            documentIds: [doc.id],
            action: 'reject',
          }),
        });
      },
    },
  ],

  // Ações em lote
  batchActions: [
    {
      id: 'approve-batch',
      label: 'Aprovar Selecionados',
      icon: CheckCircle,
      color: 'success',
      action: async (ids) => {
        const res = await fetch('/api/admin/documents/approve', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            documentIds: ids,
            action: 'approve',
          }),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || 'Erro ao aprovar');
        }
      },
    },
    {
      id: 'reject-batch',
      label: 'Rejeitar Selecionados',
      icon: XCircle,
      color: 'danger',
      action: async (ids) => {
        const res = await fetch('/api/admin/documents/approve', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            documentIds: ids,
            action: 'reject',
          }),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || 'Erro ao rejeitar');
        }
      },
      requiresConfirmation: true,
      confirmationMessage: 'Tem certeza que deseja rejeitar os documentos selecionados?',
    },
  ],

  // Estado vazio
  emptyMessage: 'Nenhum documento pendente. Todos os documentos foram revisados!',
  emptyIcon: FileText,

  // Paginação
  defaultPageSize: 20,
  pageSizeOptions: [10, 20, 50, 100],
});
