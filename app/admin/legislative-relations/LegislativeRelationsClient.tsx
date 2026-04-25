'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { PendingRelation } from './page';

const TYPE_COLORS: Record<string, string> = {
  revoga: 'bg-red-100 text-red-700 border-red-300',
  altera: 'bg-amber-100 text-amber-700 border-amber-300',
  regulamenta: 'bg-blue-100 text-blue-700 border-blue-300',
  complementa: 'bg-green-100 text-green-700 border-green-300',
  modifica: 'bg-purple-100 text-purple-700 border-purple-300',
};

interface Props {
  initialPending: PendingRelation[];
  stats: { confirmed: number; rejected: number };
}

export function LegislativeRelationsClient({ initialPending, stats }: Props) {
  const [items, setItems] = useState(initialPending);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ id: string; msg: string; ok: boolean } | null>(null);

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
      // Sucesso: remove da lista (foi confirmed/rejected/deleted)
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
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Relações entre atos — Fila de revisão</h1>
          <p className="text-gray-600">
            Detecções automáticas (heurística + IA) aguardando revisão manual. Confirme as corretas, rejeite os falsos positivos.
          </p>
          <div className="mt-4 flex gap-4 text-sm">
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

        {items.length === 0 ? (
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-8 text-center">
            <p className="text-gray-500 italic">Nenhuma relação pendente. 🎉</p>
            <p className="text-xs text-gray-400 mt-2">
              Quando o detector achar novas relações (cron semanal ou batch import), elas aparecem aqui.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {items.map((rel) => {
              const typeColor = TYPE_COLORS[rel.relationType] ?? 'bg-gray-100 text-gray-700 border-gray-300';
              const isBusy = busyId === rel.id;
              const fb = feedback?.id === rel.id ? feedback : null;
              return (
                <li key={rel.id} className="bg-white border-2 border-gray-200 rounded-xl p-4">
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
                      onClick={() => handle(rel.id, 'confirm')}
                      disabled={isBusy}
                      className="px-3 py-1.5 text-sm rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                    >
                      ✅ Confirmar
                    </button>
                    <button
                      onClick={() => handle(rel.id, 'reject')}
                      disabled={isBusy}
                      className="px-3 py-1.5 text-sm rounded-lg bg-amber-600 text-white hover:bg-amber-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                    >
                      ⚠️ Rejeitar (mantém histórico)
                    </button>
                    <button
                      onClick={() => handle(rel.id, 'delete')}
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
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </main>
  );
}
