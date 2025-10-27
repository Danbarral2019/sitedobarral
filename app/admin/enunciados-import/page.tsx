'use client';

import { useState } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { Upload, FileText, AlertCircle, Loader2, CheckCircle, ArrowRight } from 'lucide-react';
import { courses } from '@/data/courses';

export default function EnunciadosImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [entityType, setEntityType] = useState<string>('');
  const [courseId, setCourseId] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<boolean>(false);
  const [documentId, setDocumentId] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setError(null);
      setSuccess(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!file || !entityType || !courseId) {
      setError('Por favor, preencha todos os campos obrigatórios');
      return;
    }

    setIsProcessing(true);
    setError(null);
    setSuccess(false);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('entityType', entityType);
      formData.append('courseId', courseId);

      const response = await fetch('/api/admin/enunciados/import', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Erro ao processar enunciado');
      }

      const data = await response.json();
      setDocumentId(data.documentId);
      setSuccess(true);

      // Limpa o formulário
      setFile(null);
      setEntityType('');
      setCourseId('');

      alert('✅ Enunciado importado com sucesso! Você pode editar os detalhes agora.');
    } catch (err) {
      console.error('Erro ao importar:', err);
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <AdminLayout>
      <div className="max-w-4xl mx-auto p-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <FileText className="w-8 h-8 text-blue-600" />
            Importar Enunciados
          </h1>
          <p className="text-gray-600 mt-2">
            Faça upload de enunciados em PDF de IBDA, INCP ou CJF
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-lg p-8 space-y-6">
          {/* Entidade */}
          <div>
            <label className="block text-sm font-bold text-gray-900 mb-2">
              Entidade *
            </label>
            <select
              value={entityType}
              onChange={(e) => setEntityType(e.target.value)}
              required
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-600 text-gray-900"
            >
              <option value="">Selecione a entidade</option>
              <option value="IBDA">IBDA - Instituto Brasileiro de Direito Administrativo</option>
              <option value="INCP">INCP - Instituto Nacional da Contratação Pública</option>
              <option value="CJF">CJF - Conselho da Justiça Federal</option>
            </select>
          </div>

          {/* Curso */}
          <div>
            <label className="block text-sm font-bold text-gray-900 mb-2">
              Curso *
            </label>
            <select
              value={courseId}
              onChange={(e) => setCourseId(e.target.value)}
              required
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-600 text-gray-900"
            >
              <option value="">Selecione o curso</option>
              <option value="TODOS" className="font-bold bg-blue-50">
                ⭐ TODOS OS CURSOS ({courses.length} cursos)
              </option>
              <option disabled>──────────────────────</option>
              {courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.title}
                </option>
              ))}
            </select>
          </div>

          {/* File Upload */}
          <div>
            <label className="block text-sm font-bold text-gray-900 mb-2">
              Arquivo PDF *
            </label>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-500 transition-colors">
              <input
                type="file"
                accept=".pdf"
                onChange={handleFileChange}
                className="hidden"
                id="file-upload"
              />
              <label
                htmlFor="file-upload"
                className="cursor-pointer flex flex-col items-center gap-3"
              >
                <Upload className="w-12 h-12 text-gray-400" />
                {file ? (
                  <div className="text-center">
                    <p className="text-lg font-medium text-gray-900">{file.name}</p>
                    <p className="text-sm text-gray-600">
                      {(file.size / 1024).toFixed(2)} KB
                    </p>
                    <p className="text-xs text-blue-600 mt-2">Clique para escolher outro arquivo</p>
                  </div>
                ) : (
                  <div className="text-center">
                    <p className="text-lg font-medium text-gray-900">
                      Clique para selecionar arquivo PDF
                    </p>
                    <p className="text-sm text-gray-600">
                      Enunciados compilados em PDF
                    </p>
                  </div>
                )}
              </label>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isProcessing || !file || !entityType || !courseId}
            className="w-full px-8 py-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 text-lg font-bold shadow-lg"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-6 h-6 animate-spin" />
                Processando...
              </>
            ) : (
              <>
                <Upload className="w-6 h-6" />
                Importar Enunciado
              </>
            )}
          </button>
        </form>

        {/* Error */}
        {error && (
          <div className="mt-6 p-4 bg-red-50 border-l-4 border-red-500 rounded-r-lg">
            <div className="flex gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
              <div>
                <p className="font-bold text-red-900">Erro ao importar</p>
                <p className="text-sm text-red-800">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Success */}
        {success && documentId && (
          <div className="mt-6 bg-green-50 rounded-xl shadow-lg p-8 border-2 border-green-200">
            <div className="flex items-center gap-3 mb-6">
              <CheckCircle className="w-8 h-8 text-green-600" />
              <div>
                <h2 className="text-xl font-bold text-green-900">Enunciado importado!</h2>
                <p className="text-green-700">O documento foi criado com sucesso</p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col gap-3">
              <a
                href={`/admin/documentos/${documentId}/edit`}
                className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2 text-lg font-medium shadow-lg"
              >
                <ArrowRight className="w-5 h-5" />
                Editar Documento
              </a>

              <a
                href="/admin/documentos"
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 text-lg font-medium shadow-lg"
              >
                <FileText className="w-5 h-5" />
                Ver Todos os Documentos
              </a>
            </div>
          </div>
        )}

        {/* Instructions */}
        <div className="mt-8 bg-gray-50 rounded-lg p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-3">📚 Como usar</h3>
          <ol className="space-y-2 text-sm text-gray-700">
            <li className="flex gap-2">
              <span className="font-bold text-blue-600">1.</span>
              <span>Selecione a entidade (IBDA, INCP ou CJF)</span>
            </li>
            <li className="flex gap-2">
              <span className="font-bold text-blue-600">2.</span>
              <span>Escolha o curso ou &quot;TODOS OS CURSOS&quot;</span>
            </li>
            <li className="flex gap-2">
              <span className="font-bold text-blue-600">3.</span>
              <span>Faça upload do PDF com os enunciados</span>
            </li>
            <li className="flex gap-2">
              <span className="font-bold text-blue-600">4.</span>
              <span>O sistema irá processar e criar o documento automaticamente</span>
            </li>
            <li className="flex gap-2">
              <span className="font-bold text-blue-600">5.</span>
              <span>Após a importação, você pode editar o documento para ajustar detalhes</span>
            </li>
          </ol>

          <div className="mt-4 p-3 bg-blue-100 rounded border border-blue-200">
            <p className="text-xs text-blue-900">
              <strong>💡 Dica:</strong> Após a importação, o sistema tentará classificar automaticamente
              o enunciado por curso e artigos da Lei 14.133/2021 usando IA. Você pode revisar e ajustar
              essas classificações na página de edição.
            </p>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
