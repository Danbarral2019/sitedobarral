'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { getLeiArticles } from '@/lib/lei-articles';
import { Star, ChevronDown, ChevronUp, ExternalLink, X, Pencil, Eye, PenLine } from 'lucide-react';

interface TribunalDecisionData {
  id: string;
  title: string;
  ementa: string;
  url: string | null;
  tribunalCode: string;
  tribunalName: string;
  decisionNumber: string;
  year: number;
  relator: string | null;
  orgaoJulgador: string | null;
  dataJulgamento: string | null;
  leiArticles: string | null;
  themes: string | null;
}

interface TribunalHighlight {
  id: string;
  tribunalDecisionId: string;
  tribunalDecision: TribunalDecisionData;
  keywordScore: number;
  aiArticleWorthiness: number;
  aiThesisSummary: string;
  aiWhyImportant: string;
  aiArticleAngle: string;
  aiLeiConnections: string | null;
  status: string;
  adminNotes: string | null;
  blogPostId: string | null;
  emailSentAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface Stats {
  pending: number;
  dismissed: number;
  willWrite: number;
  written: number;
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pendente',
  dismissed: 'Descartado',
  will_write: 'Vou Escrever',
  written: 'Escrito',
};

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  dismissed: 'bg-gray-100 text-gray-600',
  will_write: 'bg-blue-100 text-blue-800',
  written: 'bg-green-100 text-green-800',
};

const TRIBUNAL_COLORS: Record<string, string> = {
  'TCE-SP': 'bg-red-100 text-red-700 border-red-200',
  'TCE-MG': 'bg-amber-100 text-amber-700 border-amber-200',
  'TCE-PR': 'bg-emerald-100 text-emerald-700 border-emerald-200',
  'TCE-SC': 'bg-sky-100 text-sky-700 border-sky-200',
  'TCE-RJ': 'bg-orange-100 text-orange-700 border-orange-200',
  'TCE-RS': 'bg-violet-100 text-violet-700 border-violet-200',
  'TCE-PE': 'bg-teal-100 text-teal-700 border-teal-200',
  'DATAJUD-STJ': 'bg-rose-100 text-rose-700 border-rose-200',
};

const TABS = [
  { key: '', label: 'Todos' },
  { key: 'pending', label: 'Pendentes' },
  { key: 'will_write', label: 'Vou Escrever' },
  { key: 'written', label: 'Escritos' },
  { key: 'dismissed', label: 'Descartados' },
];

export default function TribunalHighlightsPage() {
  const router = useRouter();
  const [highlights, setHighlights] = useState<TribunalHighlight[]>([]);
  const [stats, setStats] = useState<Stats>({ pending: 0, dismissed: 0, willWrite: 0, written: 0 });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [editingNotes, setEditingNotes] = useState<string | null>(null);
  const [notesValue, setNotesValue] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchHighlights = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: '20' });
      if (activeTab) params.set('status', activeTab);

      const res = await fetch(`/api/admin/tribunal-highlights?${params}`);
      if (res.ok) {
        const data = await res.json();
        setHighlights(data.highlights);
        setStats(data.stats);
        setTotalPages(data.totalPages);
      }
    } catch (err) {
      console.error('Erro ao carregar destaques:', err);
    } finally {
      setLoading(false);
    }
  }, [activeTab, page]);

  useEffect(() => {
    fetchHighlights();
  }, [fetchHighlights]);

  const updateStatus = async (id: string, status: string) => {
    try {
      const res = await fetch(`/api/admin/tribunal-highlights/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        fetchHighlights();
      }
    } catch (err) {
      console.error('Erro ao atualizar status:', err);
    }
  };

  const saveNotes = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/tribunal-highlights/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminNotes: notesValue }),
      });
      if (res.ok) {
        setEditingNotes(null);
        fetchHighlights();
      }
    } catch (err) {
      console.error('Erro ao salvar notas:', err);
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const parseLeiConnections = (json: string | null): Array<{ article: string; connection: string }> => {
    if (!json) return [];
    try {
      return JSON.parse(json);
    } catch {
      return [];
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('pt-BR');
  };

  const getTribunalColor = (code: string) => {
    return TRIBUNAL_COLORS[code] || 'bg-teal-100 text-teal-700 border-teal-200';
  };

  const totalCount = stats.pending + stats.dismissed + stats.willWrite + stats.written;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Star className="w-7 h-7 text-teal-600" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Destaques TCE</h1>
          <p className="text-sm text-gray-500">Decisoes de Tribunais de Contas Estaduais com potencial editorial</p>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <div className="bg-white rounded-lg border p-4 text-center">
          <div className="text-2xl font-bold text-gray-900">{totalCount}</div>
          <div className="text-xs text-gray-500">Total</div>
        </div>
        <div className="bg-yellow-50 rounded-lg border border-yellow-200 p-4 text-center">
          <div className="text-2xl font-bold text-yellow-700">{stats.pending}</div>
          <div className="text-xs text-yellow-600">Pendentes</div>
        </div>
        <div className="bg-blue-50 rounded-lg border border-blue-200 p-4 text-center">
          <div className="text-2xl font-bold text-blue-700">{stats.willWrite}</div>
          <div className="text-xs text-blue-600">Vou Escrever</div>
        </div>
        <div className="bg-green-50 rounded-lg border border-green-200 p-4 text-center">
          <div className="text-2xl font-bold text-green-700">{stats.written}</div>
          <div className="text-xs text-green-600">Escritos</div>
        </div>
        <div className="bg-gray-50 rounded-lg border p-4 text-center">
          <div className="text-2xl font-bold text-gray-500">{stats.dismissed}</div>
          <div className="text-xs text-gray-400">Descartados</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 rounded-lg p-1 overflow-x-auto">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => { setActiveTab(tab.key); setPage(1); }}
            className={`px-4 py-2 rounded-md text-sm font-medium whitespace-nowrap transition-colors ${
              activeTab === tab.key
                ? 'bg-white text-teal-700 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="text-center py-12 text-gray-400">Carregando...</div>
      ) : highlights.length === 0 ? (
        <div className="text-center py-12">
          <Star className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">Nenhum destaque encontrado</p>
          <p className="text-sm text-gray-400 mt-1">Os destaques sao gerados automaticamente pelo cron semanal de sincronizacao de tribunais</p>
        </div>
      ) : (
        <div className="space-y-4">
          {highlights.map(h => {
            const expanded = expandedIds.has(h.id);
            const leiConnections = parseLeiConnections(h.aiLeiConnections);
            const leiArticles = getLeiArticles(h.tribunalDecision);
            const scoreColor = h.aiArticleWorthiness >= 85 ? 'text-green-700 bg-green-100 border-green-300' : 'text-yellow-700 bg-yellow-100 border-yellow-300';
            const borderColor = h.aiArticleWorthiness >= 85 ? 'border-l-green-500' : 'border-l-yellow-500';

            return (
              <div
                key={h.id}
                className={`bg-white rounded-lg border border-l-4 ${borderColor} shadow-sm overflow-hidden`}
              >
                {/* Header */}
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${getTribunalColor(h.tribunalDecision.tribunalCode)}`}>
                          {h.tribunalDecision.tribunalCode}
                        </span>
                        <h3 className="font-semibold text-gray-900 text-base">{h.tribunalDecision.title}</h3>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${scoreColor}`}>
                          {h.aiArticleWorthiness}/100
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[h.status]}`}>
                          {STATUS_LABELS[h.status]}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-gray-500 flex-wrap">
                        <span>{h.tribunalDecision.decisionNumber}</span>
                        {h.tribunalDecision.relator && <span>Rel. {h.tribunalDecision.relator}</span>}
                        {h.tribunalDecision.orgaoJulgador && <span>{h.tribunalDecision.orgaoJulgador}</span>}
                        {h.tribunalDecision.dataJulgamento && <span>{formatDate(h.tribunalDecision.dataJulgamento)}</span>}
                      </div>
                    </div>
                    <button
                      onClick={() => toggleExpand(h.id)}
                      className="p-1.5 rounded-md hover:bg-gray-100 text-gray-400"
                    >
                      {expanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </button>
                  </div>

                  {/* Tese resumida (sempre visível) */}
                  <p className="text-sm text-gray-600 mt-2 line-clamp-2">{h.aiThesisSummary}</p>

                  {/* Lei articles chips */}
                  {leiArticles.length > 0 && (
                    <div className="flex gap-1 flex-wrap mt-2">
                      {leiArticles.map((art, i) => (
                        <span key={i} className="text-xs bg-teal-50 text-teal-700 px-2 py-0.5 rounded-full">
                          Art. {art}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Expanded Content */}
                {expanded && (
                  <div className="border-t bg-gray-50 p-4 space-y-4">
                    {/* Ementa */}
                    <div>
                      <h4 className="text-sm font-semibold text-gray-700 mb-1">Ementa</h4>
                      <p className="text-sm text-gray-600 line-clamp-6">{h.tribunalDecision.ementa}</p>
                    </div>

                    {/* Importancia */}
                    <div>
                      <h4 className="text-sm font-semibold text-gray-700 mb-1">Por que Merece Destaque</h4>
                      <p className="text-sm text-gray-600">{h.aiWhyImportant}</p>
                    </div>

                    {/* Sugestao editorial */}
                    <div className="bg-teal-50 border border-teal-200 rounded-lg p-3">
                      <h4 className="text-sm font-semibold text-teal-800 mb-1">Sugestao de Artigo</h4>
                      <p className="text-sm text-teal-700">{h.aiArticleAngle}</p>
                    </div>

                    {/* Conexoes Lei 14.133 */}
                    {leiConnections.length > 0 && (
                      <div>
                        <h4 className="text-sm font-semibold text-gray-700 mb-2">Conexoes com a Lei 14.133</h4>
                        <div className="space-y-1">
                          {leiConnections.map((c, i) => (
                            <div key={i} className="flex gap-2 text-sm">
                              <span className="font-medium text-teal-700 whitespace-nowrap">Art. {c.article}:</span>
                              <span className="text-gray-600">{c.connection}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Admin Notes */}
                    <div>
                      <h4 className="text-sm font-semibold text-gray-700 mb-1">Notas do Admin</h4>
                      {editingNotes === h.id ? (
                        <div className="space-y-2">
                          <textarea
                            value={notesValue}
                            onChange={e => setNotesValue(e.target.value)}
                            className="w-full border rounded-lg p-2 text-sm min-h-[80px] focus:ring-2 focus:ring-teal-300 focus:border-teal-400"
                            placeholder="Suas anotacoes sobre esta decisao..."
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() => saveNotes(h.id)}
                              className="px-3 py-1.5 bg-teal-600 text-white text-sm rounded-md hover:bg-teal-700"
                            >
                              Salvar
                            </button>
                            <button
                              onClick={() => setEditingNotes(null)}
                              className="px-3 py-1.5 bg-gray-200 text-gray-700 text-sm rounded-md hover:bg-gray-300"
                            >
                              Cancelar
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div
                          onClick={() => { setEditingNotes(h.id); setNotesValue(h.adminNotes || ''); }}
                          className="text-sm text-gray-500 bg-white border rounded-lg p-2 cursor-pointer hover:border-teal-300 min-h-[40px] flex items-center gap-2"
                        >
                          <Pencil className="w-3.5 h-3.5 flex-shrink-0" />
                          {h.adminNotes || 'Clique para adicionar notas...'}
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 flex-wrap pt-2 border-t">
                      {h.status !== 'dismissed' && (
                        <button
                          onClick={() => updateStatus(h.id, 'dismissed')}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-gray-100 text-gray-600 rounded-md hover:bg-gray-200"
                        >
                          <X className="w-3.5 h-3.5" />
                          Descartar
                        </button>
                      )}
                      {h.status !== 'will_write' && (
                        <button
                          onClick={() => updateStatus(h.id, 'will_write')}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                          Vou Escrever
                        </button>
                      )}
                      {h.status !== 'written' && (
                        <button
                          onClick={() => updateStatus(h.id, 'written')}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-green-100 text-green-700 rounded-md hover:bg-green-200"
                        >
                          <Star className="w-3.5 h-3.5" />
                          Marcar como Escrito
                        </button>
                      )}
                      {h.status === 'dismissed' && (
                        <button
                          onClick={() => updateStatus(h.id, 'pending')}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-yellow-100 text-yellow-700 rounded-md hover:bg-yellow-200"
                        >
                          Restaurar
                        </button>
                      )}
                      {(h.status === 'will_write') && !h.blogPostId && (
                        <button
                          onClick={() => router.push(`/admin/blog/new?fromTribunalHighlight=${h.id}`)}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-orange-100 text-orange-700 rounded-md hover:bg-orange-200"
                        >
                          <PenLine className="w-3.5 h-3.5" />
                          Criar Post no Blog
                        </button>
                      )}
                      {h.blogPostId && (
                        <button
                          onClick={() => router.push(`/admin/blog/${h.blogPostId}`)}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-green-100 text-green-700 rounded-md hover:bg-green-200"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          Ver Post
                        </button>
                      )}
                      {h.tribunalDecision.url && (
                        <a
                          href={h.tribunalDecision.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-teal-100 text-teal-700 rounded-md hover:bg-teal-200"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          Ver Decisao
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-6">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1.5 text-sm border rounded-md disabled:opacity-40 hover:bg-gray-50"
          >
            Anterior
          </button>
          <span className="px-3 py-1.5 text-sm text-gray-500">
            {page} de {totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-3 py-1.5 text-sm border rounded-md disabled:opacity-40 hover:bg-gray-50"
          >
            Proximo
          </button>
        </div>
      )}
    </div>
  );
}
