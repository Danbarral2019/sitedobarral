'use client';

import { Save, X, Loader2 } from 'lucide-react';
import type { FAQFormData } from '@/hooks/use-faq-admin';

interface FAQAdminFormProps {
  editing: boolean;
  form: FAQFormData;
  onChange: (form: FAQFormData) => void;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
  isSaving: boolean;
}

export function FAQAdminForm({ editing, form, onChange, onSubmit, onCancel, isSaving }: FAQAdminFormProps) {
  return (
    <form onSubmit={onSubmit} className="bg-white rounded-xl border-2 border-gray-200 p-6 space-y-4">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-xl font-bold text-gray-900">{editing ? 'Editar FAQ' : 'Nova FAQ'}</h2>
        {editing && (
          <button
            type="button"
            onClick={onCancel}
            className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
          >
            <X className="w-4 h-4" />
            Cancelar edição
          </button>
        )}
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-900 mb-2">Pergunta *</label>
        <input
          type="text"
          value={form.question}
          onChange={(e) => onChange({ ...form, question: e.target.value })}
          required
          maxLength={500}
          className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          placeholder="Como acesso o curso?"
        />
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-900 mb-2">
          Resposta * <span className="text-xs text-gray-500 font-normal">(suporta markdown)</span>
        </label>
        <textarea
          value={form.answer}
          onChange={(e) => onChange({ ...form, answer: e.target.value })}
          required
          rows={8}
          className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono text-sm"
          placeholder="Após o pagamento, você receberá um email com..."
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-semibold text-gray-900 mb-2">Categoria *</label>
          <input
            type="text"
            value={form.category}
            onChange={(e) => onChange({ ...form, category: e.target.value })}
            required
            list="faq-categories"
            className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            placeholder="Acesso ao Site"
          />
          <datalist id="faq-categories">
            <option value="Acesso ao Site" />
            <option value="Documentos" />
            <option value="Certificados" />
            <option value="Cursos" />
            <option value="Pagamento" />
            <option value="Lei 14.133" />
          </datalist>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-900 mb-2">Ordem</label>
          <input
            type="number"
            min={0}
            value={form.displayOrder}
            onChange={(e) => onChange({ ...form, displayOrder: parseInt(e.target.value) || 0 })}
            className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-900 mb-2">
            Keywords <span className="text-xs text-gray-500 font-normal">(opcional)</span>
          </label>
          <input
            type="text"
            value={form.keywords}
            onChange={(e) => onChange({ ...form, keywords: e.target.value })}
            maxLength={500}
            className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            placeholder="login, senha, acesso"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-6 pt-2">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={form.isPinned}
            onChange={(e) => onChange({ ...form, isPinned: e.target.checked })}
            className="w-4 h-4 text-blue-600 rounded"
          />
          <span className="text-sm font-medium text-gray-900">Destacar (topo da categoria)</span>
        </label>

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={form.isPublished}
            onChange={(e) => onChange({ ...form, isPublished: e.target.checked })}
            className="w-4 h-4 text-blue-600 rounded"
          />
          <span className="text-sm font-medium text-gray-900">Publicado (visível ao público)</span>
        </label>
      </div>

      <div className="pt-4 border-t border-gray-200 flex justify-end gap-3">
        {editing && (
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 border-2 border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50"
          >
            Cancelar
          </button>
        )}
        <button
          type="submit"
          disabled={isSaving}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {editing ? 'Salvar Alterações' : 'Criar FAQ'}
        </button>
      </div>
    </form>
  );
}
