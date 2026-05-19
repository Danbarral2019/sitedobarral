'use client';

import { useEffect, useState, useCallback } from 'react';
import { Link2, Plus, Trash2, Loader2, AlertCircle } from 'lucide-react';

interface CrossRef {
  id: string;
  articleNumber: string;
  targetNumber: string;
  note: string;
  order: number;
}

interface Props {
  numero: string;
}

export default function CrossRefsManager({ numero }: Props) {
  const [items, setItems] = useState<CrossRef[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [targetNumber, setTargetNumber] = useState('');
  const [note, setNote] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/admin/lei-14133/articles/${numero}/crossrefs`);
      if (res.ok) {
        const data = await res.json();
        setItems(data.crossRefs ?? []);
      }
    } finally {
      setIsLoading(false);
    }
  }, [numero]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!targetNumber.trim() || !note.trim()) {
      setError('Preencha o número de destino e a nota.');
      return;
    }
    setIsSaving(true);
    try {
      const res = await fetch(`/api/admin/lei-14133/articles/${numero}/crossrefs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetNumber: targetNumber.trim(), note: note.trim() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error?.message || data.message || 'Erro ao adicionar referência.');
        return;
      }
      setTargetNumber('');
      setNote('');
      await load();
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Remover esta referência cruzada?')) return;
    const res = await fetch(`/api/admin/lei-14133/articles/${numero}/crossrefs/${id}`, {
      method: 'DELETE',
    });
    if (res.ok) await load();
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center gap-2 mb-4">
        <Link2 className="w-5 h-5 text-blue-600" />
        <h2 className="text-xl font-bold text-gray-900">Referências cruzadas</h2>
        <span className="ml-auto text-sm text-gray-500">{items.length} cadastrada{items.length === 1 ? '' : 's'}</span>
      </div>
      <p className="text-sm text-gray-600 mb-4">
        Conecte este artigo a outros artigos da Lei 14.133 com uma nota explicativa.
      </p>

      <form onSubmit={handleAdd} className="flex flex-wrap gap-2 mb-4 items-start">
        <input
          type="text"
          value={targetNumber}
          onChange={(e) => setTargetNumber(e.target.value)}
          placeholder="Nº destino (ex: 17 ou 184-A)"
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm w-40 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Nota explicativa (ex: 'Complementa o regime de fiscalização')"
          maxLength={500}
          className="flex-1 min-w-[300px] px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <button
          type="submit"
          disabled={isSaving}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          Adicionar
        </button>
      </form>

      {error && (
        <div className="mb-4 flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-900">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
        </div>
      ) : items.length === 0 ? (
        <p className="text-sm text-gray-500 italic py-4 text-center">
          Nenhuma referência cruzada cadastrada.
        </p>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200"
            >
              <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded text-xs font-semibold whitespace-nowrap">
                Art. {item.targetNumber}
              </span>
              <p className="flex-1 text-sm text-gray-800">{item.note}</p>
              <button
                onClick={() => handleDelete(item.id)}
                className="text-gray-400 hover:text-red-600 transition-colors"
                aria-label="Remover referência"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
