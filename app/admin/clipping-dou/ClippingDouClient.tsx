'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { Inbox, CheckCircle2, XCircle, ExternalLink, Filter, RefreshCw } from 'lucide-react';

interface StagingItem {
  id: string;
  title: string;
  abstract: string;
  url: string;
  hierarchyStr: string | null;
  publishDate: string;
  score: number;
  reason: string;
  summary: string;
  affects: string[];
  actType: string | null;
  ambiguous: boolean;
  model: string | null;
  promptVersion: string | null;
  source: string | null;
  createdAt: string;
}

interface ListResponse {
  items: StagingItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  lastCronAt: string | null;
}

const ACT_TYPES = ['', 'decreto', 'portaria', 'in', 'lei', 'mp', 'on'];

export default function ClippingDouClient() {
  const searchParams = useSearchParams();
  const fromEmail = searchParams.get('from') === 'email';
  const stagingIdsFromEmail = searchParams.get('staging_ids') || '';

  const [data, setData] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [ambiguousOnly, setAmbiguousOnly] = useState(false);
  const [actType, setActType] = useState('');
  const [source, setSource] = useState('');
  const [acting, setActing] = useState<Set<string>>(new Set());

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ page: String(page), pageSize: '20' });
      if (ambiguousOnly) qs.set('ambiguous', 'true');
      if (actType) qs.set('actType', actType);
      if (source) qs.set('source', source);
      if (fromEmail && stagingIdsFromEmail) qs.set('staging_ids', stagingIdsFromEmail);

      const res = await fetch(`/api/admin/clipping-dou/list?${qs}`);
      if (res.ok) setData(await res.json());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [page, ambiguousOnly, actType, source, fromEmail, stagingIdsFromEmail]);

  useEffect(() => { fetchList(); }, [fetchList]);

  const act = async (id: string, action: 'approve' | 'reject', reason?: string) => {
    setActing((prev) => new Set(prev).add(id));
    try {
      const res = await fetch(`/api/admin/clipping-dou/${id}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: action === 'reject' ? JSON.stringify({ reason: reason || '' }) : '{}',
      });
      if (res.ok) {
        await fetchList();
      } else {
        const err = await res.json().catch(() => ({}));
        alert(`Erro: ${err.error || res.status}`);
      }
    } finally {
      setActing((prev) => { const n = new Set(prev); n.delete(id); return n; });
    }
  };

  const formatDate = (iso: string | null) => iso ? new Date(iso).toLocaleString('pt-BR') : '—';

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <Inbox className="w-7 h-7 text-orange-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Clipping DOU</h1>
            <p className="text-sm text-gray-500">
              {data?.total ?? 0} norma(s) pendente(s) · último cron: {formatDate(data?.lastCronAt ?? null)}
            </p>
          </div>
        </div>
        <button
          onClick={fetchList}
          className="flex items-center gap-2 px-3 py-2 text-sm bg-orange-100 text-orange-700 rounded-md hover:bg-orange-200"
        >
          <RefreshCw className="w-4 h-4" /> Atualizar
        </button>
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-3 mb-6 flex-wrap bg-orange-50 border border-orange-200 rounded-lg p-3">
        <Filter className="w-4 h-4 text-orange-600" />
        <label className="flex items-center gap-2 text-sm text-orange-900">
          <input type="checkbox" checked={ambiguousOnly} onChange={(e) => { setAmbiguousOnly(e.target.checked); setPage(1); }} />
          Só ambíguos
        </label>
        <select
          value={actType}
          onChange={(e) => { setActType(e.target.value); setPage(1); }}
          className="text-sm border border-orange-300 rounded-md px-2 py-1 bg-white"
        >
          {ACT_TYPES.map((t) => (
            <option key={t} value={t}>{t || 'todos os tipos'}</option>
          ))}
        </select>
        <select
          value={source}
          onChange={(e) => { setSource(e.target.value); setPage(1); }}
          className="text-sm border border-orange-300 rounded-md px-2 py-1 bg-white"
        >
          <option value="">cron + lookback</option>
          <option value="cron">só cron</option>
          <option value="lookback">só lookback</option>
        </select>
      </div>

      {fromEmail && stagingIdsFromEmail && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
          Mostrando os {stagingIdsFromEmail.split(',').length} item(ns) do email. Limpe filtro pra ver fila completa.
        </div>
      )}

      {/* Lista */}
      {loading ? (
        <div className="text-center py-12 text-gray-400">Carregando...</div>
      ) : !data || data.items.length === 0 ? (
        <div className="text-center py-12">
          <Inbox className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">Nenhuma norma pendente.</p>
          <p className="text-sm text-gray-400">Próximo cron diário às 08:00 UTC (05:00 BRT).</p>
        </div>
      ) : (
        <div className="space-y-4">
          {data.items.map((it) => {
            const scoreColor = it.score >= 80 ? 'border-l-green-500' : it.score >= 70 ? 'border-l-blue-500' : 'border-l-yellow-500';
            const scoreBadge = it.score >= 80 ? 'bg-green-100 text-green-700' : it.score >= 70 ? 'bg-blue-100 text-blue-700' : 'bg-yellow-100 text-yellow-700';
            const isActing = acting.has(it.id);
            return (
              <div key={it.id} className={`bg-white rounded-lg border border-l-4 ${scoreColor} shadow-sm p-5`}>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-xs uppercase tracking-wide text-orange-700 font-semibold mb-1">
                      {it.actType || 'ato'} · {it.hierarchyStr || '—'} · {it.publishDate}
                      {it.source === 'lookback' && (
                        <span className="ml-2 px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full text-[10px]">lookback</span>
                      )}
                    </div>
                    <h3 className="font-semibold text-gray-900 text-base">{it.title}</h3>
                  </div>
                  <span className={`text-xs font-bold px-2 py-1 rounded-full ${scoreBadge}`}>
                    {it.score}/100{it.ambiguous && ' · ambíguo'}
                  </span>
                </div>

                <div className="bg-slate-50 rounded-md p-3 mb-2">
                  <div className="text-xs font-semibold text-slate-600 uppercase mb-1">Resumo IA</div>
                  <p className="text-sm text-slate-700">{it.summary || '—'}</p>
                </div>

                <div className="bg-orange-50 rounded-md p-3 mb-2 border border-orange-200">
                  <div className="text-xs font-semibold text-orange-800 uppercase mb-1">Por que está aqui</div>
                  <p className="text-sm text-orange-900">{it.reason || '—'}</p>
                </div>

                {it.affects.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {it.affects.map((a, i) => (
                      <span key={i} className="text-xs bg-orange-100 text-orange-800 px-2 py-0.5 rounded-full">{a}</span>
                    ))}
                  </div>
                )}

                <details className="mb-3 text-xs text-slate-500">
                  <summary className="cursor-pointer">Conteúdo bruto + detalhes IA</summary>
                  <div className="mt-2 p-2 bg-slate-50 rounded border border-slate-200 max-h-40 overflow-auto">
                    <p className="whitespace-pre-wrap">{it.abstract}</p>
                    <p className="mt-2 text-slate-400">model: {it.model} · prompt: {it.promptVersion}</p>
                  </div>
                </details>

                <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-100">
                  <button
                    disabled={isActing}
                    onClick={() => act(it.id, 'approve')}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-green-100 text-green-700 rounded-md hover:bg-green-200 disabled:opacity-50"
                  >
                    <CheckCircle2 className="w-4 h-4" /> Aprovar
                  </button>
                  <button
                    disabled={isActing}
                    onClick={() => {
                      const reason = window.prompt('Motivo (opcional):') || undefined;
                      void act(it.id, 'reject', reason);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 disabled:opacity-50"
                  >
                    <XCircle className="w-4 h-4" /> Rejeitar
                  </button>
                  <a
                    href={it.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-orange-100 text-orange-700 rounded-md hover:bg-orange-200"
                  >
                    <ExternalLink className="w-4 h-4" /> Ver DOU
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Paginação */}
      {data && data.totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-6">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1.5 text-sm border rounded-md disabled:opacity-40 hover:bg-gray-50"
          >
            Anterior
          </button>
          <span className="px-3 py-1.5 text-sm text-gray-500">{page} de {data.totalPages}</span>
          <button
            onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
            disabled={page === data.totalPages}
            className="px-3 py-1.5 text-sm border rounded-md disabled:opacity-40 hover:bg-gray-50"
          >
            Próximo
          </button>
        </div>
      )}
    </div>
  );
}
