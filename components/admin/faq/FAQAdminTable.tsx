'use client';

import { Pencil, Trash2, Eye, EyeOff, Pin, Loader2 } from 'lucide-react';
import type { FAQAdminItem } from '@/lib/faq/queries';

interface FAQAdminTableProps {
  faqs: FAQAdminItem[];
  isLoading: boolean;
  editingId: string | null;
  onEdit: (faq: FAQAdminItem) => void;
  onTogglePublish: (faq: FAQAdminItem) => void;
  onDelete: (id: string) => void;
}

export function FAQAdminTable({
  faqs,
  isLoading,
  editingId,
  onEdit,
  onTogglePublish,
  onDelete,
}: FAQAdminTableProps) {
  if (isLoading) {
    return (
      <div className="bg-white rounded-xl border-2 border-gray-200 p-12 text-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto" />
        <p className="text-sm text-gray-600 mt-3">Carregando FAQs...</p>
      </div>
    );
  }

  if (faqs.length === 0) {
    return (
      <div className="bg-white rounded-xl border-2 border-gray-200 p-12 text-center">
        <p className="text-gray-600">Nenhuma FAQ cadastrada ainda. Use o formulário acima.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border-2 border-gray-200 overflow-hidden">
      <table className="w-full">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="text-left py-3 px-4 text-sm font-bold text-gray-700">Pergunta</th>
            <th className="text-left py-3 px-4 text-sm font-bold text-gray-700">Categoria</th>
            <th className="text-center py-3 px-4 text-sm font-bold text-gray-700">Ordem</th>
            <th className="text-center py-3 px-4 text-sm font-bold text-gray-700">Stats</th>
            <th className="text-right py-3 px-4 text-sm font-bold text-gray-700">Ações</th>
          </tr>
        </thead>
        <tbody>
          {faqs.map((faq) => {
            const isEditing = editingId === faq.id;
            return (
              <tr
                key={faq.id}
                className={`border-b border-gray-100 ${isEditing ? 'bg-blue-50' : 'hover:bg-gray-50'} transition-colors`}
              >
                <td className="py-3 px-4">
                  <div className="flex items-start gap-2">
                    {faq.isPinned && <Pin className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />}
                    <span className="text-sm text-gray-900 line-clamp-2">{faq.question}</span>
                  </div>
                </td>
                <td className="py-3 px-4 text-sm text-gray-700">{faq.category}</td>
                <td className="py-3 px-4 text-center text-sm text-gray-600">{faq.displayOrder}</td>
                <td className="py-3 px-4 text-center text-xs text-gray-500">
                  {faq.viewCount}👁 · {faq.helpfulCount}👍 · {faq.notHelpfulCount}👎
                </td>
                <td className="py-3 px-4 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      onClick={() => onTogglePublish(faq)}
                      className="p-1.5 hover:bg-gray-100 rounded transition-colors"
                      title={faq.isPublished ? 'Despublicar' : 'Publicar'}
                    >
                      {faq.isPublished ? (
                        <Eye className="w-4 h-4 text-green-600" />
                      ) : (
                        <EyeOff className="w-4 h-4 text-gray-400" />
                      )}
                    </button>
                    <button
                      onClick={() => onEdit(faq)}
                      className="p-1.5 hover:bg-gray-100 rounded transition-colors"
                      title="Editar"
                    >
                      <Pencil className="w-4 h-4 text-blue-600" />
                    </button>
                    <button
                      onClick={() => onDelete(faq.id)}
                      className="p-1.5 hover:bg-red-50 rounded transition-colors"
                      title="Excluir"
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
