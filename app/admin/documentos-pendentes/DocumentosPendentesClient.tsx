'use client';

import { useState, useCallback } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import AdminLayout from '@/components/AdminLayout';
import {
  CheckCircle, XCircle, ExternalLink, Calendar, Tag,
  Search, Loader2, FileText, AlertCircle,
  ChevronLeft, ChevronRight
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { safeParseArray } from '@/lib/utils';
import { buildSearchParams } from '@/lib/url-state';

interface PendingDocument {
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
}

interface Props {
  documents: PendingDocument[];
  pagination: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
}

export default function DocumentosPendentesClient({ documents, pagination }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  // Estado cliente local (não vai para URL)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isProcessing, setIsProcessing] = useState(false);
  const [searchTerm, setSearchTerm] = useState(''); // Filtro visual client-side

  // Filtros da URL
  const filterCategory = searchParams.get('category') || '';
  const filterPeriod = searchParams.get('period') || 'all';

  // Atualizar filtros via URL
  const updateFilter = useCallback((key: string, value: string | null) => {
    const query = buildSearchParams(searchParams, { [key]: value });
    router.replace(`${pathname}?${query}`);
  }, [router, pathname, searchParams]);

  // Selecionar/desselecionar documento
  function toggleSelection(id: string) {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  }

  // Filtrar documentos por busca visual (client-side)
  function getFilteredDocuments() {
    if (!searchTerm) return documents;

    const term = searchTerm.toLowerCase();
    return documents.filter(doc =>
      doc.title.toLowerCase().includes(term) ||
      doc.description?.toLowerCase().includes(term) ||
      doc.category.toLowerCase().includes(term)
    );
  }

  const filteredDocs = getFilteredDocuments();

  // Selecionar todos visíveis
  function selectAll() {
    setSelectedIds(new Set(filteredDocs.map(d => d.id)));
  }

  // Limpar seleção
  function clearSelection() {
    setSelectedIds(new Set());
  }

  // Aprovar documentos
  async function handleApprove(ids: string[]) {
    if (ids.length === 0) {
      toast({
        title: 'Erro',
        description: 'Selecione ao menos um documento',
        variant: 'error',
      });
      return;
    }

    setIsProcessing(true);
    try {
      const res = await fetch('/api/admin/documents/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentIds: ids,
          action: 'approve',
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || `Erro HTTP ${res.status}`);
      }

      toast({
        title: 'Sucesso!',
        description: `${data.count} documento(s) aprovado(s)`,
        variant: 'success',
      });

      // Recarregar página para atualizar lista
      router.refresh();
      clearSelection();

    } catch (err) {
      console.error('[handleApprove] Erro:', err);
      toast({
        title: 'Erro ao aprovar',
        description: err instanceof Error ? err.message : 'Erro desconhecido',
        variant: 'error',
      });
    } finally {
      setIsProcessing(false);
    }
  }

  // Rejeitar documentos
  async function handleReject(ids: string[]) {
    if (ids.length === 0) {
      toast({
        title: 'Erro',
        description: 'Selecione ao menos um documento',
        variant: 'error',
      });
      return;
    }

    setIsProcessing(true);
    try {
      const res = await fetch('/api/admin/documents/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentIds: ids,
          action: 'reject',
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || `Erro HTTP ${res.status}`);
      }

      toast({
        title: 'Rejeitado',
        description: `${data.count} documento(s) rejeitado(s)`,
        variant: 'success',
      });

      // Recarregar página para atualizar lista
      router.refresh();
      clearSelection();

    } catch (err) {
      console.error('[handleReject] Erro:', err);
      toast({
        title: 'Erro ao rejeitar',
        description: err instanceof Error ? err.message : 'Erro desconhecido',
        variant: 'error',
      });
    } finally {
      setIsProcessing(false);
    }
  }

  const selectedCount = selectedIds.size;

  return (
    <AdminLayout>
      <div className="min-h-screen bg-gray-50 p-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Documentos Pendentes de Aprovação
          </h1>
          <p className="text-gray-600">
            Revise e aprove documentos importados automaticamente (DOU, TCU, AGU)
          </p>
        </div>

        {/* Estatísticas */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <AlertCircle className="w-6 h-6 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Pendentes</p>
                <p className="text-2xl font-bold text-gray-900">{pagination.total}</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-4 rounded-lg shadow">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <FileText className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Selecionados</p>
                <p className="text-2xl font-bold text-gray-900">{selectedCount}</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-4 rounded-lg shadow">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Filtrados</p>
                <p className="text-2xl font-bold text-gray-900">{filteredDocs.length}</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-4 rounded-lg shadow">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Calendar className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Período</p>
                <p className="text-lg font-semibold text-gray-900">
                  {filterPeriod === 'today' ? 'Hoje' : filterPeriod === 'week' ? 'Semana' : filterPeriod === 'month' ? 'Mês' : 'Todos'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Filtros e Busca */}
        <div className="bg-white p-4 rounded-lg shadow mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Busca (client-side visual filter) */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Buscar
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Título, descrição ou categoria..."
                  className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            {/* Filtro de Categoria (URL state) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Categoria
              </label>
              <select
                value={filterCategory}
                onChange={(e) => updateFilter('category', e.target.value || null)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Todas</option>
                <option value="portaria">Portaria</option>
                <option value="decreto">Decreto</option>
                <option value="edital">Edital</option>
                <option value="instrucao-normativa">Instrução Normativa</option>
                <option value="orientacao-normativa">Orientação Normativa</option>
                <option value="parecer">Parecer</option>
                <option value="acordao">Acórdão</option>
                <option value="outros">Outros</option>
              </select>
            </div>

            {/* Filtro de Período (URL state) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Período
              </label>
              <select
                value={filterPeriod}
                onChange={(e) => updateFilter('period', e.target.value || null)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">Todos</option>
                <option value="today">Hoje</option>
                <option value="week">Esta Semana</option>
                <option value="month">Este Mês</option>
              </select>
            </div>
          </div>
        </div>

        {/* Ações em Lote */}
        {selectedCount > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-blue-900">
                  {selectedCount} documento(s) selecionado(s)
                </p>
                <p className="text-sm text-blue-700">
                  Escolha uma ação para aplicar em lote
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={clearSelection}
                  className="px-4 py-2 text-blue-700 hover:bg-blue-100 rounded-lg transition"
                >
                  Limpar Seleção
                </button>

                <button
                  onClick={() => handleReject(Array.from(selectedIds))}
                  disabled={isProcessing}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition flex items-center gap-2 disabled:opacity-50"
                >
                  {isProcessing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <XCircle className="w-4 h-4" />
                  )}
                  Rejeitar Selecionados
                </button>

                <button
                  onClick={() => handleApprove(Array.from(selectedIds))}
                  disabled={isProcessing}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition flex items-center gap-2 disabled:opacity-50"
                >
                  {isProcessing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle className="w-4 h-4" />
                  )}
                  Aprovar Selecionados
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Ações Globais */}
        <div className="flex justify-between items-center mb-4">
          <button
            onClick={selectAll}
            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
          >
            Selecionar Todos ({filteredDocs.length})
          </button>

          <button
            onClick={() => router.refresh()}
            className="text-gray-600 hover:text-gray-800 text-sm font-medium flex items-center gap-2"
          >
            Atualizar
          </button>
        </div>

        {/* Lista de Documentos */}
        {filteredDocs.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-700 mb-2">
              Nenhum documento pendente
            </h3>
            <p className="text-gray-500">
              Todos os documentos foram revisados ou não há documentos com os filtros selecionados.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {filteredDocs.map((doc) => (
              <div
                key={doc.id}
                className={`bg-white rounded-lg shadow p-6 transition border-2 ${
                  selectedIds.has(doc.id)
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-transparent hover:border-gray-200'
                }`}
              >
                <div className="flex items-start gap-4">
                  {/* Checkbox */}
                  <input
                    type="checkbox"
                    checked={selectedIds.has(doc.id)}
                    onChange={() => toggleSelection(doc.id)}
                    className="mt-1 w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                  />

                  {/* Conteúdo */}
                  <div className="flex-1">
                    {/* Título */}
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      {doc.title}
                    </h3>

                    {/* Descrição */}
                    {doc.description && (
                      <p className="text-gray-600 mb-3 line-clamp-2">
                        {doc.description}
                      </p>
                    )}

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

                      {doc.tags && safeParseArray(doc.tags).slice(0, 3).map((tag: string, idx: number) => (
                        <span
                          key={idx}
                          className="px-3 py-1 bg-gray-100 text-gray-600 text-xs rounded-full"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>

                    {/* Data de Upload */}
                    <p className="text-xs text-gray-500">
                      Importado em {new Date(doc.uploadedAt).toLocaleString('pt-BR')}
                    </p>
                  </div>

                  {/* Ações Individuais */}
                  <div className="flex flex-col gap-2">
                    {/* Visualizar */}
                    <a
                      href={doc.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                      title="Visualizar documento"
                    >
                      <ExternalLink className="w-5 h-5" />
                    </a>

                    {/* Aprovar */}
                    <button
                      onClick={() => handleApprove([doc.id])}
                      disabled={isProcessing}
                      className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition disabled:opacity-50"
                      title="Aprovar este documento"
                    >
                      <CheckCircle className="w-5 h-5" />
                    </button>

                    {/* Rejeitar */}
                    <button
                      onClick={() => handleReject([doc.id])}
                      disabled={isProcessing}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition disabled:opacity-50"
                      title="Rejeitar este documento"
                    >
                      <XCircle className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Paginação */}
        {pagination.totalPages > 1 && (
          <div className="bg-white rounded-lg shadow p-4 mt-6">
            <div className="flex items-center justify-between">
              {/* Info de paginação */}
              <div className="text-sm text-gray-600">
                Exibindo <span className="font-semibold">{((pagination.page - 1) * pagination.pageSize) + 1}</span> a{' '}
                <span className="font-semibold">
                  {Math.min(pagination.page * pagination.pageSize, pagination.total)}
                </span>{' '}
                de <span className="font-semibold">{pagination.total}</span> documentos
              </div>

              {/* Controles de navegação */}
              <div className="flex items-center gap-2">
                {/* Botão Anterior */}
                <button
                  onClick={() => updateFilter('page', String(pagination.page - 1))}
                  disabled={pagination.page === 1}
                  className="px-3 py-2 border rounded-lg hover:bg-gray-50 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  title="Página anterior"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Anterior
                </button>

                {/* Números de página */}
                <div className="flex gap-1">
                  {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                    // Mostrar até 5 páginas com a atual no meio
                    let pageNumber;
                    if (pagination.totalPages <= 5) {
                      pageNumber = i + 1;
                    } else if (pagination.page <= 3) {
                      pageNumber = i + 1;
                    } else if (pagination.page >= pagination.totalPages - 2) {
                      pageNumber = pagination.totalPages - 4 + i;
                    } else {
                      pageNumber = pagination.page - 2 + i;
                    }

                    return (
                      <button
                        key={pageNumber}
                        onClick={() => updateFilter('page', String(pageNumber))}
                        className={`w-10 h-10 rounded-lg transition ${
                          pagination.page === pageNumber
                            ? 'bg-blue-600 text-white font-semibold'
                            : 'border hover:bg-gray-50'
                        }`}
                      >
                        {pageNumber}
                      </button>
                    );
                  })}
                </div>

                {/* Botão Próximo */}
                <button
                  onClick={() => updateFilter('page', String(pagination.page + 1))}
                  disabled={pagination.page === pagination.totalPages}
                  className="px-3 py-2 border rounded-lg hover:bg-gray-50 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  title="Próxima página"
                >
                  Próximo
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              {/* Seletor de pageSize */}
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-600">Itens por página:</label>
                <select
                  value={pagination.pageSize}
                  onChange={(e) => {
                    updateFilter('pageSize', e.target.value);
                    updateFilter('page', '1'); // Reset to page 1 when changing page size
                  }}
                  className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="25">25</option>
                  <option value="50">50</option>
                  <option value="100">100</option>
                  <option value="200">200</option>
                </select>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
