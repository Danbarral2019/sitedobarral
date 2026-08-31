'use client';

import { useState } from 'react';
import { X, Save, Eye, Edit3, ArrowRight } from 'lucide-react';
import MarkdownContent from '@/components/MarkdownContent';

interface Props {
  initial: string;
  onSave: (markdown: string) => Promise<void>;
  onCancel: () => void;
  /** Salva e abre o próximo pendente da fila. Ausente quando não há próximo. */
  onSaveAndNext?: (markdown: string) => Promise<void>;
  proximoNumero?: string | null;
}

export function CommentEditor({ initial, onSave, onCancel, onSaveAndNext, proximoNumero }: Props) {
  const [markdown, setMarkdown] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<'edit' | 'preview' | 'split'>('split');

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(markdown);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAndNext = async () => {
    if (!onSaveAndNext) return;
    setSaving(true);
    try {
      await onSaveAndNext(markdown);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-6xl h-[85vh] flex flex-col">
        <header className="px-6 py-4 border-b flex items-center justify-between flex-shrink-0">
          <h3 className="font-bold text-lg text-gray-900">Comentário do Prof. (Markdown)</h3>
          <div className="flex items-center gap-2">
            <div className="flex bg-gray-100 rounded-lg p-1 text-sm">
              <button
                onClick={() => setTab('edit')}
                className={`px-3 py-1 rounded ${tab === 'edit' ? 'bg-white shadow' : 'text-gray-600'}`}
              >
                <Edit3 className="w-4 h-4 inline mr-1" /> Editar
              </button>
              <button
                onClick={() => setTab('split')}
                className={`px-3 py-1 rounded ${tab === 'split' ? 'bg-white shadow' : 'text-gray-600'}`}
              >
                Lado-a-lado
              </button>
              <button
                onClick={() => setTab('preview')}
                className={`px-3 py-1 rounded ${tab === 'preview' ? 'bg-white shadow' : 'text-gray-600'}`}
              >
                <Eye className="w-4 h-4 inline mr-1" /> Preview
              </button>
            </div>
            <button onClick={onCancel} className="p-2 hover:bg-gray-100 rounded">
              <X className="w-5 h-5" />
            </button>
          </div>
        </header>

        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 overflow-hidden">
          {(tab === 'edit' || tab === 'split') && (
            <textarea
              value={markdown}
              onChange={(e) => setMarkdown(e.target.value)}
              placeholder="# Sobre este artigo&#10;&#10;Use markdown — headings, listas, **negrito**, _itálico_, links..."
              className={`p-6 font-mono text-sm focus:outline-none resize-none ${
                tab === 'edit' ? 'col-span-2' : ''
              } border-r border-gray-200`}
              autoFocus
            />
          )}
          {(tab === 'preview' || tab === 'split') && (
            <div className={`overflow-y-auto p-6 prose prose-sm max-w-none ${tab === 'preview' ? 'col-span-2' : ''}`}>
              {markdown.trim() ? (
                <MarkdownContent content={markdown} />
              ) : (
                <p className="text-gray-400 italic">Preview aparecerá aqui</p>
              )}
            </div>
          )}
        </div>

        <footer className="px-6 py-4 border-t flex items-center justify-between flex-shrink-0">
          <p className="text-xs text-gray-500">{markdown.length} / 50.000 caracteres</p>
          <div className="flex gap-2">
            <button
              onClick={onCancel}
              disabled={saving}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={saving || markdown.length > 50_000}
              className="flex items-center gap-1 px-4 py-2 border border-brand-600 text-brand-700 rounded-lg hover:bg-brand-50 disabled:opacity-50 text-sm"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Salvando…' : 'Salvar'}
            </button>
            {onSaveAndNext && (
              <button
                onClick={handleSaveAndNext}
                disabled={saving || markdown.length > 50_000}
                title={proximoNumero ? `Próximo: art. ${proximoNumero}` : undefined}
                className="flex items-center gap-1 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-800 disabled:opacity-50 text-sm"
              >
                {saving ? 'Salvando…' : 'Salvar e próximo'}
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </footer>
      </div>
    </div>
  );
}
