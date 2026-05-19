'use client';

import { Save, Loader2, Eye, EyeOff } from 'lucide-react';
import type { SettingsFormState } from '@/hooks/use-lesson-editor';

interface LessonSettingsTabProps {
  form: SettingsFormState;
  onFieldChange: <K extends keyof SettingsFormState>(key: K, value: SettingsFormState[K]) => void;
  onSubmit: (e: React.FormEvent) => void;
  isSaving: boolean;
}

export function LessonSettingsTab({ form, onFieldChange, onSubmit, isSaving }: LessonSettingsTabProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <form onSubmit={onSubmit} className="space-y-5 max-w-2xl">
        <div>
          <label className="block text-sm font-semibold text-gray-900 mb-2">Titulo</label>
          <input
            type="text"
            value={form.title}
            onChange={(e) => onFieldChange('title', e.target.value)}
            required
            className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-600 text-gray-900"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-900 mb-2">Slug</label>
          <input
            type="text"
            value={form.slug}
            onChange={(e) => onFieldChange('slug', e.target.value)}
            required
            className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-600 text-gray-900 font-mono text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-900 mb-2">Descricao</label>
          <textarea
            value={form.description}
            onChange={(e) => onFieldChange('description', e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-600 text-gray-900"
            placeholder="Descricao da licao..."
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-900 mb-2">Tempo estimado (minutos)</label>
          <input
            type="number"
            value={form.estimatedMinutes}
            onChange={(e) => onFieldChange('estimatedMinutes', e.target.value)}
            min="0"
            className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-600 text-gray-900"
            placeholder="Ex: 30"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-900 mb-2">
            Artigos da Lei 14.133 (separados por virgula)
          </label>
          <input
            type="text"
            value={form.leiArticles}
            onChange={(e) => onFieldChange('leiArticles', e.target.value)}
            className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-600 text-gray-900"
            placeholder="Ex: 6, 75, 92, 147"
          />
        </div>

        <div className="flex items-center gap-3">
          <label className="text-sm font-semibold text-gray-900">Publicado</label>
          <button
            type="button"
            onClick={() => onFieldChange('isPublished', !form.isPublished)}
            className={`relative w-11 h-6 rounded-full transition-colors ${
              form.isPublished ? 'bg-blue-600' : 'bg-gray-300'
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                form.isPublished ? 'translate-x-5' : ''
              }`}
            />
          </button>
          <span className="text-sm text-gray-600">
            {form.isPublished ? (
              <span className="flex items-center gap-1">
                <Eye className="w-4 h-4 text-green-600" /> Visivel para alunos
              </span>
            ) : (
              <span className="flex items-center gap-1">
                <EyeOff className="w-4 h-4 text-gray-400" /> Oculto
              </span>
            )}
          </span>
        </div>

        <div className="pt-4">
          <button
            type="submit"
            disabled={isSaving}
            className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Salvar Configuracoes
          </button>
        </div>
      </form>
    </div>
  );
}
