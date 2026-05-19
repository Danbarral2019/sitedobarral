'use client';

import { X, Loader2, Save } from 'lucide-react';
import { slugify } from '@/lib/admin/lms/slug';
import type { LessonFormData, LessonData, ModuleData } from '@/hooks/use-module-manager';

interface LessonFormModalProps {
  open: boolean;
  editing: LessonData | null;
  form: LessonFormData;
  onChange: (form: LessonFormData) => void;
  modules: ModuleData[];
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  isSaving: boolean;
}

export function LessonFormModal({
  open,
  editing,
  form,
  onChange,
  modules,
  onClose,
  onSubmit,
  isSaving,
}: LessonFormModalProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
        <div className="flex justify-between items-start mb-6">
          <h3 className="text-xl font-bold text-gray-900">{editing ? 'Editar Licao' : 'Nova Licao'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">Titulo</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => {
                const title = e.target.value;
                onChange({
                  ...form,
                  title,
                  slug: editing ? form.slug : slugify(title),
                });
              }}
              required
              className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-600 text-gray-900"
              placeholder="Ex: Introducao a Lei 14.133"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">Slug</label>
            <input
              type="text"
              value={form.slug}
              onChange={(e) => onChange({ ...form, slug: e.target.value })}
              required
              className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-600 text-gray-900 font-mono text-sm"
              placeholder="introducao-lei-14133"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">Descricao (opcional)</label>
            <textarea
              value={form.description}
              onChange={(e) => onChange({ ...form, description: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-600 text-gray-900"
              placeholder="Breve descricao da licao..."
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">Pre-requisito (opcional)</label>
            <select
              value={form.prerequisiteId}
              onChange={(e) => onChange({ ...form, prerequisiteId: e.target.value })}
              className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-600 text-gray-900 text-sm"
            >
              <option value="">Nenhum</option>
              {modules.flatMap((mod) =>
                mod.lessons
                  .filter((l) => l.id !== editing?.id)
                  .map((l) => (
                    <option key={l.id} value={l.id}>
                      {mod.title} &rarr; {l.title}
                    </option>
                  )),
              )}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Aluno precisara completar esta aula antes de acessar a nova
            </p>
          </div>
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border-2 border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Salvar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
