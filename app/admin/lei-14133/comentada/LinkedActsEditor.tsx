'use client';

import { useState } from 'react';
import { Plus, Trash2, Scale } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { SearchBaseModal } from './SearchBaseModal';

interface LinkedAct {
  id: string;
  fullNumber: string;
  title: string;
  ementa: string;
  type: string;
  hierarchyLevel: number;
  esfera: string;
  importance: string | null;
}

interface Props {
  numero: string;
  linked: LinkedAct[];
  onChanged: () => void;
}

const IMPORTANCE_LABELS: Record<string, string> = {
  '': 'Sem marcação',
  baixa: 'Baixa',
  media: 'Média',
  alta: '⭐ Alta',
  critica: '🔴 Crítica',
};

export function LinkedActsEditor({ numero, linked, onChanged }: Props) {
  const { error: errorToast, success: successToast } = useToast();
  const [showSearch, setShowSearch] = useState(false);

  const handleLink = async (result: { id: string }) => {
    const r = await fetch(`/api/admin/lei-14133/articles/${numero}/link-act`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actId: result.id }),
    });
    if (!r.ok) {
      const e = await r.json().catch(() => ({}));
      errorToast('Erro', e.error || 'Falha');
      return;
    }
    setShowSearch(false);
    successToast('Ato vinculado');
    onChanged();
  };

  const handleUnlink = async (id: string) => {
    if (!confirm('Desvincular este ato do artigo?')) return;
    const r = await fetch(`/api/admin/lei-14133/articles/${numero}/link-act/${id}`, { method: 'DELETE' });
    if (!r.ok) {
      errorToast('Erro');
      return;
    }
    onChanged();
  };

  const handleImportanceChange = async (actId: string, importance: string) => {
    const r = await fetch(`/api/admin/legislative-acts/${actId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ importance: importance || null }),
    });
    if (!r.ok) {
      errorToast('Erro ao atualizar destaque');
      return;
    }
    successToast('Destaque atualizado');
    onChanged();
  };

  return (
    <div className="space-y-3">
      <ul className="space-y-2">
        {linked.map((act) => (
          <li key={act.id} className="border border-gray-200 rounded-lg p-3 bg-white">
            <div className="flex items-start gap-3">
              <Scale className="w-5 h-5 text-violet-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900">
                  <span className="font-bold">{act.fullNumber}</span> — {act.title}
                </p>
                <p className="text-xs text-gray-600 line-clamp-2 mt-1">{act.ementa}</p>
                <div className="flex items-center gap-2 mt-2">
                  <label className="text-xs text-gray-600">Destaque:</label>
                  <select
                    value={act.importance || ''}
                    onChange={(e) => handleImportanceChange(act.id, e.target.value)}
                    className="text-xs px-2 py-1 border border-gray-300 rounded bg-white"
                  >
                    {Object.entries(IMPORTANCE_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>
              </div>
              <button onClick={() => handleUnlink(act.id)} className="text-red-500 hover:text-red-700">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </li>
        ))}
      </ul>

      <button onClick={() => setShowSearch(true)} className="flex items-center gap-1 text-sm text-violet-700 hover:text-violet-900">
        <Plus className="w-4 h-4" /> Vincular ato normativo
      </button>

      {linked.length === 0 && (
        <p className="text-sm text-gray-500 italic">Nenhum ato vinculado.</p>
      )}

      {showSearch && (
        <SearchBaseModal kind={{ source: 'admin-act' }} onSelect={handleLink} onClose={() => setShowSearch(false)} />
      )}
    </div>
  );
}
