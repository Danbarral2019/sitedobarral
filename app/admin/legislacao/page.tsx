'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import AdminLayout from '@/components/AdminLayout';
import {
  Plus, Search, Filter, Edit, Trash2, Eye, FileText,
  Calendar, Building, Scale, ChevronDown, ChevronUp,
  Download, ExternalLink, X
} from 'lucide-react';

interface LegislativeAct {
  id: string;
  type: string;
  number: string;
  year: number;
  fullNumber: string;
  title: string;
  ementa: string;
  summary: string | null;
  issuer: string;
  publishDate: string;
  effectiveDate: string | null;
  hierarchyLevel: number;
  leiArticles: string | null;
  officialUrl: string | null;
  pdfUrl: string | null;
  viewCount: number;
  createdAt: string;
  updatedAt: string;
}

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

export default function LegislacaoAdminPage() {
  const router = useRouter();
  const [acts, setActs] = useState<LegislativeAct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState<Record<string, number>>({});

  // Filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [issuerFilter, setIssuerFilter] = useState('');
  const [yearFilter, setYearFilter] = useState('');

  // Paginação
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const limit = 20;

  // UI state
  const [expandedAct, setExpandedAct] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  // Fetch de atos
  useEffect(() => {
    fetchActs();
  }, [page, typeFilter, issuerFilter, yearFilter, searchTerm]);

  const fetchActs = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', page.toString());
      params.set('limit', limit.toString());
      if (typeFilter) params.set('type', typeFilter);
      if (issuerFilter) params.set('issuer', issuerFilter);
      if (yearFilter) params.set('year', yearFilter);
      if (searchTerm) params.set('search', searchTerm);

      const response = await fetch(`/api/admin/legislative-acts?${params}`);
      if (!response.ok) throw new Error('Erro ao carregar atos');

      const data = await response.json();
      setActs(data.acts);
      setTotal(data.pagination.total);
      setTotalPages(data.pagination.pages);
      setStats(data.stats || {});
    } catch (error) {
      console.error('Erro ao carregar atos:', error);
      alert('Erro ao carregar atos normativos');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: string, fullNumber: string) => {
    if (!confirm(`Confirma exclusão do ato ${fullNumber}?`)) return;

    try {
      const response = await fetch(`/api/admin/legislative-acts/${id}`, {
        method: 'DELETE'
      });

      if (!response.ok) throw new Error('Erro ao excluir ato');

      alert('Ato excluído com sucesso!');
      fetchActs();
    } catch (error) {
      console.error('Erro ao excluir:', error);
      alert('Erro ao excluir ato normativo');
    }
  };

  const toggleExpand = (actId: string) => {
    setExpandedAct(expandedAct === actId ? null : actId);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('pt-BR');
  };

  const getLeiArticles = (leiArticlesJson: string | null) => {
    if (!leiArticlesJson) return [];
    try {
      return JSON.parse(leiArticlesJson);
    } catch {
      return [];
    }
  };

  return (
    <AdminLayout>
      <div className="p-6 md:p-8 max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center">
              <Scale className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Atos Normativos</h1>
              <p className="text-gray-600">Gestão de Legislação da Lei 14.133/2021</p>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
              <div className="text-sm font-medium text-blue-700 mb-1">Decretos</div>
              <div className="text-2xl font-bold text-blue-900">{stats.decreto || 0}</div>
            </div>
            <div className="bg-purple-50 border-2 border-purple-200 rounded-lg p-4">
              <div className="text-sm font-medium text-purple-700 mb-1">INs SEGES</div>
              <div className="text-2xl font-bold text-purple-900">{stats.in || 0}</div>
            </div>
            <div className="bg-green-50 border-2 border-green-200 rounded-lg p-4">
              <div className="text-sm font-medium text-green-700 mb-1">Portarias</div>
              <div className="text-2xl font-bold text-green-900">{stats.portaria || 0}</div>
            </div>
            <div className="bg-gray-50 border-2 border-gray-200 rounded-lg p-4">
              <div className="text-sm font-medium text-gray-700 mb-1">Total</div>
              <div className="text-2xl font-bold text-gray-900">{total}</div>
            </div>
          </div>

          {/* Toolbar */}
          <div className="flex flex-col md:flex-row gap-4">
            {/* Busca */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar por número, título ou ementa..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setPage(1);
                }}
                className="w-full pl-10 pr-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Botões */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2 px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
            >
              <Filter className="w-5 h-5" />
              Filtros
              {showFilters ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            <button
              onClick={() => router.push('/admin/legislacao/new')}
              className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-5 h-5" />
              Novo Ato
            </button>
          </div>

          {/* Filtros Expandidos */}
          {showFilters && (
            <div className="mt-4 p-4 bg-gray-50 border-2 border-gray-200 rounded-lg">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Tipo</label>
                  <select
                    value={typeFilter}
                    onChange={(e) => {
                      setTypeFilter(e.target.value);
                      setPage(1);
                    }}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Todos os tipos</option>
                    <option value="decreto">Decreto</option>
                    <option value="in">IN SEGES</option>
                    <option value="portaria">Portaria</option>
                    <option value="lei">Lei</option>
                    <option value="medida-provisoria">Medida Provisória</option>
                    <option value="ordem-servico">Ordem de Serviço</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Órgão Emissor</label>
                  <select
                    value={issuerFilter}
                    onChange={(e) => {
                      setIssuerFilter(e.target.value);
                      setPage(1);
                    }}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Todos os órgãos</option>
                    <option value="Presidência">Presidência</option>
                    <option value="SEGES">SEGES</option>
                    <option value="MGI">MGI</option>
                    <option value="AGU">AGU</option>
                    <option value="TCU">TCU</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Ano</label>
                  <select
                    value={yearFilter}
                    onChange={(e) => {
                      setYearFilter(e.target.value);
                      setPage(1);
                    }}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Todos os anos</option>
                    {[2025, 2024, 2023, 2022, 2021].map(y => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
              </div>

              <button
                onClick={() => {
                  setTypeFilter('');
                  setIssuerFilter('');
                  setYearFilter('');
                  setSearchTerm('');
                  setPage(1);
                }}
                className="mt-4 flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:text-gray-900"
              >
                <X className="w-4 h-4" />
                Limpar filtros
              </button>
            </div>
          )}
        </div>

        {/* Lista de Atos */}
        {isLoading ? (
          <div className="text-center py-12">
            <div className="inline-block w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="mt-4 text-gray-600">Carregando atos normativos...</p>
          </div>
        ) : acts.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-gray-200">
            <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">Nenhum ato normativo encontrado</p>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              {acts.map(act => (
                <div key={act.id} className="bg-white border-2 border-gray-200 rounded-lg overflow-hidden hover:border-blue-300 transition-colors">
                  {/* Header do Card */}
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`px-2 py-1 text-xs font-bold rounded ${TYPE_COLORS[act.type] || 'bg-gray-100 text-gray-800'}`}>
                            {TYPE_LABELS[act.type] || act.type}
                          </span>
                          <span className="text-sm font-mono text-gray-600">{act.fullNumber}</span>
                          <span className="text-sm text-gray-500">•</span>
                          <span className="text-sm text-gray-600">{act.issuer}</span>
                        </div>

                        <h3 className="text-lg font-bold text-gray-900 mb-1">{act.title}</h3>
                        <p className="text-sm text-gray-600 line-clamp-2">{act.ementa}</p>

                        <div className="flex flex-wrap items-center gap-4 mt-3 text-xs text-gray-500">
                          <div className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            {formatDate(act.publishDate)}
                          </div>
                          <div className="flex items-center gap-1">
                            <Eye className="w-4 h-4" />
                            {act.viewCount} visualizações
                          </div>
                          {getLeiArticles(act.leiArticles).length > 0 && (
                            <div className="flex items-center gap-1">
                              <Scale className="w-4 h-4" />
                              {getLeiArticles(act.leiArticles).length} artigos relacionados
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Ações */}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => toggleExpand(act.id)}
                          className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                          title="Ver detalhes"
                        >
                          {expandedAct === act.id ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                        </button>
                        <button
                          onClick={() => router.push(`/admin/legislacao/${act.id}/edit`)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Editar"
                        >
                          <Edit className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => handleDelete(act.id, act.fullNumber)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Excluir"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Detalhes Expandidos */}
                  {expandedAct === act.id && (
                    <div className="border-t-2 border-gray-200 p-4 bg-gray-50">
                      {act.summary && (
                        <div className="mb-4">
                          <h4 className="text-sm font-bold text-gray-700 mb-2">Resumo Didático</h4>
                          <p className="text-sm text-gray-600">{act.summary}</p>
                        </div>
                      )}

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        {act.effectiveDate && (
                          <div>
                            <span className="font-semibold text-gray-700">Data de Vigência:</span> {formatDate(act.effectiveDate)}
                          </div>
                        )}
                        <div>
                          <span className="font-semibold text-gray-700">Hierarquia:</span> Nível {act.hierarchyLevel}
                        </div>
                      </div>

                      {getLeiArticles(act.leiArticles).length > 0 && (
                        <div className="mt-4">
                          <h4 className="text-sm font-bold text-gray-700 mb-2">Artigos da Lei 14.133/2021</h4>
                          <div className="flex flex-wrap gap-2">
                            {getLeiArticles(act.leiArticles).map((art: string) => (
                              <span key={art} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-semibold rounded">
                                Art. {art}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="flex gap-2 mt-4">
                        {act.officialUrl && (
                          <a
                            href={act.officialUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                          >
                            <ExternalLink className="w-4 h-4" />
                            Ver no Site Oficial
                          </a>
                        )}
                        {act.pdfUrl && (
                          <a
                            href={act.pdfUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
                          >
                            <Download className="w-4 h-4" />
                            Download PDF
                          </a>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Paginação */}
            {totalPages > 1 && (
              <div className="mt-8 flex justify-center items-center gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-4 py-2 border-2 border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  Anterior
                </button>

                <span className="px-4 py-2 text-gray-700">
                  Página {page} de {totalPages}
                </span>

                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-4 py-2 border-2 border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  Próxima
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </AdminLayout>
  );
}
