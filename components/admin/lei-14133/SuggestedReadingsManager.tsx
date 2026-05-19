'use client';

import { useEffect, useState, useCallback } from 'react';
import { BookOpen, Plus, Trash2, Loader2, AlertCircle, ExternalLink } from 'lucide-react';

type Kind = 'internal' | 'external';
type InternalType = 'blog' | 'glossary' | 'legislative-act' | 'document';
type ExternalType = 'video' | 'article' | 'book' | 'other';

interface SuggestedReading {
  id: string;
  articleNumber: string;
  kind: Kind;
  internalType: InternalType | null;
  internalId: string | null;
  externalUrl: string | null;
  externalType: ExternalType | null;
  title: string | null;
  description: string | null;
  author: string | null;
  order: number;
}

interface Props {
  numero: string;
}

const INTERNAL_TYPE_LABELS: Record<InternalType, string> = {
  blog: 'Post de blog',
  glossary: 'Glossário',
  'legislative-act': 'Ato legislativo',
  document: 'Documento',
};

const EXTERNAL_TYPE_LABELS: Record<ExternalType, string> = {
  video: 'Vídeo',
  article: 'Artigo externo',
  book: 'Livro',
  other: 'Outro',
};

export default function SuggestedReadingsManager({ numero }: Props) {
  const [items, setItems] = useState<SuggestedReading[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [kind, setKind] = useState<Kind>('external');
  const [externalUrl, setExternalUrl] = useState('');
  const [externalType, setExternalType] = useState<ExternalType>('article');
  const [internalType, setInternalType] = useState<InternalType>('blog');
  const [internalId, setInternalId] = useState('');
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [description, setDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/admin/lei-14133/articles/${numero}/readings`);
      if (res.ok) {
        const data = await res.json();
        setItems(data.readings ?? []);
      }
    } finally {
      setIsLoading(false);
    }
  }, [numero]);

  useEffect(() => {
    load();
  }, [load]);

  function resetForm() {
    setExternalUrl('');
    setInternalId('');
    setTitle('');
    setAuthor('');
    setDescription('');
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const payload: Record<string, unknown> = { kind };
    if (kind === 'external') {
      if (!externalUrl.trim() || !title.trim()) {
        setError('URL e título são obrigatórios para leituras externas.');
        return;
      }
      payload.externalUrl = externalUrl.trim();
      payload.externalType = externalType;
      payload.title = title.trim();
      if (author.trim()) payload.author = author.trim();
      if (description.trim()) payload.description = description.trim();
    } else {
      if (!internalId.trim()) {
        setError('Slug/ID interno é obrigatório para leituras internas.');
        return;
      }
      payload.internalType = internalType;
      payload.internalId = internalId.trim();
      if (title.trim()) payload.title = title.trim();
      if (description.trim()) payload.description = description.trim();
    }

    setIsSaving(true);
    try {
      const res = await fetch(`/api/admin/lei-14133/articles/${numero}/readings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error?.message || data.message || 'Erro ao adicionar leitura.');
        return;
      }
      resetForm();
      await load();
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Remover esta leitura sugerida?')) return;
    const res = await fetch(`/api/admin/lei-14133/articles/${numero}/readings/${id}`, {
      method: 'DELETE',
    });
    if (res.ok) await load();
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center gap-2 mb-4">
        <BookOpen className="w-5 h-5 text-purple-600" />
        <h2 className="text-xl font-bold text-gray-900">Leituras sugeridas</h2>
        <span className="ml-auto text-sm text-gray-500">{items.length} cadastrada{items.length === 1 ? '' : 's'}</span>
      </div>
      <p className="text-sm text-gray-600 mb-4">
        Recomende posts de blog, glossário, atos legislativos, documentos ou recursos externos para este artigo.
      </p>

      <form onSubmit={handleAdd} className="space-y-3 mb-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setKind('external')}
            className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              kind === 'external' ? 'bg-purple-600 text-white' : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
            }`}
          >
            Externa (URL)
          </button>
          <button
            type="button"
            onClick={() => setKind('internal')}
            className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              kind === 'internal' ? 'bg-purple-600 text-white' : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
            }`}
          >
            Interna (site)
          </button>
        </div>

        {kind === 'external' ? (
          <>
            <div className="flex gap-2">
              <select
                value={externalType}
                onChange={(e) => setExternalType(e.target.value as ExternalType)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm w-44 bg-white"
              >
                {Object.entries(EXTERNAL_TYPE_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
              <input
                type="url"
                value={externalUrl}
                onChange={(e) => setExternalUrl(e.target.value)}
                placeholder="https://..."
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Título *"
              maxLength={300}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
            <input
              type="text"
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              placeholder="Autor (opcional)"
              maxLength={200}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </>
        ) : (
          <>
            <div className="flex gap-2">
              <select
                value={internalType}
                onChange={(e) => setInternalType(e.target.value as InternalType)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm w-44 bg-white"
              >
                {Object.entries(INTERNAL_TYPE_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
              <input
                type="text"
                value={internalId}
                onChange={(e) => setInternalId(e.target.value)}
                placeholder="Slug ou ID interno"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Título de exibição (opcional, herda do recurso se vazio)"
              maxLength={300}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </>
        )}

        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Descrição (opcional)"
          maxLength={1500}
          rows={2}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
        />

        <button
          type="submit"
          disabled={isSaving}
          className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50"
        >
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          Adicionar leitura
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
          Nenhuma leitura sugerida cadastrada.
        </p>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => {
            const typeBadge =
              item.kind === 'external'
                ? item.externalType ? EXTERNAL_TYPE_LABELS[item.externalType] : 'externa'
                : item.internalType ? INTERNAL_TYPE_LABELS[item.internalType] : 'interna';
            return (
              <li
                key={item.id}
                className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200"
              >
                <span className="px-2 py-0.5 bg-purple-100 text-purple-800 rounded text-xs font-semibold whitespace-nowrap">
                  {typeBadge}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 break-words">
                    {item.title || item.internalId || item.externalUrl}
                  </p>
                  {item.author && (
                    <p className="text-xs text-gray-600 mt-0.5">por {item.author}</p>
                  )}
                  {item.description && (
                    <p className="text-xs text-gray-600 mt-1 line-clamp-2">{item.description}</p>
                  )}
                  {item.kind === 'external' && item.externalUrl && (
                    <a
                      href={item.externalUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline mt-1"
                    >
                      <ExternalLink className="w-3 h-3" />
                      Abrir
                    </a>
                  )}
                </div>
                <button
                  onClick={() => handleDelete(item.id)}
                  className="text-gray-400 hover:text-red-600 transition-colors"
                  aria-label="Remover leitura"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
