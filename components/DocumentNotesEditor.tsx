'use client';

import { useState, useEffect } from 'react';
import { X, Save, Loader2, Trash2, AlertCircle } from 'lucide-react';

interface DocumentNotesEditorProps {
  documentId: string;
  documentTitle: string;
  onClose: () => void;
  onSaved?: () => void;
}

interface NotesData {
  adminNotes?: string;
  publicNotes?: string;
  notesImportance?: 'baixa' | 'media' | 'alta' | 'critica';
  notesRelatedDocs?: string[];
  notesPracticalUse?: string;
  notesKeyPoints?: string;
}

export default function DocumentNotesEditor({
  documentId,
  documentTitle,
  onClose,
  onSaved,
}: DocumentNotesEditorProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState<NotesData>({
    adminNotes: '',
    publicNotes: '',
    notesImportance: undefined,
    notesRelatedDocs: [],
    notesPracticalUse: '',
    notesKeyPoints: '',
  });

  // Carrega dados existentes
  useEffect(() => {
    loadNotes();
  }, [documentId]);

  const loadNotes = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/admin/documents/${documentId}/notes`);

      if (!response.ok) {
        throw new Error('Erro ao carregar observações');
      }

      const data = await response.json();
      const doc = data.document;

      setFormData({
        adminNotes: doc.adminNotes || '',
        publicNotes: doc.publicNotes || '',
        notesImportance: doc.notesImportance || undefined,
        notesRelatedDocs: doc.notesRelatedDocs ? JSON.parse(doc.notesRelatedDocs) : [],
        notesPracticalUse: doc.notesPracticalUse || '',
        notesKeyPoints: doc.notesKeyPoints || '',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      setError(null);

      const response = await fetch(`/api/admin/documents/${documentId}/notes`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          adminEmail: 'admin@system.com', // TODO: pegar do contexto de autenticação
        }),
      });

      if (!response.ok) {
        throw new Error('Erro ao salvar observações');
      }

      if (onSaved) onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Deseja realmente remover todas as observações?')) return;

    try {
      setIsSaving(true);
      setError(null);

      const response = await fetch(`/api/admin/documents/${documentId}/notes`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Erro ao remover observações');
      }

      if (onSaved) onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao remover');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl p-8">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto" />
          <p className="text-gray-600 mt-4">Carregando observações...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Observações do Documento</h2>
            <p className="text-sm text-gray-600 mt-1">{documentTitle}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-6 h-6 text-gray-600" />
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="mx-6 mt-6 p-4 bg-red-50 border-l-4 border-red-500 rounded-r-lg">
            <div className="flex gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
              <p className="text-sm text-red-800">{error}</p>
            </div>
          </div>
        )}

        {/* Form */}
        <div className="p-6 space-y-6">
          {/* Importância */}
          <div>
            <label className="block text-sm font-bold text-gray-900 mb-2">
              Importância
            </label>
            <div className="flex gap-3">
              {[
                { value: 'baixa', label: 'Baixa', color: 'bg-gray-100 text-gray-800' },
                { value: 'media', label: 'Média', color: 'bg-blue-100 text-blue-800' },
                { value: 'alta', label: 'Alta', color: 'bg-orange-100 text-orange-800' },
                { value: 'critica', label: 'Crítica', color: 'bg-red-100 text-red-800' },
              ].map(({ value, label, color }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setFormData({ ...formData, notesImportance: value as any })}
                  className={`px-4 py-2 rounded-lg font-medium transition-all ${
                    formData.notesImportance === value
                      ? `${color} ring-2 ring-offset-2 ${value === 'baixa' ? 'ring-gray-400' : value === 'media' ? 'ring-blue-400' : value === 'alta' ? 'ring-orange-400' : 'ring-red-400'}`
                      : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Observações Privadas (Admin) */}
          <div>
            <label className="block text-sm font-bold text-gray-900 mb-2">
              🔒 Observações Privadas (só admin)
            </label>
            <textarea
              value={formData.adminNotes}
              onChange={(e) => setFormData({ ...formData, adminNotes: e.target.value })}
              rows={4}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-600 text-gray-900"
              placeholder="Observações que só você verá..."
            />
          </div>

          {/* Observações Públicas */}
          <div>
            <label className="block text-sm font-bold text-gray-900 mb-2">
              🌍 Observações Públicas (alunos verão)
            </label>
            <textarea
              value={formData.publicNotes}
              onChange={(e) => setFormData({ ...formData, publicNotes: e.target.value })}
              rows={4}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-600 text-gray-900"
              placeholder="Observações visíveis para os alunos..."
            />
          </div>

          {/* Pontos-Chave */}
          <div>
            <label className="block text-sm font-bold text-gray-900 mb-2">
              🎯 Pontos-Chave
            </label>
            <textarea
              value={formData.notesKeyPoints}
              onChange={(e) => setFormData({ ...formData, notesKeyPoints: e.target.value })}
              rows={3}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-600 text-gray-900"
              placeholder="Principais pontos de atenção (um por linha)"
            />
          </div>

          {/* Aplicação Prática */}
          <div>
            <label className="block text-sm font-bold text-gray-900 mb-2">
              💼 Aplicação Prática
            </label>
            <textarea
              value={formData.notesPracticalUse}
              onChange={(e) => setFormData({ ...formData, notesPracticalUse: e.target.value })}
              rows={3}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-600 text-gray-900"
              placeholder="Como aplicar este acórdão na prática..."
            />
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 p-6 flex items-center justify-between">
          <button
            onClick={handleDelete}
            disabled={isSaving}
            className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors flex items-center gap-2 font-medium disabled:opacity-50"
          >
            <Trash2 className="w-4 h-4" />
            Remover Todas
          </button>

          <div className="flex gap-3">
            <button
              onClick={onClose}
              disabled={isSaving}
              className="px-6 py-3 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors font-medium disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 font-medium disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  Salvar
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
