'use client';

import { useState } from 'react';
import { HelpCircle, X, AlertTriangle, Loader2, Trash2 } from 'lucide-react';
import { useFaqAdmin } from '@/hooks/use-faq-admin';
import { FAQAdminForm } from '@/components/admin/faq/FAQAdminForm';
import { FAQAdminTable } from '@/components/admin/faq/FAQAdminTable';

export default function FAQAdminPage() {
  const a = useFaqAdmin();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const targetFaq = a.deleteTargetId ? a.faqs.find((f) => f.id === a.deleteTargetId) : null;

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <HelpCircle className="w-8 h-8 text-blue-600" />
            FAQ — Perguntas Frequentes
          </h1>
          <p className="text-gray-600 mt-1">
            Gerencie as perguntas e respostas exibidas em <a href="/faq" className="text-blue-600 hover:underline" target="_blank" rel="noopener">/faq</a>
          </p>
        </div>
      </div>

      <FAQAdminForm
        editing={!!a.editingId}
        form={a.form}
        onChange={a.setForm}
        onSubmit={a.handleSave}
        onCancel={a.openCreate}
        isSaving={a.isSaving}
      />

      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900">
          FAQs cadastradas ({a.faqs.length})
        </h2>
      </div>

      <FAQAdminTable
        faqs={a.faqs}
        isLoading={a.isLoading}
        editingId={a.editingId}
        onEdit={a.openEdit}
        onTogglePublish={a.togglePublish}
        onDelete={(id) => {
          a.setDeleteTargetId(id);
          setShowDeleteConfirm(true);
        }}
      />

      {showDeleteConfirm && targetFaq && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-500" />
                Excluir FAQ
              </h3>
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  a.setDeleteTargetId(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="mb-6 p-4 bg-red-50 rounded-lg border border-red-200">
              <p className="text-sm text-gray-900">
                Excluir <strong>{targetFaq.question.substring(0, 80)}</strong>?
              </p>
              <p className="text-sm text-red-600 mt-2">
                Esta ação não pode ser desfeita. Histórico de feedbacks também será removido.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  a.setDeleteTargetId(null);
                }}
                className="flex-1 px-4 py-2 border-2 border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={async () => {
                  await a.handleDelete();
                  setShowDeleteConfirm(false);
                }}
                disabled={a.isDeleting}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {a.isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
