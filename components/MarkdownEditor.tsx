'use client';

import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Eye, Code, Info } from 'lucide-react';

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export default function MarkdownEditor({ value, onChange, placeholder }: MarkdownEditorProps) {
  const [activeTab, setActiveTab] = useState<'edit' | 'preview'>('edit');

  return (
    <div className="border-2 border-border-subtle rounded-[6px] overflow-hidden bg-white">
      {/* Tabs */}
      <div className="flex items-center justify-between border-b-2 border-border-subtle bg-surface-raised px-4">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('edit')}
            className={`flex items-center gap-2 px-4 py-3 font-medium transition-colors border-b-2 ${
              activeTab === 'edit'
                ? 'border-brand-600 text-brand-600'
                : 'border-transparent text-ink-muted hover:text-ink-primary'
            }`}
          >
            <Code className="w-4 h-4" />
            Editar
          </button>
          <button
            onClick={() => setActiveTab('preview')}
            className={`flex items-center gap-2 px-4 py-3 font-medium transition-colors border-b-2 ${
              activeTab === 'preview'
                ? 'border-brand-600 text-brand-600'
                : 'border-transparent text-ink-muted hover:text-ink-primary'
            }`}
          >
            <Eye className="w-4 h-4" />
            Visualizar
          </button>
        </div>

        {/* Dica de Markdown */}
        <div className="text-xs text-ink-muted flex items-center gap-1">
          <Info className="w-3 h-3" />
          Suporta Markdown
        </div>
      </div>

      {/* Content */}
      <div className="min-h-[400px]">
        {activeTab === 'edit' ? (
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder || 'Escreva o conteúdo do post em Markdown...'}
            className="w-full min-h-[400px] p-6 text-ink-primary font-mono text-sm leading-relaxed resize-none focus:outline-none"
          />
        ) : (
          <div className="p-6 max-w-none">
            {value ? (
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {value}
              </ReactMarkdown>
            ) : (
              <p className="text-ink-muted italic">
                Nenhum conteúdo para visualizar. Escreva algo na aba &quot;Editar&quot;.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Guia Rápido de Markdown (quando está em modo edição) */}
      {activeTab === 'edit' && (
        <div className="border-t-2 border-border-subtle bg-surface-raised p-4">
          <details className="text-sm">
            <summary className="cursor-pointer font-semibold text-ink-secondary hover:text-ink-primary mb-2">
              Guia Rápido de Markdown
            </summary>
            <div className="grid md:grid-cols-3 gap-4 mt-3 text-xs text-ink-muted">
              <div>
                <p className="font-bold text-ink-primary mb-1">Formatação Básica:</p>
                <code className="block bg-white p-2 rounded border">
                  **negrito**<br />
                  *itálico*<br />
                  ~~riscado~~
                </code>
              </div>
              <div>
                <p className="font-bold text-ink-primary mb-1">Títulos:</p>
                <code className="block bg-white p-2 rounded border">
                  # Título 1<br />
                  ## Título 2<br />
                  ### Título 3
                </code>
              </div>
              <div>
                <p className="font-bold text-ink-primary mb-1">Listas e Links:</p>
                <code className="block bg-white p-2 rounded border">
                  - Item lista<br />
                  1. Item numerado<br />
                  [texto](url)
                </code>
              </div>
            </div>
          </details>
        </div>
      )}
    </div>
  );
}
