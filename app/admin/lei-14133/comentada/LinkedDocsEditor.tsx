'use client';

import { useState } from 'react';
import { Plus, Trash2, FileText } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { SearchBaseModal } from './SearchBaseModal';

interface LinkedDoc {
  id: string;
  title: string;
  category: string | null;
  isPublic: boolean;
  notesImportance: string | null;
}

interface Props {
  numero: string;
  linked: LinkedDoc[];
  onChanged: () => void;
}

export function LinkedDocsEditor({ numero, linked, onChanged }: Props) {
  const { error: errorToast, success: successToast } = useToast();
  const [showSearch, setShowSearch] = useState(false);

  const handleLink = async (result: { id: string; title: string }) => {
    const r = await fetch(`/api/admin/lei-14133/articles/${numero}/link-document`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ documentId: result.id }),
    });
    if (!r.ok) {
      const e = await r.json().catch(() => ({}));
      errorToast('Erro', e.error || 'Falha');
      return;
    }
    setShowSearch(false);
    successToast('Documento vinculado');
    onChanged();
  };

  const handleUnlink = async (id: string) => {
    if (!confirm('Desvincular este documento do artigo?')) return;
    const r = await fetch(`/api/admin/lei-14133/articles/${numero}/link-document/${id}`, { method: 'DELETE' });
    if (!r.ok) {
      errorToast('Erro');
      return;
    }
    onChanged();
  };

  return (
    <div className="space-y-3">
      <ul className="space-y-2">
        {linked.map((doc) => (
          <li key={doc.id} className="border border-gray-200 rounded-lg p-3 bg-white flex items-center gap-3">
            <FileText className="w-5 h-5 text-blue-600 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{doc.title}</p>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                {doc.category && (
                  <span className="px-2 py-0.5 bg-gray-100 text-gray-700 text-[10px] font-medium rounded">{doc.category}</span>
                )}
                {doc.isPublic && (
                  <span className="px-2 py-0.5 bg-green-100 text-green-700 text-[10px] font-medium rounded">Público</span>
                )}
                {doc.notesImportance && (
                  <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-medium rounded">{doc.notesImportance}</span>
                )}
              </div>
            </div>
            <button onClick={() => handleUnlink(doc.id)} className="text-red-500 hover:text-red-700">
              <Trash2 className="w-4 h-4" />
            </button>
          </li>
        ))}
      </ul>

      <button onClick={() => setShowSearch(true)} className="flex items-center gap-1 text-sm text-blue-700 hover:text-blue-900">
        <Plus className="w-4 h-4" /> Vincular documento da base
      </button>

      {linked.length === 0 && (
        <p className="text-sm text-gray-500 italic">Nenhum documento vinculado.</p>
      )}

      {showSearch && (
        <SearchBaseModal kind={{ source: 'admin-document' }} onSelect={handleLink} onClose={() => setShowSearch(false)} />
      )}
    </div>
  );
}
