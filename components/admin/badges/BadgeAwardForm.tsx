'use client';

import { useState } from 'react';
import { Loader2, Award, AlertCircle } from 'lucide-react';
import type { BadgeCatalogEntry } from '@/hooks/use-badges-admin';

interface Props {
  catalog: BadgeCatalogEntry[];
  isSaving: boolean;
  error: string | null;
  onSubmit: (input: { userEmail: string; type: string; courseId?: string }) => Promise<boolean>;
}

export function BadgeAwardForm({ catalog, isSaving, error, onSubmit }: Props) {
  const [userEmail, setUserEmail] = useState('');
  const [type, setType] = useState('');
  const [courseId, setCourseId] = useState('');

  const manualTypes = catalog.filter((c) => c.award === 'manual');
  const allTypes = catalog;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!userEmail.trim() || !type) return;
    const ok = await onSubmit({
      userEmail: userEmail.trim(),
      type,
      courseId: courseId.trim() || undefined,
    });
    if (ok) {
      setUserEmail('');
      setType('');
      setCourseId('');
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center gap-2 mb-4">
        <Award className="w-5 h-5 text-amber-600" />
        <h2 className="text-xl font-bold text-gray-900">Premiar badge manualmente</h2>
      </div>
      <p className="text-sm text-gray-600 mb-4">
        Conceda badges manuais a usuários por contribuição, mentoria ou eventos especiais. Badges automáticos também aparecem aqui caso você precise forçar a premiação.
      </p>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">E-mail do usuário *</label>
          <input
            type="email"
            value={userEmail}
            onChange={(e) => setUserEmail(e.target.value)}
            placeholder="aluno@exemplo.com"
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de badge *</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
          >
            <option value="">Selecione um badge</option>
            <optgroup label="Badges manuais (recomendados)">
              {manualTypes.map((c) => (
                <option key={c.type} value={c.type}>
                  {c.icon} {c.label}
                </option>
              ))}
            </optgroup>
            <optgroup label="Badges automáticos (forçar)">
              {allTypes.filter((c) => c.award === 'auto').map((c) => (
                <option key={c.type} value={c.type}>
                  {c.icon} {c.label}
                </option>
              ))}
            </optgroup>
          </select>
          {type && (
            <p className="text-xs text-gray-500 mt-1">
              {catalog.find((c) => c.type === type)?.description}
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Course ID (opcional)</label>
          <input
            type="text"
            value={courseId}
            onChange={(e) => setCourseId(e.target.value)}
            placeholder="Vazio = badge geral (não vinculado a curso)"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
          />
          <p className="text-xs text-gray-500 mt-1">
            Use o ID numérico do curso (ex: <code>1</code>, <code>2</code>). Deixe vazio para badge geral.
          </p>
        </div>

        {error && (
          <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-900">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={isSaving || !userEmail.trim() || !type}
          className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 disabled:opacity-50"
        >
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Award className="w-4 h-4" />}
          Premiar badge
        </button>
      </form>
    </div>
  );
}
