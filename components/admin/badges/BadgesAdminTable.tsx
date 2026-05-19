'use client';

import { Loader2, Trash2, X, AlertTriangle, History } from 'lucide-react';
import { useState } from 'react';
import type { BadgeItem } from '@/hooks/use-badges-admin';

interface Props {
  items: BadgeItem[];
  isLoading: boolean;
  onRevoke: (id: string) => Promise<boolean>;
}

export function BadgesAdminTable({ items, isLoading, onRevoke }: Props) {
  const [revokeTarget, setRevokeTarget] = useState<BadgeItem | null>(null);
  const [isRevoking, setIsRevoking] = useState(false);

  async function handleConfirmRevoke() {
    if (!revokeTarget) return;
    setIsRevoking(true);
    try {
      const ok = await onRevoke(revokeTarget.id);
      if (ok) setRevokeTarget(null);
    } finally {
      setIsRevoking(false);
    }
  }

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-12 flex justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-md p-12 text-center">
        <History className="w-10 h-10 text-gray-400 mx-auto mb-3" />
        <p className="text-gray-600">Nenhum badge concedido com os filtros atuais.</p>
      </div>
    );
  }

  return (
    <>
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Badge</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Usuário</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Curso</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Concedido em</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((b) => (
                <tr key={b.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{b.icon}</span>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{b.label}</p>
                        <p className="text-xs text-gray-500 font-mono">{b.type}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    <p className="font-medium">{b.userName ?? '—'}</p>
                    <p className="text-xs text-gray-500">{b.userEmail ?? b.userId}</p>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    {b.courseId ?? <span className="text-gray-400 italic">geral</span>}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {new Date(b.awardedAt).toLocaleDateString('pt-BR', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => setRevokeTarget(b)}
                      className="text-gray-400 hover:text-red-600 transition-colors"
                      aria-label="Revogar badge"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {revokeTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-500" />
                Revogar badge
              </h3>
              <button
                onClick={() => setRevokeTarget(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="mb-6 p-4 bg-red-50 rounded-lg border border-red-200">
              <p className="text-sm text-gray-900">
                Revogar <strong>{revokeTarget.icon} {revokeTarget.label}</strong> de <strong>{revokeTarget.userName ?? revokeTarget.userEmail ?? revokeTarget.userId}</strong>?
              </p>
              <p className="text-sm text-red-600 mt-2">
                O usuário deixará de ver este badge no perfil. A ação é permanente.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setRevokeTarget(null)}
                className="flex-1 px-4 py-2 border-2 border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmRevoke}
                disabled={isRevoking}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isRevoking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                Revogar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
