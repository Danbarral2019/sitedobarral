'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Upload, FileSpreadsheet, Loader2, Download, CheckCircle,
  AlertCircle, Eye, FileText, AlertTriangle, Info,
  FileCheck, XCircle, ArrowRight, Sparkles, FolderUp,
  Link as LinkIcon, ArrowLeft, Check
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Breadcrumb } from '@/components/ui/breadcrumb';
import { FileDropzone } from '@/components/ui/file-dropzone';
import { MultiFileDropzone } from '@/components/ui/multi-file-dropzone';
import { Progress } from '@/components/ui/progress';
import { courses } from '@/data/courses';

interface ProcessedDocument {
  title: string;
  description: string;
  category: string;
  courseId?: string;
  courseSlug?: string;
  courseIds?: string[];
  courseSlugs?: string[];
  isMultipleCourses: boolean;
  isAllCourses: boolean;
  isPublic: boolean;
  tags: string[];
  autoClassified: boolean;
  confidence?: number;
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

interface ValidationResult {
  isValid: boolean;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  documents: ProcessedDocument[];
  errors: string[];
}

interface UploadFilesResult {
  total: number;
  matched: number;
  uploaded: number;
  notMatched: string[];
  errors: string[];
  matchedDetails: Array<{
    fileName: string;
    documentId: string;
    documentTitle: string;
  }>;
}

export default function ImportarPage() {
  const router = useRouter();
  const { success, error: errorToast } = useToast();
  const [isLoading, setIsLoading] = useState(true);

  // Step control
  const [currentStep, setCurrentStep] = useState(1);

  // Step 1: Excel Import
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [importProgress, setImportProgress] = useState(0);
  const [importCompleted, setImportCompleted] = useState(false);

  // Step 2: PDF Upload
  const [pdfFiles, setPdfFiles] = useState<File[]>([]);
  const [isUploadingPdfs, setIsUploadingPdfs] = useState(false);
  const [uploadPdfsProgress, setUploadPdfsProgress] = useState(0);
  const [uploadResult, setUploadResult] = useState<UploadFilesResult | null>(null);

  useEffect(() => {
    verifyAdmin();
  }, []);

  const verifyAdmin = async () => {
    try {
      const response = await fetch('/api/auth/verify');
      if (!response.ok) {
        router.push('/admin/login');
        return;
      }

      const data = await response.json();
      if (data.user.role !== 'admin') {
        router.push('/admin/login');
        return;
      }
    } catch (error) {
      console.error('Erro ao verificar admin:', error);
      router.push('/admin/login');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const response = await fetch('/api/admin/import-excel/template');
      if (!response.ok) {
        throw new Error('Erro ao baixar template');
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'template-importacao-documentos.xlsx';
      link.click();
      URL.revokeObjectURL(url);

      success('Template baixado!', 'Use este arquivo como modelo para importação');
    } catch (error) {
      console.error('Erro ao baixar template:', error);
      errorToast('Erro ao baixar', 'Não foi possível baixar o template');
    }
  };

  const handleFileSelect = (file: File) => {
    setSelectedFile(file);
    setValidationResult(null);
  };

  const handleFileRemove = () => {
    setSelectedFile(null);
    setValidationResult(null);
  };

  const handleValidate = async () => {
    if (!selectedFile) {
      errorToast('Nenhum arquivo', 'Selecione um arquivo Excel para validar');
      return;
    }

    setIsValidating(true);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const response = await fetch('/api/admin/import-excel/validate', {
        method: 'POST',
        body: formData
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao validar arquivo');
      }

      setValidationResult(data.validation);

      if (data.validation.isValid) {
        success(
          'Validação concluída!',
          `${data.validation.validRows} documento(s) pronto(s) para importar`
        );
      } else {
        errorToast(
          'Arquivo com erros',
          `${data.validation.invalidRows} documento(s) com problemas`
        );
      }
    } catch (error) {
      console.error('Erro ao validar:', error);
      errorToast('Erro na validação', error instanceof Error ? error.message : 'Erro desconhecido');
    } finally {
      setIsValidating(false);
    }
  };

  const handleImport = async () => {
    if (!selectedFile || !validationResult) {
      return;
    }

    setIsImporting(true);
    setImportProgress(0);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      // Simula progresso
      const progressInterval = setInterval(() => {
        setImportProgress(prev => Math.min(prev + 10, 90));
      }, 200);

      const response = await fetch('/api/admin/import-excel/import', {
        method: 'POST',
        body: formData
      });

      clearInterval(progressInterval);
      setImportProgress(100);

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao importar arquivo');
      }

      success(
        'Importação concluída!',
        `${data.results.imported} documento(s) importado(s) com sucesso`
      );

      setImportCompleted(true);

      // Aguarda um pouco antes de avançar para o próximo passo
      setTimeout(() => {
        setCurrentStep(2);
      }, 1500);
    } catch (error) {
      console.error('Erro ao importar:', error);
      errorToast('Erro na importação', error instanceof Error ? error.message : 'Erro desconhecido');
    } finally {
      setIsImporting(false);
    }
  };

  const handlePdfFilesSelect = (files: File[]) => {
    setPdfFiles([...pdfFiles, ...files]);
  };

  const handlePdfFileRemove = (index: number) => {
    setPdfFiles(pdfFiles.filter((_, i) => i !== index));
  };

  const handleUploadPdfs = async () => {
    if (pdfFiles.length === 0) {
      errorToast('Nenhum arquivo', 'Selecione ao menos um arquivo PDF');
      return;
    }

    setIsUploadingPdfs(true);
    setUploadPdfsProgress(0);

    try {
      const formData = new FormData();
      pdfFiles.forEach(file => {
        formData.append('files', file);
      });

      // Simula progresso
      const progressInterval = setInterval(() => {
        setUploadPdfsProgress(prev => Math.min(prev + 10, 90));
      }, 300);

      const response = await fetch('/api/admin/import-excel/upload-files', {
        method: 'POST',
        body: formData
      });

      clearInterval(progressInterval);
      setUploadPdfsProgress(100);

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao fazer upload dos arquivos');
      }

      setUploadResult(data.results);

      if (data.results.uploaded > 0) {
        success(
          'Upload concluído!',
          `${data.results.uploaded} arquivo(s) vinculado(s) aos documentos`
        );
      }

      if (data.results.notMatched.length > 0) {
        errorToast(
          'Alguns arquivos não foram vinculados',
          `${data.results.notMatched.length} arquivo(s) sem correspondência`
        );
      }
    } catch (error) {
      console.error('Erro ao fazer upload:', error);
      errorToast('Erro no upload', error instanceof Error ? error.message : 'Erro desconhecido');
    } finally {
      setIsUploadingPdfs(false);
    }
  };

  const handleSkipPdfUpload = () => {
    router.push('/admin/documentos');
  };

  const handleFinish = () => {
    router.push('/admin/documentos');
  };

  const getCourseTitle = (courseSlug?: string) => {
    if (!courseSlug) return 'N/A';
    const course = courses.find(c => c.slug === courseSlug);
    return course?.title || courseSlug;
  };

  if (isLoading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-blue-600" />
      </main>
    );
  }

  return (
    <main className="py-12 bg-gradient-to-br from-green-50 via-white to-blue-50 min-h-screen">
      <div className="container mx-auto px-4">
        <div className="max-w-6xl mx-auto">
          <Breadcrumb
            items={[
              { label: 'Admin', href: '/admin' },
              { label: 'Importar Documentos' }
            ]}
            className="mb-6"
          />

          <div className="mb-8">
            <h1 className="text-4xl font-bold text-gray-900 mb-2 flex items-center gap-3">
              <FileSpreadsheet className="w-10 h-10 text-green-600" />
              Importar Documentos via Excel
            </h1>
            <p className="text-gray-700">
              Importe múltiplos documentos de uma vez usando planilha Excel
            </p>
          </div>

          {/* Steps Indicator */}
          <div className="mb-8 bg-white rounded-2xl shadow-lg p-6 border-2 border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                  currentStep === 1
                    ? 'bg-gradient-to-br from-green-600 to-blue-600 text-white'
                    : currentStep > 1
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-200 text-gray-600'
                }`}>
                  {currentStep > 1 ? <Check className="w-6 h-6" /> : '1'}
                </div>
                <div>
                  <p className="font-bold text-gray-900">Importar Excel</p>
                  <p className="text-sm text-gray-600">Metadados dos documentos</p>
                </div>
              </div>

              <div className="h-0.5 flex-1 mx-4 bg-gray-300">
                <div
                  className={`h-full transition-all ${
                    currentStep >= 2 ? 'w-full bg-green-600' : 'w-0'
                  }`}
                />
              </div>

              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                  currentStep === 2
                    ? 'bg-gradient-to-br from-purple-600 to-pink-600 text-white'
                    : currentStep > 2
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-200 text-gray-600'
                }`}>
                  {currentStep > 2 ? <Check className="w-6 h-6" /> : '2'}
                </div>
                <div>
                  <p className="font-bold text-gray-900">Upload de PDFs</p>
                  <p className="text-sm text-gray-600">Arquivos físicos (opcional)</p>
                </div>
              </div>
            </div>
          </div>

          {/* STEP 1: Excel Import */}
          {currentStep === 1 && (
            <>
              {/* Instruções e Download do Template */}
              <div className="bg-white rounded-2xl shadow-lg p-6 border-2 border-gray-200 mb-8">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Info className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <h2 className="text-xl font-bold text-gray-900 mb-3">Como funciona?</h2>
                    <ol className="space-y-2 text-gray-700 mb-4">
                      <li className="flex items-start gap-2">
                        <span className="font-bold text-blue-600">1.</span>
                        <span>Baixe o template Excel clicando no botão abaixo</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="font-bold text-blue-600">2.</span>
                        <span>Preencha com os dados dos documentos (título, descrição, categoria, curso, etc)</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="font-bold text-blue-600">3.</span>
                        <span>Na coluna "Arquivo", coloque o nome exato do PDF (ex: acordao_1234.pdf)</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="font-bold text-blue-600">4.</span>
                        <span>Ou use a coluna "URL" para linkar documentos externos</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="font-bold text-blue-600">5.</span>
                        <span>Importe a planilha e depois faça upload dos PDFs em lote</span>
                      </li>
                    </ol>

                    <div className="bg-gradient-to-r from-green-50 to-blue-50 border-2 border-green-200 rounded-xl p-4 mb-4">
                      <div className="flex items-start gap-3">
                        <Sparkles className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="font-bold text-gray-900 mb-1">Classificação Automática Inteligente</p>
                          <p className="text-sm text-gray-700">
                            O sistema analisa automaticamente o título e descrição dos documentos e sugere
                            o curso e categoria mais adequados usando as regras de classificação do TCU.
                          </p>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={handleDownloadTemplate}
                      className="bg-gradient-to-r from-green-600 to-blue-600 text-white px-6 py-3 rounded-xl font-bold hover:from-green-700 hover:to-blue-700 transition-all shadow-lg flex items-center gap-2"
                    >
                      <Download className="w-5 h-5" />
                      Baixar Template Excel
                    </button>
                  </div>
                </div>
              </div>

              {/* Upload do Arquivo */}
              <div className="bg-white rounded-2xl shadow-lg p-6 border-2 border-gray-200 mb-8">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-pink-600 rounded-lg flex items-center justify-center">
                    <Upload className="w-5 h-5 text-white" />
                  </div>
                  <h2 className="text-xl font-bold text-gray-900">Upload da Planilha</h2>
                </div>

                <FileDropzone
                  onFileSelect={handleFileSelect}
                  selectedFile={selectedFile}
                  onFileRemove={handleFileRemove}
                  accept=".xlsx,.xls"
                  maxSize={10}
                />

                {selectedFile && !validationResult && (
                  <button
                    onClick={handleValidate}
                    disabled={isValidating}
                    className="mt-4 w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-xl font-bold hover:from-blue-700 hover:to-purple-700 transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isValidating ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Validando...
                      </>
                    ) : (
                      <>
                        <FileCheck className="w-5 h-5" />
                        Validar Planilha
                      </>
                    )}
                  </button>
                )}
              </div>

              {/* Resultado da Validação */}
              {validationResult && (
                <div className="bg-white rounded-2xl shadow-lg p-6 border-2 border-gray-200 mb-8">
                  <div className="flex items-center gap-3 mb-6">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      validationResult.isValid
                        ? 'bg-gradient-to-br from-green-600 to-emerald-600'
                        : 'bg-gradient-to-br from-red-600 to-orange-600'
                    }`}>
                      {validationResult.isValid ? (
                        <CheckCircle className="w-5 h-5 text-white" />
                      ) : (
                        <AlertCircle className="w-5 h-5 text-white" />
                      )}
                    </div>
                    <div className="flex-1">
                      <h2 className="text-xl font-bold text-gray-900">
                        Resultado da Validação
                      </h2>
                      <p className="text-sm text-gray-700">
                        {validationResult.validRows} válido(s) • {validationResult.invalidRows} com erro(s)
                      </p>
                    </div>
                  </div>

                  {/* Estatísticas */}
                  <div className="grid md:grid-cols-3 gap-4 mb-6">
                    <div className="bg-gradient-to-br from-blue-50 to-blue-100 border-2 border-blue-200 rounded-xl p-4">
                      <div className="flex items-center gap-3">
                        <FileText className="w-8 h-8 text-blue-600" />
                        <div>
                          <p className="text-2xl font-bold text-gray-900">{validationResult.totalRows}</p>
                          <p className="text-sm text-gray-700">Total de linhas</p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-gradient-to-br from-green-50 to-green-100 border-2 border-green-200 rounded-xl p-4">
                      <div className="flex items-center gap-3">
                        <CheckCircle className="w-8 h-8 text-green-600" />
                        <div>
                          <p className="text-2xl font-bold text-gray-900">{validationResult.validRows}</p>
                          <p className="text-sm text-gray-700">Válidos</p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-gradient-to-br from-red-50 to-red-100 border-2 border-red-200 rounded-xl p-4">
                      <div className="flex items-center gap-3">
                        <XCircle className="w-8 h-8 text-red-600" />
                        <div>
                          <p className="text-2xl font-bold text-gray-900">{validationResult.invalidRows}</p>
                          <p className="text-sm text-gray-700">Com erros</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Erros Globais */}
                  {validationResult.errors.length > 0 && (
                    <div className="mb-6 p-4 bg-red-50 border-2 border-red-200 rounded-xl">
                      <h3 className="font-bold text-red-900 mb-2 flex items-center gap-2">
                        <AlertCircle className="w-5 h-5" />
                        Erros Encontrados
                      </h3>
                      <ul className="space-y-1 text-sm text-red-800">
                        {validationResult.errors.map((error, index) => (
                          <li key={index}>• {error}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Preview dos Documentos */}
                  <div className="mb-6">
                    <h3 className="font-bold text-gray-900 mb-3">Preview dos Documentos</h3>
                    <div className="max-h-96 overflow-y-auto space-y-3">
                      {validationResult.documents.map((doc, index) => (
                        <div
                          key={index}
                          className={`p-4 rounded-xl border-2 ${
                            doc.isValid
                              ? 'bg-gradient-to-r from-green-50 to-blue-50 border-green-200'
                              : 'bg-gradient-to-r from-red-50 to-orange-50 border-red-200'
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            {doc.isValid ? (
                              <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                            ) : (
                              <XCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                            )}
                            <div className="flex-1 min-w-0">
                              <h4 className="font-bold text-gray-900 mb-1">{doc.title}</h4>
                              {doc.description && (
                                <p className="text-sm text-gray-700 mb-2">{doc.description}</p>
                              )}
                              <div className="flex flex-wrap gap-2 text-xs">
                                <span className="px-2 py-1 bg-white border border-gray-300 rounded-lg font-medium">
                                  {doc.category}
                                </span>
                                {doc.isAllCourses ? (
                                  <span className="px-2 py-1 bg-gradient-to-r from-green-100 to-blue-100 text-green-800 border border-green-300 rounded-lg font-bold flex items-center gap-1">
                                    ✨ TODOS OS CURSOS (10)
                                  </span>
                                ) : doc.isMultipleCourses && doc.courseSlugs ? (
                                  <span className="px-2 py-1 bg-gradient-to-r from-blue-100 to-purple-100 text-blue-800 border border-blue-300 rounded-lg font-bold flex items-center gap-1">
                                    📚 {doc.courseSlugs.length} cursos
                                  </span>
                                ) : (
                                  <span className="px-2 py-1 bg-white border border-gray-300 rounded-lg font-medium">
                                    {getCourseTitle(doc.courseSlug)}
                                  </span>
                                )}
                                {doc.autoClassified && (
                                  <span className="px-2 py-1 bg-purple-100 text-purple-800 border border-purple-300 rounded-lg font-medium flex items-center gap-1">
                                    <Sparkles className="w-3 h-3" />
                                    Auto-classificado ({doc.confidence}%)
                                  </span>
                                )}
                                {doc.tags.length > 0 && (
                                  <span className="px-2 py-1 bg-blue-100 text-blue-800 border border-blue-300 rounded-lg font-medium">
                                    {doc.tags.length} tag(s)
                                  </span>
                                )}
                              </div>
                              {doc.isMultipleCourses && doc.courseSlugs && !doc.isAllCourses && (
                                <div className="mt-2 text-xs text-gray-600">
                                  <strong>Cursos:</strong> {doc.courseSlugs.map(slug => getCourseTitle(slug)).join(', ')}
                                </div>
                              )}
                              {doc.warnings.length > 0 && (
                                <div className="mt-2 text-xs text-orange-700">
                                  {doc.warnings.map((warning, idx) => (
                                    <p key={idx}>⚠️ {warning}</p>
                                  ))}
                                </div>
                              )}
                              {doc.errors.length > 0 && (
                                <div className="mt-2 text-xs text-red-700">
                                  {doc.errors.map((error, idx) => (
                                    <p key={idx}>❌ {error}</p>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Botão de Importação */}
                  {validationResult.isValid && (
                    <>
                      {isImporting && (
                        <Progress value={importProgress} className="mb-4" />
                      )}
                      <button
                        onClick={handleImport}
                        disabled={isImporting}
                        className="w-full bg-gradient-to-r from-green-600 to-emerald-600 text-white px-6 py-4 rounded-xl font-bold hover:from-green-700 hover:to-emerald-700 transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isImporting ? (
                          <>
                            <Loader2 className="w-6 h-6 animate-spin" />
                            Importando {validationResult.validRows} documento(s)...
                          </>
                        ) : (
                          <>
                            <ArrowRight className="w-6 h-6" />
                            Confirmar Importação de {validationResult.validRows} Documento(s)
                          </>
                        )}
                      </button>
                    </>
                  )}
                </div>
              )}
            </>
          )}

          {/* STEP 2: PDF Upload */}
          {currentStep === 2 && (
            <>
              {/* Explicação do Matching */}
              <div className="bg-white rounded-2xl shadow-lg p-6 border-2 border-gray-200 mb-8">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-purple-600 to-pink-600 rounded-lg flex items-center justify-center flex-shrink-0">
                    <FolderUp className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <h2 className="text-xl font-bold text-gray-900 mb-3">Upload de PDFs em Lote (Opcional)</h2>
                    <p className="text-gray-700 mb-4">
                      Agora você pode fazer upload dos arquivos PDF que foram referenciados na planilha Excel.
                      O sistema vai automaticamente vincular cada PDF ao documento correto através do nome do arquivo.
                    </p>

                    <div className="bg-gradient-to-r from-blue-50 to-purple-50 border-2 border-blue-200 rounded-xl p-4 mb-4">
                      <h3 className="font-bold text-gray-900 mb-2 flex items-center gap-2">
                        <LinkIcon className="w-5 h-5 text-blue-600" />
                        Como funciona o Matching:
                      </h3>
                      <ul className="space-y-1.5 text-sm text-gray-700">
                        <li className="flex items-start gap-2">
                          <span className="text-blue-600 font-bold">•</span>
                          <span>Se você colocou "acordao_1234.pdf" na coluna Arquivo do Excel, faça upload do arquivo com esse nome exato</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-blue-600 font-bold">•</span>
                          <span>O sistema busca documentos no banco com esse nome de arquivo</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-blue-600 font-bold">•</span>
                          <span>Quando encontrar, faz o upload e vincula automaticamente</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-blue-600 font-bold">•</span>
                          <span>Se não encontrar correspondência, o arquivo será listado como "não vinculado"</span>
                        </li>
                      </ul>
                    </div>

                    <div className="bg-yellow-50 border-2 border-yellow-200 rounded-xl p-4">
                      <p className="text-sm text-yellow-800 flex items-start gap-2">
                        <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                        <span>
                          <strong>Dica:</strong> Se você usou URLs externas na coluna URL (ex: links para site do TCU),
                          não precisa fazer upload aqui. Este passo é apenas para PDFs locais.
                        </span>
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Upload Area */}
              <div className="bg-white rounded-2xl shadow-lg p-6 border-2 border-gray-200 mb-8">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 bg-gradient-to-br from-green-600 to-blue-600 rounded-lg flex items-center justify-center">
                    <Upload className="w-5 h-5 text-white" />
                  </div>
                  <h2 className="text-xl font-bold text-gray-900">Selecionar Arquivos PDF</h2>
                </div>

                <MultiFileDropzone
                  onFilesSelect={handlePdfFilesSelect}
                  selectedFiles={pdfFiles}
                  onFileRemove={handlePdfFileRemove}
                  accept=".pdf,.doc,.docx"
                  maxSize={50}
                  maxFiles={100}
                />

                {pdfFiles.length > 0 && (
                  <div className="mt-4 p-4 bg-blue-50 border-2 border-blue-200 rounded-xl">
                    <p className="text-sm font-bold text-blue-900">
                      {pdfFiles.length} arquivo(s) selecionado(s) para upload
                    </p>
                  </div>
                )}

                {!uploadResult && (
                  <div className="mt-6 flex gap-3">
                    <button
                      onClick={handleSkipPdfUpload}
                      className="flex-1 bg-gray-200 text-gray-700 px-6 py-3 rounded-xl font-bold hover:bg-gray-300 transition-all flex items-center justify-center gap-2"
                    >
                      <ArrowRight className="w-5 h-5" />
                      Pular Este Passo
                    </button>
                    <button
                      onClick={handleUploadPdfs}
                      disabled={isUploadingPdfs || pdfFiles.length === 0}
                      className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 text-white px-6 py-3 rounded-xl font-bold hover:from-purple-700 hover:to-pink-700 transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isUploadingPdfs ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          Fazendo Upload...
                        </>
                      ) : (
                        <>
                          <FolderUp className="w-5 h-5" />
                          Fazer Upload e Vincular
                        </>
                      )}
                    </button>
                  </div>
                )}

                {isUploadingPdfs && (
                  <Progress value={uploadPdfsProgress} className="mt-4" />
                )}
              </div>

              {/* Resultado do Upload */}
              {uploadResult && (
                <div className="bg-white rounded-2xl shadow-lg p-6 border-2 border-gray-200 mb-8">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 bg-gradient-to-br from-green-600 to-emerald-600 rounded-lg flex items-center justify-center">
                      <CheckCircle className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1">
                      <h2 className="text-xl font-bold text-gray-900">
                        Resultado do Upload
                      </h2>
                      <p className="text-sm text-gray-700">
                        {uploadResult.uploaded} arquivo(s) vinculado(s) • {uploadResult.notMatched.length} não vinculado(s)
                      </p>
                    </div>
                  </div>

                  {/* Estatísticas */}
                  <div className="grid md:grid-cols-3 gap-4 mb-6">
                    <div className="bg-gradient-to-br from-blue-50 to-blue-100 border-2 border-blue-200 rounded-xl p-4">
                      <div className="flex items-center gap-3">
                        <FileText className="w-8 h-8 text-blue-600" />
                        <div>
                          <p className="text-2xl font-bold text-gray-900">{uploadResult.total}</p>
                          <p className="text-sm text-gray-700">Total enviado</p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-gradient-to-br from-green-50 to-green-100 border-2 border-green-200 rounded-xl p-4">
                      <div className="flex items-center gap-3">
                        <CheckCircle className="w-8 h-8 text-green-600" />
                        <div>
                          <p className="text-2xl font-bold text-gray-900">{uploadResult.uploaded}</p>
                          <p className="text-sm text-gray-700">Vinculados</p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-gradient-to-br from-orange-50 to-orange-100 border-2 border-orange-200 rounded-xl p-4">
                      <div className="flex items-center gap-3">
                        <AlertCircle className="w-8 h-8 text-orange-600" />
                        <div>
                          <p className="text-2xl font-bold text-gray-900">{uploadResult.notMatched.length}</p>
                          <p className="text-sm text-gray-700">Sem match</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Arquivos Vinculados com Sucesso */}
                  {uploadResult.matchedDetails.length > 0 && (
                    <div className="mb-6 p-4 bg-green-50 border-2 border-green-200 rounded-xl">
                      <h3 className="font-bold text-green-900 mb-3 flex items-center gap-2">
                        <CheckCircle className="w-5 h-5" />
                        Arquivos Vinculados com Sucesso
                      </h3>
                      <div className="space-y-2 max-h-60 overflow-y-auto">
                        {uploadResult.matchedDetails.map((match, index) => (
                          <div key={index} className="text-sm bg-white p-3 rounded-lg border border-green-300">
                            <p className="font-bold text-gray-900">{match.fileName}</p>
                            <p className="text-gray-600">→ vinculado a: {match.documentTitle}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Arquivos Não Vinculados */}
                  {uploadResult.notMatched.length > 0 && (
                    <div className="mb-6 p-4 bg-orange-50 border-2 border-orange-200 rounded-xl">
                      <h3 className="font-bold text-orange-900 mb-3 flex items-center gap-2">
                        <AlertCircle className="w-5 h-5" />
                        Arquivos Sem Correspondência
                      </h3>
                      <p className="text-sm text-orange-800 mb-2">
                        Os seguintes arquivos não foram vinculados porque não encontramos documentos com esses nomes:
                      </p>
                      <ul className="space-y-1 text-sm text-orange-700">
                        {uploadResult.notMatched.map((filename, index) => (
                          <li key={index} className="bg-white p-2 rounded border border-orange-300">• {filename}</li>
                        ))}
                      </ul>
                      <p className="text-sm text-orange-800 mt-3">
                        <strong>Dica:</strong> Verifique se os nomes dos arquivos correspondem exatamente aos nomes informados na coluna "Arquivo" do Excel.
                      </p>
                    </div>
                  )}

                  {/* Erros */}
                  {uploadResult.errors.length > 0 && (
                    <div className="mb-6 p-4 bg-red-50 border-2 border-red-200 rounded-xl">
                      <h3 className="font-bold text-red-900 mb-2 flex items-center gap-2">
                        <AlertCircle className="w-5 h-5" />
                        Erros Encontrados
                      </h3>
                      <ul className="space-y-1 text-sm text-red-800">
                        {uploadResult.errors.map((error, index) => (
                          <li key={index}>• {error}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Botão Finalizar */}
                  <button
                    onClick={handleFinish}
                    className="w-full bg-gradient-to-r from-green-600 to-emerald-600 text-white px-6 py-4 rounded-xl font-bold hover:from-green-700 hover:to-emerald-700 transition-all shadow-lg flex items-center justify-center gap-2"
                  >
                    <CheckCircle className="w-6 h-6" />
                    Concluir e Ver Documentos
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </main>
  );
}
