'use client';

import { useState } from 'react';
import { Save, Loader2, Plus, X, Link as LinkIcon, FileText, Eye } from 'lucide-react';
import { WizardStepProps, ImportanceLevel, AlternativeUrl } from './types';

const IMPORTANCE_LEVELS: { value: ImportanceLevel; label: string; description: string; color: string }[] = [
  {
    value: 'baixa',
    label: 'Baixa',
    description: 'Documento complementar, leitura opcional',
    color: 'bg-gray-100 border-gray-300 text-gray-700',
  },
  {
    value: 'media',
    label: 'Média',
    description: 'Relevante para casos específicos',
    color: 'bg-blue-100 border-blue-300 text-blue-700',
  },
  {
    value: 'alta',
    label: 'Alta',
    description: 'Muito relevante, leitura recomendada',
    color: 'bg-orange-100 border-orange-300 text-orange-700',
  },
  {
    value: 'critica',
    label: 'Crítica',
    description: 'Documento fundamental, leitura obrigatória',
    color: 'bg-red-100 border-red-300 text-red-700',
  },
];

interface Step4Props extends WizardStepProps {
  onSave: () => Promise<void>;
  isSaving: boolean;
  documentId?: string; // Se estiver editando documento existente
}

export default function Step4Finalization({
  formState,
  updateForm,
  onPrevious,
  onSave,
  isSaving,
  documentId,
}: Step4Props) {
  const [newAltUrl, setNewAltUrl] = useState('');
  const [newAltLabel, setNewAltLabel] = useState('');
  const [newAltType, setNewAltType] = useState<'pdf' | 'link'>('pdf');
  const [showPreview, setShowPreview] = useState(false);

  const handleAddAlternativeUrl = () => {
    if (!newAltUrl.trim()) {
      alert('Por favor, informe a URL.');
      return;
    }

    if (!newAltLabel.trim()) {
      alert('Por favor, informe o rótulo da URL.');
      return;
    }

    const newAlt: AlternativeUrl = {
      url: newAltUrl.trim(),
      label: newAltLabel.trim(),
      type: newAltType,
    };

    updateForm({
      alternativeUrls: [...formState.alternativeUrls, newAlt],
    });

    setNewAltUrl('');
    setNewAltLabel('');
    setNewAltType('pdf');
  };

  const handleRemoveAlternativeUrl = (index: number) => {
    updateForm({
      alternativeUrls: formState.alternativeUrls.filter((_, i) => i !== index),
    });
  };

  const handleSave = async () => {
    // Validação final
    if (!formState.importance) {
      const confirm = window.confirm(
        'Nenhum nível de importância foi selecionado. Deseja continuar?'
      );

      if (!confirm) return;
    }

    await onSave();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b pb-4">
        <h2 className="text-2xl font-bold text-gray-900">Finalização</h2>
        <p className="text-sm text-gray-600 mt-1">
          Últimos ajustes antes de salvar o documento
        </p>
      </div>

      {/* Nível de Importância */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">
          Nível de Importância
        </label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {IMPORTANCE_LEVELS.map((level) => (
            <button
              key={level.value}
              type="button"
              onClick={() => updateForm({ importance: level.value })}
              className={`p-4 rounded-lg border-2 text-left transition-all ${
                formState.importance === level.value
                  ? `${level.color} border-opacity-100 shadow-md`
                  : 'bg-white border-gray-300 hover:border-gray-400'
              }`}
            >
              <div className="font-semibold">{level.label}</div>
              <div className="text-xs mt-1 opacity-80">{level.description}</div>
            </button>
          ))}
        </div>
        <p className="text-xs text-gray-500 mt-2">
          A importância ajuda os alunos a priorizarem a leitura dos documentos.
        </p>
      </div>

      {/* Observações Privadas (Admin) */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Observações Privadas (Admin)
        </label>
        <textarea
          value={formState.adminNotes}
          onChange={(e) => updateForm({ adminNotes: e.target.value })}
          rows={4}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none bg-gray-50"
          placeholder="Observações internas do administrador (não visíveis para alunos)&#10;Ex: 'Verificar se há versão atualizada em 2025', 'Considerar migrar para categoria X'"
        />
        <p className="text-xs text-gray-500 mt-1">
          🔒 Estas observações são privadas e <strong>não serão exibidas</strong> para os alunos.
        </p>
      </div>

      {/* Links/Arquivos de Referência */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">
          Links/Arquivos de Referência (Opcionais)
        </label>

        {/* Lista de URLs Alternativas */}
        {formState.alternativeUrls.length > 0 && (
          <div className="mb-4 space-y-2">
            {formState.alternativeUrls.map((alt, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded-lg"
              >
                <div className="flex items-center gap-3 flex-1">
                  {alt.type === 'pdf' ? (
                    <FileText className="w-5 h-5 text-red-600" />
                  ) : (
                    <LinkIcon className="w-5 h-5 text-blue-600" />
                  )}
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-900">{alt.label}</div>
                    <div className="text-xs text-gray-600 truncate">{alt.url}</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveAlternativeUrl(index)}
                  className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Adicionar Nova URL */}
        <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Rótulo</label>
              <input
                type="text"
                value={newAltLabel}
                onChange={(e) => setNewAltLabel(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Ex: Versão em inglês"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Tipo</label>
              <select
                value={newAltType}
                onChange={(e) => setNewAltType(e.target.value as 'pdf' | 'link')}
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="pdf">PDF</option>
                <option value="link">Link</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">URL</label>
            <input
              type="url"
              value={newAltUrl}
              onChange={(e) => setNewAltUrl(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="https://exemplo.com/documento.pdf"
            />
          </div>
          <button
            type="button"
            onClick={handleAddAlternativeUrl}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Adicionar Link de Referência
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          Versões alternativas do documento (ex: inglês, resumida, vídeo explicativo).
        </p>
      </div>

      {/* Preview Button */}
      <div className="border-t pt-6">
        <button
          type="button"
          onClick={() => setShowPreview(!showPreview)}
          className="w-full px-6 py-3 bg-gray-100 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-200 transition-colors font-medium flex items-center justify-center gap-2"
        >
          <Eye className="w-5 h-5" />
          {showPreview ? 'Ocultar Preview' : 'Visualizar Preview do Documento'}
        </button>
      </div>

      {/* Preview Modal (Inline) */}
      {showPreview && (
        <div className="bg-white p-6 rounded-lg border-2 border-blue-200 shadow-lg">
          <h3 className="text-lg font-bold text-gray-900 mb-4">
            👁️ Preview: Como alunos verão este documento
          </h3>

          {/* Document Card Preview */}
          <div className="bg-gray-50 p-5 rounded-lg border border-gray-300 space-y-4">
            {/* Title */}
            <h4 className="text-xl font-bold text-gray-900">{formState.title}</h4>

            {/* Category + Importance */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-3 py-1 bg-indigo-100 text-indigo-700 text-xs font-medium rounded-full">
                {formState.category}
              </span>
              {formState.importance && (
                <span
                  className={`px-3 py-1 text-xs font-medium rounded-full ${
                    IMPORTANCE_LEVELS.find((l) => l.value === formState.importance)?.color || ''
                  }`}
                >
                  Importância: {IMPORTANCE_LEVELS.find((l) => l.value === formState.importance)?.label}
                </span>
              )}
            </div>

            {/* Description */}
            {formState.description && (
              <p className="text-sm text-gray-700">{formState.description}</p>
            )}

            {/* Summary */}
            {formState.summary && (
              <div className="bg-blue-50 p-4 rounded border border-blue-200">
                <h5 className="text-xs font-semibold text-blue-900 mb-2">RESUMO</h5>
                <p className="text-sm text-gray-700 leading-relaxed">{formState.summary}</p>
              </div>
            )}

            {/* Lei Articles */}
            {formState.leiArticles.length > 0 && (
              <div>
                <h5 className="text-xs font-semibold text-gray-900 mb-2">ARTIGOS DA LEI 14.133</h5>
                <div className="flex flex-wrap gap-2">
                  {formState.leiArticles.map((art) => (
                    <span
                      key={art}
                      className="px-3 py-1 bg-purple-100 text-purple-700 text-xs font-medium rounded-full"
                    >
                      Art. {art}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Alternative URLs */}
            {formState.alternativeUrls.length > 0 && (
              <div>
                <h5 className="text-xs font-semibold text-gray-900 mb-2">LINKS DE REFERÊNCIA</h5>
                <div className="space-y-2">
                  {formState.alternativeUrls.map((alt, idx) => (
                    <a
                      key={idx}
                      href={alt.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800"
                    >
                      {alt.type === 'pdf' ? <FileText className="w-4 h-4" /> : <LinkIcon className="w-4 h-4" />}
                      {alt.label}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Botões de Navegação */}
      <div className="flex justify-between items-center pt-6 border-t">
        <button
          type="button"
          onClick={onPrevious}
          disabled={isSaving}
          className="px-6 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          ← Voltar
        </button>

        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          className="px-8 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {isSaving ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Salvando...
            </>
          ) : (
            <>
              <Save className="w-5 h-5" />
              {documentId ? 'Salvar Alterações' : 'Criar Documento'}
            </>
          )}
        </button>
      </div>

      {/* Warning sobre dados obrigatórios */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
        <p className="text-sm text-amber-800">
          ℹ️ <strong>Lembre-se:</strong> Documentos sem artigos da Lei 14.133 vinculados não aparecerão na
          navegação por estrutura da lei. Você pode voltar ao Step 2 para adicionar artigos se necessário.
        </p>
      </div>
    </div>
  );
}
