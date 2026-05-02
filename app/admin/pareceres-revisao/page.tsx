'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Loader2, ArrowLeft, Search, ExternalLink, RefreshCw, Check, X, Undo2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Item {
  id: string;
  title: string;
  description: string | null;
  url: string;
  category: string;
  uploadedAt: string;
  licitacoesContratos: boolean | null;
  licitacoesContratosAi: boolean | null;
  manualBy: string | null;
  manualAt: string | null;
  confidence: string | null;
  reasoning: string | null;
  cursosRelevantes: string[];
  leiArticles: string[];
  subtemas: string[];
  vigencia: string | null;
  orgao: string | null;
}

type Filter = 'irrelevantes' | 'relevantes' | 'overrides' | 'todos';

const FILTER_LABELS: Record<Filter, string> = {
  irrelevantes: 'Marcados como irrelevantes',
  relevantes: 'Marcados como relevantes',
  overrides: 'Com override manual',
  todos: 'Todos',
};

const TIPO_LABEL: Record<string, string> = {
  parecer: 'Parecer',
  'parecer-vinculante': 'Vinculante',
  'nota-tecnica': 'Nota técnica',
  despacho: 'Despacho',
  decor: 'DECOR (legado)',
};

export default function PareceresRevisaoPage() {
  const { success, error: errorToast } = useToast();
  const [items, setItems] = useState<Item[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filter, setFilter] = useState<Filter>('irrelevantes');
  const [q, setQ] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        filter, page: String(page), pageSize: '30',
      });
      if (q) params.set('q', q);
      const res = await fetch(`/api/admin/pareceres/list?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setItems(data.items);
      setTotal(data.total);
      setTotalPages(data.totalPages);
    } catch (err) {
      errorToast((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [filter, page, q, errorToast]);

  useEffect(() => { load(); }, [load]);

  async function classify(docId: string, value: boolean | 'clear') {
    setBusyIds(prev => new Set(prev).add(docId));
    try {
      const body = value === 'clear'
        ? { docId, clearOverride: true }
        : { docId, licitacoesContratos: value };
      const res = await fetch('/api/admin/pareceres/classify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      success(value === 'clear' ? 'Override removido' : value ? 'Marcado como relevante' : 'Marcado como irrelevante');
      // Remove o item da lista se ele não bate mais com o filtro atual
      setItems(prev => prev.filter(it => it.id !== docId));
      setTotal(t => Math.max(0, t - 1));
    } catch (err) {
      errorToast((err as Error).message);
    } finally {
      setBusyIds(prev => {
        const n = new Set(prev);
        n.delete(docId);
        return n;
      });
    }
  }

  function toggleExpand(id: string) {
    setExpanded(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <Link href="/admin" className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-blue-700 mb-4">
          <ArrowLeft className="w-4 h-4" />
          Admin
        </Link>

        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Revisão de classificação CONUNI</h1>
            <p className="text-sm text-gray-600 mt-1">
              Reverte falsos negativos/positivos do Gemini. Override manual tem prioridade sobre IA e é preservado em sincronizações futuras.
            </p>
          </div>
          <button
            onClick={() => load()}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:border-blue-400 hover:text-blue-700"
            title="Recarregar"
          >
            <RefreshCw className="w-4 h-4" />
            Recarregar
          </button>
        </div>

        {/* Filtros */}
        <div className="flex flex-wrap gap-2 mb-4">
          {(Object.keys(FILTER_LABELS) as Filter[]).map(f => (
            <button
              key={f}
              onClick={() => { setFilter(f); setPage(1); }}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                filter === f ? 'bg-blue-600 text-white' : 'bg-white border border-gray-300 text-gray-700 hover:border-blue-400'
              }`}
            >
              {FILTER_LABELS[f]}
            </button>
          ))}
        </div>

        {/* Busca */}
        <form
          onSubmit={(e) => { e.preventDefault(); setQ(searchInput); setPage(1); }}
          className="mb-6 flex gap-2"
        >
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Buscar por título ou ementa..."
              className="w-full pl-10 pr-4 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
            Buscar
          </button>
          {q && (
            <button
              type="button"
              onClick={() => { setQ(''); setSearchInput(''); setPage(1); }}
              className="px-3 py-2 text-sm text-gray-600 hover:text-gray-900"
            >
              Limpar
            </button>
          )}
        </form>

        <p className="text-sm text-gray-600 mb-3">
          {total.toLocaleString('pt-BR')} {total === 1 ? 'documento' : 'documentos'}
        </p>

        {loading ? (
          <div className="bg-white rounded-xl p-12 text-center border border-gray-200">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-3" />
            <p className="text-gray-600">Carregando...</p>
          </div>
        ) : items.length === 0 ? (
          <div className="bg-white rounded-xl p-12 text-center border border-gray-200">
            <p className="text-gray-600">Nenhum documento neste filtro.</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {items.map(it => {
              const isBusy = busyIds.has(it.id);
              const isExp = expanded.has(it.id);
              const isManual = !!it.manualBy;
              const status = it.licitacoesContratos === true ? 'relevante' : it.licitacoesContratos === false ? 'irrelevante' : 'sem-classificacao';

              return (
                <li key={it.id} className="bg-white border border-gray-200 rounded-xl p-4">
                  <div className="flex items-start gap-3 flex-wrap mb-2">
                    <span className={`px-2 py-0.5 text-xs font-bold uppercase tracking-wide rounded-md ${
                      status === 'relevante' ? 'bg-green-100 text-green-800' :
                      status === 'irrelevante' ? 'bg-red-100 text-red-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {status === 'relevante' ? 'Relevante' : status === 'irrelevante' ? 'Irrelevante' : 'Sem class.'}
                    </span>
                    {isManual && (
                      <span className="px-2 py-0.5 text-xs font-bold uppercase tracking-wide bg-blue-100 text-blue-800 rounded-md">
                        Manual
                      </span>
                    )}
                    {it.confidence && !isManual && (
                      <span className={`px-2 py-0.5 text-xs font-medium rounded-md ${
                        it.confidence === 'high' ? 'bg-emerald-50 text-emerald-700' :
                        it.confidence === 'medium' ? 'bg-amber-50 text-amber-700' :
                        'bg-orange-50 text-orange-700'
                      }`}>
                        IA: {it.confidence}
                      </span>
                    )}
                    {TIPO_LABEL[it.category] && (
                      <span className="px-2 py-0.5 text-xs font-semibold bg-gray-100 text-gray-700 rounded-md">
                        {TIPO_LABEL[it.category]}
                      </span>
                    )}
                    {it.orgao && (
                      <span className="px-2 py-0.5 text-xs font-semibold bg-purple-50 text-purple-700 rounded-md">
                        {it.orgao}
                      </span>
                    )}
                    {it.vigencia === 'revogado' && (
                      <span className="px-2 py-0.5 text-xs font-bold bg-red-100 text-red-800 rounded-md">REVOGADO</span>
                    )}
                  </div>

                  <h3 className="font-semibold text-gray-900 leading-snug mb-1">{it.title}</h3>

                  {it.description && (
                    <p className={`text-sm text-gray-600 leading-relaxed ${isExp ? '' : 'line-clamp-2'}`}>
                      {it.description}
                    </p>
                  )}

                  {(it.reasoning || it.subtemas.length > 0 || it.cursosRelevantes.length > 0 || it.leiArticles.length > 0) && (
                    <div className="mt-2 text-xs text-gray-600 space-y-1">
                      {it.reasoning && (
                        <p className="italic">IA: {it.reasoning}</p>
                      )}
                      <div className="flex flex-wrap gap-x-4 gap-y-1">
                        {it.subtemas.length > 0 && <span><strong>Subtemas:</strong> {it.subtemas.join(', ')}</span>}
                        {it.cursosRelevantes.length > 0 && <span><strong>Cursos:</strong> {it.cursosRelevantes.join(', ')}</span>}
                        {it.leiArticles.length > 0 && <span><strong>Arts. 14.133:</strong> {it.leiArticles.join(', ')}</span>}
                      </div>
                      {isManual && (
                        <p className="text-blue-700">
                          Override por <strong>{it.manualBy}</strong> em {it.manualAt && new Date(it.manualAt).toLocaleString('pt-BR')}
                          {it.licitacoesContratosAi !== null && ` (IA havia dito: ${it.licitacoesContratosAi ? 'relevante' : 'irrelevante'})`}
                        </p>
                      )}
                    </div>
                  )}

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <a
                      href={it.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-gray-700 hover:text-blue-700 border border-gray-300 rounded-md"
                    >
                      <ExternalLink className="w-3 h-3" />
                      Abrir
                    </a>
                    <button
                      onClick={() => toggleExpand(it.id)}
                      className="px-2.5 py-1 text-xs font-medium text-gray-600 hover:text-gray-900"
                    >
                      {isExp ? 'Recolher' : 'Expandir'}
                    </button>

                    <div className="ml-auto flex items-center gap-2">
                      {/* Botões de classificação */}
                      {it.licitacoesContratos !== true && (
                        <button
                          onClick={() => classify(it.id, true)}
                          disabled={isBusy}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                        >
                          {isBusy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                          Relevante
                        </button>
                      )}
                      {it.licitacoesContratos !== false && (
                        <button
                          onClick={() => classify(it.id, false)}
                          disabled={isBusy}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                        >
                          {isBusy ? <Loader2 className="w-3 h-3 animate-spin" /> : <X className="w-3 h-3" />}
                          Irrelevante
                        </button>
                      )}
                      {isManual && (
                        <button
                          onClick={() => classify(it.id, 'clear')}
                          disabled={isBusy}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 disabled:opacity-50"
                          title="Restaura a classificação original do Gemini"
                        >
                          {isBusy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Undo2 className="w-3 h-3" />}
                          Desfazer
                        </button>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {/* Paginação */}
        {totalPages > 1 && (
          <nav className="mt-6 flex items-center justify-center gap-2">
            <button
              disabled={page === 1}
              onClick={() => setPage(p => Math.max(1, p - 1))}
              className="px-3 py-1.5 text-sm bg-white border border-gray-300 rounded-lg disabled:opacity-50"
            >
              Anterior
            </button>
            <span className="text-sm text-gray-600">Página {page} de {totalPages}</span>
            <button
              disabled={page === totalPages}
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              className="px-3 py-1.5 text-sm bg-white border border-gray-300 rounded-lg disabled:opacity-50"
            >
              Próxima
            </button>
          </nav>
        )}
      </div>
    </main>
  );
}
