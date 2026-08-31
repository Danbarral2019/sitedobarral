'use client';

import { Save, Loader2 } from 'lucide-react';
import { simpleMarkdownToHtml } from '@/lib/admin/lesson-markdown';

interface LessonContentTabProps {
  content: string;
  onChange: (value: string) => void;
  onSave: () => void;
  isSaving: boolean;
}

export function LessonContentTab({ content, onChange, onSave, isSaving }: LessonContentTabProps) {
  return (
    <div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Editor (Markdown)</h3>
          <textarea
            value={content}
            onChange={(e) => onChange(e.target.value)}
            rows={24}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-600 text-gray-900 font-mono text-sm resize-y"
            placeholder="# Titulo da Licao&#10;&#10;Escreva o conteudo aqui em Markdown...&#10;&#10;## Subtitulo&#10;&#10;- Item 1&#10;- Item 2&#10;&#10;**Texto em negrito** e *italico*"
          />
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Preview</h3>
          <div
            className="max-w-none text-gray-800 min-h-[400px] p-3 bg-gray-50 rounded-lg border border-gray-100"
            dangerouslySetInnerHTML={{ __html: simpleMarkdownToHtml(content) }}
          />
        </div>
      </div>

      <div className="mt-4 flex justify-end">
        <button
          onClick={onSave}
          disabled={isSaving}
          className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Salvar Conteudo
        </button>
      </div>
    </div>
  );
}
