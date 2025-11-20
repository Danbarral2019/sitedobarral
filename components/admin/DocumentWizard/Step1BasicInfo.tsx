'use client';

import { courses } from '@/data/courses';
import { Upload, Link as LinkIcon, FileText, Video } from 'lucide-react';
import { WizardStepProps, DocumentCategory, DocumentType } from './types';

const CATEGORIES: { value: DocumentCategory; label: string }[] = [
  { value: 'apostila', label: 'Apostila' },
  { value: 'acordao', label: 'Acórdão' },
  { value: 'parecer', label: 'Parecer' },
  { value: 'edital', label: 'Edital' },
  { value: 'artigo', label: 'Artigo' },
  { value: 'orientacao-normativa', label: 'Orientação Normativa' },
  { value: 'enunciados', label: 'Enunciados' },
  { value: 'outro', label: 'Outro' },
];

const DOCUMENT_TYPES: { value: DocumentType; label: string; icon: React.ReactNode }[] = [
  { value: 'pdf', label: 'PDF', icon: <FileText className="w-4 h-4" /> },
  { value: 'doc', label: 'DOC/DOCX', icon: <FileText className="w-4 h-4" /> },
  { value: 'link', label: 'Link Externo', icon: <LinkIcon className="w-4 h-4" /> },
  { value: 'video', label: 'Vídeo', icon: <Video className="w-4 h-4" /> },
];

export default function Step1BasicInfo({
  formState,
  updateForm,
  onNext,
  isFirstStep,
}: WizardStepProps) {
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;

    if (file) {
      updateForm({
        selectedFile: file,
        type: file.type.includes('pdf') ? 'pdf' : 'doc',
      });
    }
  };

  const handleNext = () => {
    // Validação básica
    if (!formState.title.trim()) {
      alert('Por favor, informe o título do documento.');
      return;
    }

    if (!formState.category) {
      alert('Por favor, selecione a categoria.');
      return;
    }

    if (!formState.isCommon && !formState.courseId) {
      alert('Por favor, selecione um curso ou marque "Comum a todos os cursos".');
      return;
    }

    // Validar URL/arquivo
    if (formState.type === 'link' || formState.type === 'video') {
      if (!formState.url.trim()) {
        alert('Por favor, informe a URL do documento.');
        return;
      }
    } else {
      if (!formState.url && !formState.selectedFile) {
        alert('Por favor, faça upload de um arquivo ou informe a URL.');
        return;
      }
    }

    // Validar campos de enunciados
    if (formState.category === 'enunciados') {
      if (!formState.entityType?.trim()) {
        alert('Por favor, informe o tipo de entidade (ex: CNJ, CNMP).');
        return;
      }
      if (!formState.enunciadoNumber?.trim()) {
        alert('Por favor, informe o número do enunciado.');
        return;
      }
    }

    onNext();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b pb-4">
        <h2 className="text-2xl font-bold text-gray-900">Informações Básicas</h2>
        <p className="text-sm text-gray-600 mt-1">
          Preencha os dados essenciais do documento (30 segundos)
        </p>
      </div>

      {/* Título */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Título do Documento <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={formState.title}
          onChange={(e) => updateForm({ title: e.target.value })}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="Ex: Acórdão 1234/2024 - TCU sobre planejamento"
          required
        />
      </div>

      {/* Descrição Curta */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Descrição Curta
        </label>
        <textarea
          value={formState.description}
          onChange={(e) => updateForm({ description: e.target.value })}
          rows={3}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
          placeholder="Breve descrição do documento (opcional, 2-3 linhas)"
        />
        <p className="text-xs text-gray-500 mt-1">
          Esta descrição aparecerá nos cards de listagem. A IA irá gerar um resumo completo no próximo passo.
        </p>
      </div>

      {/* Categoria e Curso (lado a lado) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Categoria */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Categoria <span className="text-red-500">*</span>
          </label>
          <select
            value={formState.category}
            onChange={(e) => updateForm({ category: e.target.value as DocumentCategory })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
          >
            <option value="">Selecione...</option>
            {CATEGORIES.map((cat) => (
              <option key={cat.value} value={cat.value}>
                {cat.label}
              </option>
            ))}
          </select>
        </div>

        {/* Curso */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Curso <span className="text-red-500">*</span>
          </label>
          <select
            value={formState.courseId}
            onChange={(e) => updateForm({ courseId: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
            disabled={formState.isCommon}
            required={!formState.isCommon}
          >
            <option value="">Selecione um curso...</option>
            {courses.map((course) => (
              <option key={course.id} value={course.id}>
                {course.title}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Checkboxes de Visibilidade */}
      <div className="space-y-3 bg-gray-50 p-4 rounded-lg border border-gray-200">
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="isPublic"
            checked={formState.isPublic}
            onChange={(e) => updateForm({ isPublic: e.target.checked })}
            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
          />
          <label htmlFor="isPublic" className="text-sm font-medium text-gray-700 cursor-pointer">
            Documento Público (visível sem login)
          </label>
        </div>

        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="isCommon"
            checked={formState.isCommon}
            onChange={(e) => {
              const isCommon = e.target.checked;
              updateForm({
                isCommon,
                courseId: isCommon ? '' : formState.courseId,
              });
            }}
            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
          />
          <label htmlFor="isCommon" className="text-sm font-medium text-gray-700 cursor-pointer">
            Comum a todos os cursos
          </label>
        </div>
      </div>

      {/* Tipo de Documento */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">
          Tipo de Documento <span className="text-red-500">*</span>
        </label>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {DOCUMENT_TYPES.map((docType) => (
            <button
              key={docType.value}
              type="button"
              onClick={() => updateForm({ type: docType.value })}
              className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 transition-all ${
                formState.type === docType.value
                  ? 'border-blue-500 bg-blue-50 text-blue-700 font-medium'
                  : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
              }`}
            >
              {docType.icon}
              <span className="text-sm">{docType.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Upload/URL baseado no tipo */}
      {formState.type === 'link' || formState.type === 'video' ? (
        /* URL Manual */
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            URL do Documento <span className="text-red-500">*</span>
          </label>
          <input
            type="url"
            value={formState.url}
            onChange={(e) => updateForm({ url: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder={
              formState.type === 'video'
                ? 'https://www.youtube.com/watch?v=...'
                : 'https://exemplo.com/documento.pdf'
            }
            required
          />
        </div>
      ) : (
        /* Upload de Arquivo */
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Arquivo <span className="text-red-500">*</span>
          </label>
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-400 transition-colors">
            <Upload className="w-12 h-12 mx-auto text-gray-400 mb-3" />
            <label className="cursor-pointer">
              <span className="text-blue-600 hover:text-blue-700 font-medium">
                Clique para fazer upload
              </span>
              <span className="text-gray-600"> ou arraste o arquivo aqui</span>
              <input
                type="file"
                onChange={handleFileChange}
                className="hidden"
                accept={formState.type === 'pdf' ? '.pdf' : '.doc,.docx'}
              />
            </label>
            {formState.selectedFile && (
              <div className="mt-3 text-sm text-gray-700">
                ✅ <strong>{formState.selectedFile.name}</strong> ({(formState.selectedFile.size / 1024 / 1024).toFixed(2)} MB)
              </div>
            )}
            {formState.url && !formState.selectedFile && (
              <div className="mt-3 text-sm text-gray-600">
                📄 Documento atual: <span className="font-mono text-xs">{formState.url.split('/').pop()}</span>
              </div>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Formatos aceitos: {formState.type === 'pdf' ? 'PDF' : 'DOC, DOCX'}. Tamanho máximo: 50 MB.
          </p>
        </div>
      )}

      {/* Campos Condicionais para Enunciados */}
      {formState.category === 'enunciados' && (
        <div className="space-y-4 bg-amber-50 p-4 rounded-lg border border-amber-200">
          <h3 className="text-sm font-semibold text-amber-900">Informações do Enunciado</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tipo de Entidade <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formState.entityType || ''}
                onChange={(e) => updateForm({ entityType: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Ex: CNJ, CNMP, CSJT"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Número do Enunciado <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formState.enunciadoNumber || ''}
                onChange={(e) => updateForm({ enunciadoNumber: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Ex: 1, 2, 3..."
                required
              />
            </div>
          </div>
        </div>
      )}

      {/* Botões de Navegação */}
      <div className="flex justify-between items-center pt-6 border-t">
        <button
          type="button"
          onClick={() => window.history.back()}
          className="px-6 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          Cancelar
        </button>

        <button
          type="button"
          onClick={handleNext}
          className="px-8 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
        >
          Próximo: Classificação →
        </button>
      </div>
    </div>
  );
}
