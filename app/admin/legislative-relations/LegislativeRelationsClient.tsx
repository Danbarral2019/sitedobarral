'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import type { PendingRelation } from './page';

const TYPE_COLORS: Record<string, string> = {
  revoga: 'bg-red-100 text-red-700 border-red-300',
  altera: 'bg-amber-100 text-amber-700 border-amber-300',
  regulamenta: 'bg-blue-100 text-blue-700 border-blue-300',
  complementa: 'bg-green-100 text-green-700 border-green-300',
  modifica: 'bg-purple-100 text-purple-700 border-purple-300',
};

const TYPE_ORDER = ['revoga', 'altera', 'regulamenta', 'complementa', 'modifica'] as const;

type GroupBy = 'none' | 'source' | 'target';

interface Props {
  initialPending: PendingRelation[];
  stats: { confirmed: number; rejected: number };
}

export function LegislativeRelationsClient({ initialPending, stats }: Props) {
  const [items, setItems] = useState(initialPending);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ id: string; msg: string; ok: boolean } | null>(null);

  // Filtros
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [groupBy, setGroupBy] = useState<GroupBy>('none');
  const [minConfidence, setMinConfidence] = useState(0);

  // Contadores por tipo (sempre baseados no estado atual, não no inicial)
  const countsByType = useMemo(() => {
    const m: Record<string, number> = {};
    for (const r of items) m[r.relationType] = (m[r.relationType] ?? 0) + 1;
    return m;
  }, [items]);

  // Lista filtrada
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((r) => {
      if (typeFilter && r.relationType !== typeFilter) return false;
      if (r.confidence < minConfidence) return false;
      if (q) {
        const hay = `${r.sourceAct.fullNumber} ${r.sourceAct.title} ${r.targetAct.fullNumber} ${r.targetAct.title} ${r.excerpt}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [items, typeFilter, search, minConfidence]);

  // Agrupamento
  const grouped = useMemo(() => {
    if (groupBy === 'none') return null;
    const map = new Map<string, { label: string; actId: string; rels: PendingRelation[] }>();
    for (const r of filtered) {
      const act = groupBy === 'source' ? r.sourceAct : r.targetAct;
      const key = act.id;
      const existing = map.get(key);
      if (existing) existing.rels.push(r);
      else map.set(key, { label: act.fullNumber, actId: act.id, rels: [r] });
    }
    // ordena grupos por número de rels desc, depois alfabético
    return [...map.values()].sort((a, b) => b.rels.length - a.rels.length || a.label.localeCompare(b.label));
  }, [filtered, groupBy]);

  async function handle(id: string, action: 'confirm' | 'reject' | 'delete') {
    setBusyId(id);
    setFeedback(null);
    try {
      const method = action === 'delete' ? 'DELETE' : 'PATCH';
      const body = action === 'delete' ? undefined : JSON.stringify({ action });
      const res = await fetch(`/api/admin/legislative-relations/${id}`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setFeedback({ id, msg: err.error ?? `HTTP ${res.status}`, ok: false });
        return;
      }
      setItems((prev) => prev.filter((x) => x.id !== id));
      setFeedback({ id, msg: action === 'delete' ? 'Removida' : action === 'confirm' ? 'Confirmada' : 'Rejeitada', ok: true });
    } catch (err) {
      setFeedback({ id, msg: err instanceof Error ? err.message : String(err), ok: false });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <main className="py-8">
      <div className="container mx-auto px-4 max-w-6xl">
        <header className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Relações entre atos — Fila de revisão</h1>
          <p className="text-gray-600">
            Detecções automáticas (heurística + IA) aguardando revisão manual. Confirme as corretas, rejeite os falsos positivos.
          </p>
          <div className="mt-4 flex gap-4 text-sm flex-wrap">
            <span className="px-3 py-1 rounded-full bg-yellow-50 text-yellow-700 border border-yellow-300">
              ⏳ Pendentes: <strong>{items.length}</strong>
            </span>
            <span className="px-3 py-1 rounded-full bg-green-50 text-green-700 border border-green-300">
              ✅ Confirmadas: <strong>{stats.confirmed}</strong>
            </span>
            <span className="px-3 py-1 rounded-full bg-red-50 text-red-700 border border-red-300">
              ❌ Rejeitadas: <strong>{stats.rejected}</strong>
            </span>
          </div>
        </header>

        {/* Filtros */}
        <section className="bg-white border-2 border-gray-200 rounded-xl p-4 mb-6 space-y-3">
          {/* Chips por tipo */}
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-xs text-gray-500 uppercase tracking-wide font-semibold">Tipo:</span>
            <button
              onClick={() => setTypeFilter(null)}
              className={`px-2.5 py-1 text-xs rounded-full border ${typeFilter === null ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}
            >
              Todos ({items.length})
            </button>
            {TYPE_ORDER.map((t) => {
              const n = countsByType[t] ?? 0;
              const isActive = typeFilter === t;
              const color = TYPE_COLORS[t] ?? 'bg-gray-100 text-gray-700 border-gray-300';
              return (
                <button
                  key={t}
                  onClick={() => setTypeFilter(isActive ? null : t)}
                  disabled={n === 0}
                  className={`px-2.5 py-1 text-xs rounded-full border ${isActive ? `${color} ring-2 ring-offset-1 ring-gray-400 font-semibold` : `${color} opacity-70 hover:opacity-100`} ${n === 0 ? 'opacity-30 cursor-not-allowed' : ''}`}
                >
                  {t} ({n})
                </button>
              );
            })}
          </div>

          {/* Busca + confidence + agrupamento */}
          <div className="flex flex-wrap gap-3 items-center">
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por ato (source/target) ou trecho do excerpt..."
              className="flex-1 min-w-[280px] px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
            />

            <label className="flex items-center gap-2 text-xs text-gray-600">
              <span>Confidence ≥</span>
              <select
                value={minConfidence}
                onChange={(e) => setMinConfidence(parseFloat(e.target.value))}
                className="border border-gray-300 rounded px-2 py-1 text-xs"
              >
                <option value={0}>0%</option>
                <option value={0.8}>80%</option>
                <option value={0.85}>85%</option>
                <option value={0.9}>90%</option>
              </select>
            </label>

            <label className="flex items-center gap-2 text-xs text-gray-600">
              <span>Agrupar:</span>
              <select
                value={groupBy}
                onChange={(e) => setGroupBy(e.target.value as GroupBy)}
                className="border border-gray-300 rounded px-2 py-1 text-xs"
              >
                <option value="none">Sem agrupamento</option>
                <option value="source">Por ato de origem</option>
                <option value="target">Por ato afetado</option>
              </select>
            </label>

            {(typeFilter || search || minConfidence > 0 || groupBy !== 'none') && (
              <button
                onClick={() => {
                  setTypeFilter(null);
                  setSearch('');
                  setMinConfidence(0);
                  setGroupBy('none');
                }}
                className="text-xs text-gray-500 hover:text-gray-800 underline"
              >
                Limpar filtros
              </button>
            )}
          </div>

          <p className="text-xs text-gray-500">
            Mostrando <strong>{filtered.length}</strong> de {items.length} pendente(s)
            {grouped && ` em ${grouped.length} grupo(s)`}.
          </p>
        </section>

        {items.length === 0 ? (
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-8 text-center">
            <p className="text-gray-500 italic">Nenhuma relação pendente. 🎉</p>
            <p className="text-xs text-gray-400 mt-2">
              Quando o detector achar novas relações (cron semanal ou batch import), elas aparecem aqui.
            </p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-8 text-center">
            <p className="text-gray-500 italic">Nenhuma relação casa com os filtros atuais.</p>
          </div>
        ) : grouped ? (
          <div className="space-y-4">
            {grouped.map((g) => (
              <details key={g.actId} open className="bg-white border-2 border-gray-200 rounded-xl">
                <summary className="px-4 py-3 cursor-pointer hover:bg-gray-50 flex items-center justify-between">
                  <span className="font-semibold text-gray-900">
                    {g.label}
                    <span className="ml-2 text-xs font-normal text-gray-500">
                      ({g.rels.length} {g.rels.length === 1 ? 'relação' : 'relações'})
                    </span>
                  </span>
                </summary>
                <ul className="border-t border-gray-200 divide-y divide-gray-100">
                  {g.rels.map((rel) => (
                    <RelationRow
                      key={rel.id}
                      rel={rel}
                      busyId={busyId}
                      feedback={feedback}
                      onAction={handle}
                      compact
                    />
                  ))}
                </ul>
              </details>
            ))}
          </div>
        ) : (
          <ul className="space-y-3">
            {filtered.map((rel) => (
              <li key={rel.id} className="bg-white border-2 border-gray-200 rounded-xl">
                <RelationRow rel={rel} busyId={busyId} feedback={feedback} onAction={handle} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}

function RelationRow({
  rel,
  busyId,
  feedback,
  onAction,
  compact,
}: {
  rel: PendingRelation;
  busyId: string | null;
  feedback: { id: string; msg: string; ok: boolean } | null;
  onAction: (id: string, action: 'confirm' | 'reject' | 'delete') => void;
  compact?: boolean;
}) {
  const typeColor = TYPE_COLORS[rel.relationType] ?? 'bg-gray-100 text-gray-700 border-gray-300';
  const isBusy = busyId === rel.id;
  const fb = feedback?.id === rel.id ? feedback : null;
  return (
    <div className={compact ? 'p-3' : 'p-4'}>
      <div className="flex items-start gap-3 flex-wrap mb-2">
        <span className={`inline-block px-2 py-0.5 text-xs font-semibold rounded border ${typeColor}`}>
          {rel.relationType}
        </span>
        <span className="text-xs text-gray-500">conf={Math.round(rel.confidence * 100)}%</span>
        <span className="text-xs text-gray-500">via {rel.source}</span>
        <span className="text-xs text-gray-400 ml-auto">{rel.detectedAt.slice(0, 10)}</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
        <div>
          <p className="text-xs text-gray-500 mb-1">Source (origem)</p>
          <Link href={`/legislacao/${rel.sourceAct.id}`} target="_blank" className="text-brand-700 hover:underline font-semibold text-sm">
            {rel.sourceAct.fullNumber}
          </Link>
          <p className="text-xs text-gray-600">{rel.sourceAct.title}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-1">Target (afetado)</p>
          <Link href={`/legislacao/${rel.targetAct.id}`} target="_blank" className="text-brand-700 hover:underline font-semibold text-sm">
            {rel.targetAct.fullNumber}
          </Link>
          <p className="text-xs text-gray-600">{rel.targetAct.title}</p>
        </div>
      </div>

      <p className="text-xs text-gray-500 italic mb-3">&ldquo;{rel.excerpt}&rdquo;</p>

      <div className="flex gap-2 items-center">
        <button
          onClick={() => onAction(rel.id, 'confirm')}
          disabled={isBusy}
          className="px-3 py-1.5 text-sm rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
        >
          ✅ Confirmar
        </button>
        <button
          onClick={() => onAction(rel.id, 'reject')}
          disabled={isBusy}
          className="px-3 py-1.5 text-sm rounded-lg bg-amber-600 text-white hover:bg-amber-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
        >
          ⚠️ Rejeitar (mantém histórico)
        </button>
        <button
          onClick={() => onAction(rel.id, 'delete')}
          disabled={isBusy}
          className="px-3 py-1.5 text-sm rounded-lg bg-red-100 text-red-700 hover:bg-red-200 border border-red-300 disabled:opacity-50 transition-colors"
        >
          🗑️ Deletar
        </button>
        {fb && (
          <span className={`text-xs ml-2 ${fb.ok ? 'text-green-600' : 'text-red-600'}`}>
            {fb.ok ? '✓' : '✗'} {fb.msg}
          </span>
        )}
      </div>
    </div>
  );
}
