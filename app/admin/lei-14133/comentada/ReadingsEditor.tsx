'use client';

import { useState } from 'react';
import { Plus, Trash2, ExternalLink, FileText, BookOpen, Scale, Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { SearchBaseModal } from './SearchBaseModal';

interface Reading {
  id: string;
  kind: 'internal' | 'external';
  internalType?: string | null;
  internalId?: string | null;
  externalUrl?: string | null;
  externalType?: string | null;
  title?: string | null;
  description?: string | null;
  author?: string | null;
  order: number;
}

interface Props {
  numero: string;
  initial: Reading[];
  onChanged: () => void;
}

const INTERNAL_LABELS: Record<string, string> = {
  blog: 'Post do blog',
  glossary: 'Glossário',
  'legislative-act': 'Ato normativo',
  document: 'Documento',
};

const EXTERNAL_LABELS: Record<string, string> = {
  video: 'Vídeo',
  article: 'Artigo doutrinário',
  book: 'Livro',
  other: 'Outro',
};

export function ReadingsEditor({ numero, initial, onChanged }: Props) {
  const { error: errorToast, success: successToast } = useToast();
  const [items, setItems] = useState<Reading[]>(initial);

  const [adding, setAdding] = useState(false);
  const [step, setStep] = useState<'choose' | 'internal-pick-type' | 'internal-search' | 'external-form'>('choose');
  const [internalType, setInternalType] = useState<'blog' | 'glossary' | 'legislative-act' | 'document'>('blog');
  const [externalForm, setExternalForm] = useState({
    url: '',
    type: 'video' as 'video' | 'article' | 'book' | 'other',
    title: '',
    author: '',
    description: '',
  });
  const [showSearch, setShowSearch] = useState(false);

  const resetAdd = () => {
    setAdding(false);
    setStep('choose');
    setInternalType('blog');
    setExternalForm({ url: '', type: 'video', title: '', author: '', description: '' });
    setShowSearch(false);
  };

  const createReading = async (payload: Partial<Reading>) => {
    const r = await fetch(`/api/admin/lei-14133/articles/${numero}/readings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!r.ok) {
      const e = await r.json().catch(() => ({}));
      errorToast('Erro', e.error || 'Falha');
      return;
    }
    const data = await r.json();
    setItems((prev) => [...prev, data.reading]);
    resetAdd();
    successToast('Sugestão adicionada');
    onChanged();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Remover esta sugestão?')) return;
    const r = await fetch(`/api/admin/lei-14133/articles/${numero}/readings/${id}`, { method: 'DELETE' });
    if (!r.ok) {
      errorToast('Erro');
      return;
    }
    setItems((prev) => prev.filter((i) => i.id !== id));
    onChanged();
  };

  const handleInternalPicked = async (result: { id: string; title: string }) => {
    await createReading({
      kind: 'internal',
      internalType,
      internalId: result.id,
      title: result.title,
    });
  };

  const handleExternalSave = async () => {
    if (!externalForm.url || !externalForm.title) {
      errorToast('URL e título são obrigatórios');
      return;
    }
    await createReading({
      kind: 'external',
      externalUrl: externalForm.url,
      externalType: externalForm.type,
      title: externalForm.title,
      author: externalForm.author || undefined,
      description: externalForm.description || undefined,
    });
  };

  return (
    <div className="space-y-3">
      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item.id} className="border border-gray-200 rounded-lg p-3 bg-white flex items-start gap-3">
            <ItemIcon item={item} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="px-2 py-0.5 bg-gray-100 text-gray-700 text-[11px] font-medium rounded">
                  {item.kind === 'internal'
                    ? INTERNAL_LABELS[item.internalType || ''] || 'Interno'
                    : EXTERNAL_LABELS[item.externalType || ''] || 'Externo'}
                </span>
              </div>
              <p className="text-sm font-medium text-gray-900 truncate">{item.title || (item.kind === 'external' ? item.externalUrl : 'Sem título')}</p>
              {item.author && <p className="text-xs text-gray-600">por {item.author}</p>}
              {item.description && <p className="text-xs text-gray-600 mt-1 line-clamp-2">{item.description}</p>}
            </div>
            <button onClick={() => handleDelete(item.id)} className="text-red-500 hover:text-red-700">
              <Trash2 className="w-4 h-4" />
            </button>
          </li>
        ))}
      </ul>

      {adding ? (
        <div className="border border-dashed border-emerald-300 rounded-lg p-3 bg-emerald-50/30 space-y-3">
          {step === 'choose' && (
            <div>
              <p className="text-sm font-medium mb-2">Tipo de referência:</p>
              <div className="flex gap-2">
                <button
                  onClick={() => setStep('internal-pick-type')}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
                >
                  📚 Conteúdo do site
                </button>
                <button
                  onClick={() => setStep('external-form')}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700"
                >
                  🔗 Link externo
                </button>
                <button onClick={resetAdd} className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {step === 'internal-pick-type' && (
            <div>
              <p className="text-sm font-medium mb-2">Tipo de conteúdo:</p>
              <div className="flex gap-2 flex-wrap">
                {(Object.keys(INTERNAL_LABELS) as Array<keyof typeof INTERNAL_LABELS>).map((t) => (
                  <button
                    key={t}
                    onClick={() => {
                      setInternalType(t as typeof internalType);
                      setShowSearch(true);
                      setStep('internal-search');
                    }}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm hover:bg-blue-50"
                  >
                    {INTERNAL_LABELS[t]}
                  </button>
                ))}
                <button onClick={resetAdd} className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {step === 'external-form' && (
            <div className="space-y-2">
              <input
                type="url"
                placeholder="https://… (URL do conteúdo externo)"
                value={externalForm.url}
                onChange={(e) => setExternalForm({ ...externalForm, url: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="Título"
                  value={externalForm.title}
                  onChange={(e) => setExternalForm({ ...externalForm, title: e.target.value })}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
                <select
                  value={externalForm.type}
                  onChange={(e) => setExternalForm({ ...externalForm, type: e.target.value as typeof externalForm.type })}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                >
                  {Object.entries(EXTERNAL_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
              <input
                type="text"
                placeholder="Autor (opcional)"
                value={externalForm.author}
                onChange={(e) => setExternalForm({ ...externalForm, author: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
              <textarea
                placeholder="Nota curta (opcional)"
                rows={2}
                value={externalForm.description}
                onChange={(e) => setExternalForm({ ...externalForm, description: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleExternalSave}
                  className="flex items-center gap-1 px-3 py-2 bg-emerald-600 text-white rounded-lg text-sm hover:bg-emerald-700"
                >
                  <Save className="w-4 h-4" /> Adicionar
                </button>
                <button onClick={resetAdd} className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <button onClick={() => setAdding(true)} className="flex items-center gap-1 text-sm text-emerald-700 hover:text-emerald-900">
          <Plus className="w-4 h-4" /> Adicionar sugestão
        </button>
      )}

      {items.length === 0 && !adding && (
        <p className="text-sm text-gray-500 italic">Nenhuma sugestão ainda.</p>
      )}

      {showSearch && (
        <SearchBaseModal
          kind={{ source: 'internal', type: internalType }}
          onSelect={handleInternalPicked}
          onClose={() => {
            setShowSearch(false);
            resetAdd();
          }}
        />
      )}
    </div>
  );
}

function ItemIcon({ item }: { item: Reading }) {
  if (item.kind === 'internal') {
    if (item.internalType === 'blog') return <FileText className="w-5 h-5 text-blue-600 flex-shrink-0" />;
    if (item.internalType === 'glossary') return <BookOpen className="w-5 h-5 text-amber-600 flex-shrink-0" />;
    if (item.internalType === 'legislative-act') return <Scale className="w-5 h-5 text-violet-600 flex-shrink-0" />;
    return <FileText className="w-5 h-5 text-gray-500 flex-shrink-0" />;
  }
  return <ExternalLink className="w-5 h-5 text-purple-600 flex-shrink-0" />;
}
