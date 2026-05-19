'use client';

import dynamic from 'next/dynamic';
import {
  Upload, FileText, Loader2, Plus, ChevronDown, ChevronUp, FolderUp,
} from 'lucide-react';
import { courses } from '@/data/courses';
import { FileDropzone } from '@/components/ui/file-dropzone';
import { MultiFileDropzone } from '@/components/ui/multi-file-dropzone';
import { Progress } from '@/components/ui/progress';
import LeiArticleSelector from '@/components/LeiArticleSelector';
import type {
  DocumentCategory,
  DocumentFormData,
  UploadMode,
  CreationMode,
} from '@/hooks/use-adicionar-documentos';

const WizardEnhanceButton = dynamic(() => import('@/components/admin/WizardEnhanceButton'), {
  loading: () => <div className="text-sm text-gray-600">Carregando analisador...</div>,
  ssr: false,
});

interface UploadSectionProps {
  collapsed: boolean;
  onToggle: () => void;
  uploadMode: UploadMode;
  onUploadModeChange: (mode: UploadMode) => void;
  creationMode: CreationMode;
  onCreationModeChange: (mode: CreationMode) => void;
  formData: DocumentFormData;
  onFormChange: (data: DocumentFormData) => void;
  selectedFile: File | null;
  onFileSelect: (file: File) => void;
  onFileRemove: () => void;
  multipleFiles: File[];
  onMultipleFilesSelect: (files: File[]) => void;
  onMultipleFileRemove: (index: number) => void;
  isUploading: boolean;
  uploadProgress: number;
  onUpload: (e: React.FormEvent) => void;
  onBulkUpload: () => void;
  onManualCreate: (e: React.FormEvent) => void;
}

export function UploadSection({
  collapsed,
  onToggle,
  uploadMode,
  onUploadModeChange,
  creationMode,
  onCreationModeChange,
  formData,
  onFormChange,
  selectedFile,
  onFileSelect,
  onFileRemove,
  multipleFiles,
  onMultipleFilesSelect,
  onMultipleFileRemove,
  isUploading,
  uploadProgress,
  onUpload,
  onBulkUpload,
  onManualCreate,
}: UploadSectionProps) {
  const handleSubmit = (e: React.FormEvent) => {
    if (creationMode === 'manual') return onManualCreate(e);
    if (uploadMode === 'single') return onUpload(e);
    e.preventDefault();
    onBulkUpload();
  };

  return (
    <div className="bg-white rounded-xl shadow-lg mb-6 overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full px-6 py-4 flex items-center justify-between bg-gradient-to-r from-blue-600 to-purple-600 text-white"
      >
        <div className="flex items-center gap-3">
          <Upload className="w-6 h-6" />
          <span className="text-lg font-bold">Upload de Documentos</span>
        </div>
        {collapsed ? <ChevronDown className="w-5 h-5" /> : <ChevronUp className="w-5 h-5" />}
      </button>

      {!collapsed && (
        <div className="p-6">
          {/* Mode toggles */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="flex gap-2 p-1 bg-gray-100 rounded-lg">
              <button
                type="button"
                onClick={() => onUploadModeChange('single')}
                className={`flex-1 px-3 py-2 rounded-lg font-medium text-sm transition-all ${
                  uploadMode === 'single' ? 'bg-white text-blue-600 shadow' : 'text-gray-600'
                }`}
              >
                <Upload className="w-4 h-4 inline mr-1" /> Individual
              </button>
              <button
                type="button"
                onClick={() => onUploadModeChange('bulk')}
                className={`flex-1 px-3 py-2 rounded-lg font-medium text-sm transition-all ${
                  uploadMode === 'bulk' ? 'bg-white text-purple-600 shadow' : 'text-gray-600'
                }`}
              >
                <FolderUp className="w-4 h-4 inline mr-1" /> Em Lote
              </button>
            </div>

            <div className="flex gap-2 p-1 bg-gray-100 rounded-lg">
              <button
                type="button"
                onClick={() => onCreationModeChange('file')}
                className={`flex-1 px-3 py-2 rounded-lg font-medium text-sm transition-all ${
                  creationMode === 'file' ? 'bg-white text-blue-600 shadow' : 'text-gray-600'
                }`}
              >
                <Upload className="w-4 h-4 inline mr-1" /> Com Arquivo
              </button>
              <button
                type="button"
                onClick={() => onCreationModeChange('manual')}
                className={`flex-1 px-3 py-2 rounded-lg font-medium text-sm transition-all ${
                  creationMode === 'manual' ? 'bg-white text-green-600 shadow' : 'text-gray-600'
                }`}
              >
                <FileText className="w-4 h-4 inline mr-1" /> Manual
              </button>
            </div>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="grid md:grid-cols-2 gap-6">
              {/* Left column: metadata */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">Curso *</label>
                  <select
                    value={formData.courseId}
                    onChange={(e) => onFormChange({ ...formData, courseId: e.target.value })}
                    required
                    className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Selecione um curso</option>
                    <option value="TODOS" className="font-bold">TODOS OS CURSOS ({courses.length} cursos)</option>
                    <option disabled>────────────────────</option>
                    {courses.map((course) => (
                      <option key={course.id} value={course.id}>{course.title}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">Titulo *</label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => onFormChange({ ...formData, title: e.target.value })}
                    required
                    placeholder="Ex: Apostila Completa"
                    className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">Descricao</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => onFormChange({ ...formData, description: e.target.value })}
                    rows={2}
                    placeholder="Descricao do documento..."
                    className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">Categoria *</label>
                  <select
                    value={formData.category}
                    onChange={(e) => onFormChange({ ...formData, category: e.target.value as DocumentCategory })}
                    required
                    className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="apostila">Apostila</option>
                    <option value="acordao">Acordao</option>
                    <option value="parecer">Parecer</option>
                    <option value="orientacao-normativa">Orientacao Normativa (AGU)</option>
                    <option value="enunciados">Enunciados</option>
                    <option value="sumula">Sumula</option>
                    <option value="edital">Edital</option>
                    <option value="artigo">Artigo</option>
                    <option value="outro">Outro</option>
                  </select>
                </div>

                {(formData.category === 'enunciados' || formData.category === 'sumula') && (
                  <>
                    <div>
                      <label className="block text-sm font-semibold text-gray-900 mb-2">Entidade *</label>
                      <select
                        value={formData.entityType || ''}
                        onChange={(e) => onFormChange({ ...formData, entityType: e.target.value })}
                        required
                        className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg"
                      >
                        <option value="">Selecione a entidade</option>
                        <option value="IBDA">IBDA</option>
                        <option value="INCP">INCP</option>
                        <option value="CJF">CJF</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-900 mb-2">Numero</label>
                      <input
                        type="text"
                        value={formData.enunciadoNumber || ''}
                        onChange={(e) => onFormChange({ ...formData, enunciadoNumber: e.target.value })}
                        placeholder="Ex: 123"
                        className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg"
                      />
                    </div>
                  </>
                )}

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="isPublic"
                    checked={formData.isPublic}
                    onChange={(e) => onFormChange({ ...formData, isPublic: e.target.checked })}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  <label htmlFor="isPublic" className="text-sm font-medium text-gray-900">
                    Documento publico (visivel sem QR Code)
                  </label>
                </div>
              </div>

              {/* Right column: file/manual + articles */}
              <div className="space-y-4">
                {creationMode === 'file' ? (
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-2">
                      Arquivo{uploadMode === 'bulk' ? 's' : ''} *
                    </label>
                    {uploadMode === 'single' ? (
                      <FileDropzone
                        onFileSelect={onFileSelect}
                        selectedFile={selectedFile}
                        onFileRemove={onFileRemove}
                        accept=".pdf,.doc,.docx,.mp4,.avi,.mov"
                        maxSize={100}
                      />
                    ) : (
                      <MultiFileDropzone
                        onFilesSelect={onMultipleFilesSelect}
                        selectedFiles={multipleFiles}
                        onFileRemove={onMultipleFileRemove}
                        accept=".pdf,.doc,.docx,.mp4,.avi,.mov"
                        maxSize={100}
                        maxFiles={10}
                      />
                    )}
                  </div>
                ) : (
                  <div className="border-2 border-dashed border-green-300 rounded-lg p-4 bg-green-50">
                    <div className="flex items-center gap-2 mb-3">
                      <FileText className="w-5 h-5 text-green-600" />
                      <h3 className="font-semibold text-green-900">Criacao Manual</h3>
                    </div>
                    <textarea
                      value={formData.textContent}
                      onChange={(e) => onFormChange({ ...formData, textContent: e.target.value })}
                      required
                      placeholder="Digite o texto completo..."
                      rows={4}
                      className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg"
                    />
                    <textarea
                      value={formData.notes}
                      onChange={(e) => onFormChange({ ...formData, notes: e.target.value })}
                      placeholder="Observacoes adicionais..."
                      rows={2}
                      className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg mt-2"
                    />
                  </div>
                )}

                {uploadMode === 'single' && (
                  <WizardEnhanceButton
                    title={formData.title}
                    description={formData.description}
                    category={formData.category}
                    currentSelectedArticles={formData.leiArticles}
                    onApplySuggestions={(articles) => onFormChange({ ...formData, leiArticles: articles })}
                    disabled={!formData.title}
                  />
                )}

                <LeiArticleSelector
                  selectedArticles={formData.leiArticles}
                  onChange={(articles) => onFormChange({ ...formData, leiArticles: articles })}
                  maxArticles={5}
                  showPopularArticles={true}
                />
              </div>
            </div>

            {isUploading && <Progress value={uploadProgress} className="mt-4" />}

            <button
              type="submit"
              disabled={isUploading}
              className="mt-6 w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-xl font-bold hover:from-blue-700 hover:to-purple-700 transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isUploading ? (
                <><Loader2 className="w-5 h-5 animate-spin" /> Enviando...</>
              ) : (
                <><Plus className="w-5 h-5" /> {creationMode === 'manual' ? 'Criar Documento' : 'Fazer Upload'}</>
              )}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
