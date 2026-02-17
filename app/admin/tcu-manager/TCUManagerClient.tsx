'use client';

import { useState } from 'react';
import {
  Upload, FileSpreadsheet, Download, CheckCircle, AlertCircle,
  Loader2, ArrowRight, FileText, AlertTriangle, RefreshCw, Sparkles, Star
} from 'lucide-react';
import Link from 'next/link';
import TCUReviewTable from '@/components/TCUReviewTable';
import { courses } from '@/data/courses';

type Step = 1 | 2 | 2.5 | 3;
type SourceType = 'tcu' | 'custom' | null;

// Helper: converte IDs de cursos para slugs
const courseIdsToSlugs = (courseIds: string[]): string => {
  const slugs = courseIds
    .map(id => courses.find(c => c.id === id)?.slug)
    .filter(Boolean);
  return slugs.join(',');
};

interface ValidationResult {
  stats: {
    total: number;
    valid: number;
    invalid: number;
    duplicates: number;
    new: number;
  };
  documents: Array<{
    title: string;
    description: string;
    category: string;
    isValid: boolean;
    isDuplicate: boolean;
    duplicateInfo?: {
      id: string;
      title: string;
      uploadedAt: string;
    };
    errors: string[];
    warnings: string[];
    rowIndex: number;
    rawData: Record<string, unknown>;
    tcuData?: {
      enunciado: string;
      area: string;
      tema: string;
      subtema: string;
      data: string;
      acordao: string;
      autorTese: string;
      legislacao: string;
      outrosIndexadores: string;
      tipoProcesso: string;
    };
  }>;
}

interface EnrichmentResult {
  success: boolean;
  numeroAcordao: string;
  ementaCompleta?: string;
  textoCompleto?: string;
  linkPDF?: string;
  metadados?: {
    relator?: string;
    dataSessao?: string;
    orgaoJulgador?: string;
    processo?: string;
  };
  error?: string;
}

interface ClassificationResult {
  success: boolean;
  numeroAcordao: string;
  titulo: string;
  descricao: string;
  categoria: string;
  cursos: string[];
  tags: string[];
  artigos: string[];
  confianca: number;
  raciocinio: string;
  error?: string;
}

interface ReviewDocument {
  rowIndex: number;
  title: string;
  description: string;
  category: string;
  tcuData: NonNullable<ValidationResult['documents'][0]['tcuData']>;
  enrichment?: EnrichmentResult;
  classification?: ClassificationResult;
  // User edits
  editedTitle?: string;
  editedDescription?: string;
  editedCategory?: string;
  editedCourses?: string[];
  editedTags?: string[];
  editedArtigos?: string[];
  editedUrl?: string;
  approved?: boolean;
  skipped?: boolean;
}

interface ImportResult {
  total: number;
  imported: number;
  duplicates: number;
  failed: number;
  errors: string[];
  duplicateList: string[];
  importedList: string[];
}

export default function TCUManagerClient() {
  const [currentStep, setCurrentStep] = useState<Step>(1);
  const [sourceType, setSourceType] = useState<SourceType>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Etapa 1: Upload e Conversão
  const [isConverting, setIsConverting] = useState(false);

  // Etapa 2: Validação e Detecção de Duplicatas
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);

  // Etapa 2.5: Revisão, Enriquecimento e Classificação
  const [reviewDocuments, setReviewDocuments] = useState<ReviewDocument[]>([]);
  const [isClassifying, setIsClassifying] = useState(false);
  const [classificationProgress, setClassificationProgress] = useState({ current: 0, total: 0 });

  // Etapa 3: Importação
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  const [error, setError] = useState<string | null>(null);

  // === ETAPA 1: UPLOAD E CONVERSÃO ===

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setError(null);
    }
  };

  const handleConvertTCU = async () => {
    if (!selectedFile) return;

    try {
      setIsConverting(true);
      setError(null);

      const formData = new FormData();
      formData.append('file', selectedFile);

      const response = await fetch('/api/admin/tcu-manager/convert', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Erro ao converter');
      }

      await response.json();

      // Agora valida automaticamente
      await validateDocuments(selectedFile, 'tcu');

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setIsConverting(false);
    }
  };

  const validateDocuments = async (file: File, type: 'tcu' | 'custom') => {
    try {
      setIsValidating(true);
      setError(null);

      const formData = new FormData();
      formData.append('file', file);
      formData.append('sourceType', type);

      const response = await fetch('/api/admin/tcu-manager/validate', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Erro ao validar');
      }

      const data = await response.json();
      setValidationResult(data);
      setCurrentStep(2);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setIsValidating(false);
    }
  };

  const handleUploadCustom = async () => {
    if (!selectedFile) return;
    await validateDocuments(selectedFile, 'custom');
  };

  // === ETAPA 2: VALIDAÇÃO ===

  const handleProceedToReview = async () => {
    if (!validationResult || sourceType !== 'tcu') {
      // Se não for TCU, pula direto para importação
      setCurrentStep(3);
      return;
    }

    // Prepara documentos para revisão (somente válidos e não-duplicados com tcuData)
    const docsToReview: ReviewDocument[] = validationResult.documents
      .filter(doc => doc.isValid && !doc.isDuplicate && doc.tcuData)
      .map(doc => ({
        rowIndex: doc.rowIndex,
        title: doc.title,
        description: doc.description,
        category: doc.category,
        tcuData: doc.tcuData!,
      }));

    setReviewDocuments(docsToReview);
    setCurrentStep(2.5);

    // Inicia enriquecimento e classificação automaticamente
    await handleEnrichAndClassify(docsToReview);
  };

  const handleEnrichAndClassify = async (docs: ReviewDocument[]) => {
    if (docs.length === 0) return;

    // Pulando enriquecimento - vai direto para classificação
    console.log('[TCU Manager] Pulando enriquecimento, indo direto para classificação IA');

    // Classificação IA em lotes pequenos (3 por vez para evitar timeout de 10s do Vercel)
    try {
      setIsClassifying(true);
      setClassificationProgress({ current: 0, total: docs.length });

      const BATCH_SIZE = 3; // 3 documentos por requisição (evita timeout)
      let processedCount = 0;

      // Processa em lotes
      for (let i = 0; i < docs.length; i += BATCH_SIZE) {
        const batch = docs.slice(i, i + BATCH_SIZE);
        console.log(`[TCU Manager] Classificando lote ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(docs.length / BATCH_SIZE)} (${batch.length} docs)`);

        const response = await fetch('/api/admin/tcu-manager/classify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            documents: batch.map(doc => ({
              tcuData: doc.tcuData,
              enrichment: doc.enrichment,
              rowIndex: doc.rowIndex,
            })),
          }),
        });

        if (!response.ok) {
          console.error(`Erro no lote ${i}-${i + batch.length}`);
          continue; // Pula para próximo lote
        }

        const classifyData = await response.json();

        // Atualiza documentos com classificação
        setReviewDocuments(prev => {
          const updated = [...prev];
          classifyData.results.forEach((result: { rowIndex: number; classification: ClassificationResult }) => {
            const index = updated.findIndex(d => d.rowIndex === result.rowIndex);
            if (index !== -1) {
              updated[index].classification = result.classification;
            }
          });
          return updated;
        });

        processedCount += batch.length;
        setClassificationProgress({ current: processedCount, total: docs.length });
      }

      console.log(`[TCU Manager] ✅ Classificação concluída: ${processedCount}/${docs.length}`);

    } catch (err) {
      console.error('Erro na classificação:', err);
      setError('Erro ao classificar documentos. Você pode editar manualmente.');
    } finally {
      setIsClassifying(false);
    }
  };

  const handleApproveDocument = (rowIndex: number, editedData: {
    title: string;
    description: string;
    category: string;
    courses: string[];
    tags: string[];
    artigos: string[];
    url: string;
  }) => {
    setReviewDocuments(prev => {
      const updated = [...prev];
      const index = updated.findIndex(d => d.rowIndex === rowIndex);
      if (index !== -1) {
        updated[index].editedTitle = editedData.title;
        updated[index].editedDescription = editedData.description;
        updated[index].editedCategory = editedData.category;
        updated[index].editedCourses = editedData.courses;
        updated[index].editedTags = editedData.tags;
        updated[index].editedArtigos = editedData.artigos;
        updated[index].editedUrl = editedData.url;
        updated[index].approved = true;
      }
      return updated;
    });
  };

  const handleSkipDocument = (rowIndex: number) => {
    setReviewDocuments(prev => {
      const updated = [...prev];
      const index = updated.findIndex(d => d.rowIndex === rowIndex);
      if (index !== -1) {
        updated[index].skipped = true;
      }
      return updated;
    });
  };

  const handleReprocessDocument = async (rowIndex: number) => {
    const doc = reviewDocuments.find(d => d.rowIndex === rowIndex);
    if (!doc) return;

    await handleEnrichAndClassify([doc]);
  };

  const handleProceedToImport = async () => {
    // Filtra somente documentos aprovados
    const approvedDocs = reviewDocuments.filter(d => d.approved);

    if (approvedDocs.length === 0) {
      setError('Nenhum documento foi aprovado para importação');
      return;
    }

    // Executa a importação
    await handleImportFromReview();
  };

  const handleDownloadForEdit = async () => {
    if (!validationResult) return;

    try {
      // Importa xlsx dinamicamente
      const XLSX = await import('xlsx');

      // Prepara dados para o Excel
      const excelData = validationResult.documents.map((doc, index) => {
        const raw = doc.rawData as Record<string, unknown>;

        return {
          '#': index + 1,
          'Status': doc.isDuplicate ? '🔄 DUPLICATA' : doc.isValid ? '✅ VÁLIDO' : '❌ INVÁLIDO',
          'Titulo': doc.title || raw['Titulo'] || raw['titulo'] || raw['Assunto'] || '',
          'Descricao': doc.description || raw['Descricao'] || raw['descricao'] || raw['Ementa'] || '',
          'Categoria': doc.category || raw['Categoria'] || 'acordao',
          'Curso': raw['Curso'] || raw['curso'] || '',
          'Tags': raw['Tags'] || raw['tags'] || '',
          'Publico': raw['Publico'] || raw['publico'] || 'SIM',
          'URL': raw['URL'] || raw['url'] || '',
          'Arquivo': raw['Arquivo'] || raw['arquivo'] || '',
          'Avisos': [...doc.errors, ...doc.warnings].join('; '),
        };
      });

      // Cria workbook
      const ws = XLSX.utils.json_to_sheet(excelData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Validação');

      // Ajusta largura das colunas
      const colWidths = [
        { wch: 5 },   // #
        { wch: 15 },  // Status
        { wch: 60 },  // Titulo
        { wch: 80 },  // Descricao
        { wch: 15 },  // Categoria
        { wch: 30 },  // Curso
        { wch: 30 },  // Tags
        { wch: 10 },  // Publico
        { wch: 50 },  // URL
        { wch: 30 },  // Arquivo
        { wch: 50 },  // Avisos
      ];
      ws['!cols'] = colWidths;

      // Faz download
      XLSX.writeFile(wb, `tcu-validacao-${new Date().toISOString().split('T')[0]}.xlsx`);

    } catch (err) {
      console.error('Erro ao gerar Excel:', err);
      alert('Erro ao gerar arquivo para download');
    }
  };

  // === ETAPA 3: IMPORTAÇÃO ===

  const handleImport = async () => {
    // Se veio da revisão, usa reviewDocuments
    if (reviewDocuments.length > 0) {
      return handleImportFromReview();
    }

    // Senão, usa validationResult (fluxo antigo para planilhas custom)
    if (!validationResult) return;

    try {
      setIsImporting(true);
      setError(null);

      // Prepara documentos para importação (somente os válidos e não-duplicados)
      const documentsToImport = validationResult.documents
        .filter(doc => doc.isValid)
        .map(doc => {
          const raw = doc.rawData as Record<string, unknown>;
          return {
            title: doc.title || raw['Titulo'] || raw['titulo'] || raw['Assunto'] || '',
            description: doc.description || raw['Descricao'] || raw['descricao'] || raw['Ementa'] || '',
            category: doc.category || raw['Categoria'] || raw['categoria'] || 'acordao',
            course: raw['Curso'] || raw['curso'] || '',
            tags: raw['Tags'] || raw['tags'] || '',
            publico: raw['Publico'] || raw['publico'] || 'SIM',
            url: raw['URL'] || raw['url'] || '',
            arquivo: raw['Arquivo'] || raw['arquivo'] || '',
            isDuplicate: doc.isDuplicate,
          };
        });

      const response = await fetch('/api/admin/tcu-manager/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documents: documentsToImport }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Erro ao importar');
      }

      const data = await response.json();
      setImportResult(data.results);
      setCurrentStep(3);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setIsImporting(false);
    }
  };

  const handleImportFromReview = async () => {
    try {
      setIsImporting(true);
      setError(null);

      // Prepara documentos aprovados com TODOS os dados enriquecidos
      const documentsToImport = reviewDocuments
        .filter(doc => doc.approved)
        .map(doc => {
          const courseIds = doc.editedCourses || [];
          const courseSlugs = courseIdsToSlugs(courseIds); // Converte IDs para slugs

          return {
            title: doc.editedTitle || doc.title,
            description: doc.editedDescription || doc.description,
            category: doc.editedCategory || doc.category,
            course: courseSlugs, // Slugs dos cursos (não IDs!)
            tags: (doc.editedTags || []).join(','),
            leiArticles: (doc.editedArtigos || []).join(','), // Artigos da Lei 14.133/2021
            publico: 'SIM', // TCU acórdãos são públicos
            url: doc.editedUrl || doc.enrichment?.linkPDF || '#', // Usa URL editado ou do enrichment
            arquivo: '',
            isDuplicate: false,
            // Dados enriquecidos
            tcuData: doc.tcuData,
            enrichment: doc.enrichment,
            classification: doc.classification,
          };
        });

      console.log('[TCU Manager] Importando documentos enriquecidos:', documentsToImport.length);
      console.log('[TCU Manager] Exemplo de curso:', documentsToImport[0]?.course);

      const response = await fetch('/api/admin/tcu-manager/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documents: documentsToImport }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Erro ao importar');
      }

      const data = await response.json();
      setImportResult(data.results);
      setCurrentStep(3);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setIsImporting(false);
    }
  };

  const handleReset = () => {
    setCurrentStep(1);
    setSourceType(null);
    setSelectedFile(null);
    setValidationResult(null);
    setImportResult(null);
    setError(null);
  };

  // === RENDER ===

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
          <FileSpreadsheet className="w-8 h-8 text-blue-600" />
          Gerenciador de Acórdãos TCU
        </h1>
        <p className="text-gray-600 mt-2">
          Importe, converta e gerencie acórdãos com detecção automática de duplicatas
        </p>
      </div>

      {/* Cross-link para Destaques TCU */}
      <Link
        href="/admin/tcu-highlights"
        className="mb-6 flex items-center gap-3 p-4 bg-purple-50 border border-purple-200 rounded-lg hover:bg-purple-100 transition-colors"
      >
        <Star className="w-5 h-5 text-purple-600 flex-shrink-0" />
        <div className="flex-1">
          <span className="font-semibold text-purple-900">Destaques TCU</span>
          <span className="text-sm text-purple-600 ml-2">Acórdãos com potencial editorial identificados pela IA</span>
        </div>
        <ArrowRight className="w-4 h-4 text-purple-400" />
      </Link>

      {/* Progress Steps */}
      <div className="mb-8 flex items-center justify-center overflow-x-auto">
        {[1, 2, 2.5, 3].map((step, index) => (
          <div key={step} className="flex items-center flex-shrink-0">
            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${
              currentStep === step
                ? 'bg-blue-100 text-blue-800 font-bold'
                : currentStep > step
                ? 'bg-green-100 text-green-800'
                : 'bg-gray-100 text-gray-600'
            }`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs ${
                currentStep === step
                  ? 'bg-blue-600 text-white'
                  : currentStep > step
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-300 text-gray-600'
              }`}>
                {currentStep > step ? <CheckCircle className="w-4 h-4" /> :
                 step === 2.5 ? <Sparkles className="w-4 h-4" /> : Math.floor(step)}
              </div>
              <span className="hidden sm:inline text-sm">
                {step === 1 ? 'Upload' :
                 step === 2 ? 'Validação' :
                 step === 2.5 ? 'Revisão IA' :
                 'Importação'}
              </span>
            </div>
            {index < 3 && (
              <div className="w-8 h-1 bg-gray-300 mx-1" />
            )}
          </div>
        ))}
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 rounded-r-lg">
          <div className="flex gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
            <div>
              <p className="font-bold text-red-900">Erro</p>
              <p className="text-sm text-red-800">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* ETAPA 1: UPLOAD E CONVERSÃO */}
      {currentStep === 1 && (
        <div className="bg-white rounded-xl shadow-lg p-8">
          <h2 className="text-xl font-bold text-gray-900 mb-6">
            Passo 1: Selecione o tipo de importação
          </h2>

          {!sourceType && (
            <div className="grid md:grid-cols-3 gap-4">
              {/* Opção TCU */}
              <button
                onClick={() => setSourceType('tcu')}
                className="p-6 border-2 border-gray-300 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition-all"
              >
                <FileText className="w-12 h-12 text-blue-600 mx-auto mb-3" />
                <h3 className="font-bold text-gray-900 mb-2">Planilha TCU</h3>
                <p className="text-sm text-gray-600">
                  Upload de arquivo exportado do site do TCU (.xls/.xlsx)
                </p>
              </button>

              {/* Opção Custom */}
              <button
                onClick={() => setSourceType('custom')}
                className="p-6 border-2 border-gray-300 rounded-xl hover:border-green-500 hover:bg-green-50 transition-all"
              >
                <FileSpreadsheet className="w-12 h-12 text-green-600 mx-auto mb-3" />
                <h3 className="font-bold text-gray-900 mb-2">Planilha Própria</h3>
                <p className="text-sm text-gray-600">
                  Upload de arquivo já no formato do sistema
                </p>
              </button>

              {/* Opção Template */}
              <a
                href="/api/admin/import-excel/template"
                download
                className="p-6 border-2 border-gray-300 rounded-xl hover:border-purple-500 hover:bg-purple-50 transition-all block text-center"
              >
                <Download className="w-12 h-12 text-purple-600 mx-auto mb-3" />
                <h3 className="font-bold text-gray-900 mb-2">Baixar Template</h3>
                <p className="text-sm text-gray-600">
                  Crie sua própria planilha do zero
                </p>
              </a>
            </div>
          )}

          {sourceType && (
            <div className="space-y-6">
              <div className="p-4 bg-blue-50 border-l-4 border-blue-500 rounded-r-lg">
                <p className="text-sm text-blue-900">
                  <strong>Tipo selecionado:</strong>{' '}
                  {sourceType === 'tcu' ? 'Planilha TCU (conversão automática)' : 'Planilha própria (formato do sistema)'}
                </p>
              </div>

              {/* File Upload */}
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-500 transition-colors">
                <input
                  type="file"
                  accept=".xls,.xlsx"
                  onChange={handleFileSelect}
                  className="hidden"
                  id="file-upload"
                />
                <label htmlFor="file-upload" className="cursor-pointer">
                  <Upload className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                  {selectedFile ? (
                    <div>
                      <p className="text-lg font-medium text-gray-900">{selectedFile.name}</p>
                      <p className="text-sm text-gray-600">{(selectedFile.size / 1024).toFixed(2)} KB</p>
                      <p className="text-xs text-blue-600 mt-2">Clique para escolher outro arquivo</p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-lg font-medium text-gray-900">
                        Clique para selecionar arquivo
                      </p>
                      <p className="text-sm text-gray-600">
                        Formatos: .xls, .xlsx
                      </p>
                    </div>
                  )}
                </label>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setSourceType(null);
                    setSelectedFile(null);
                  }}
                  className="px-6 py-3 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors font-medium"
                >
                  Voltar
                </button>
                <button
                  onClick={sourceType === 'tcu' ? handleConvertTCU : handleUploadCustom}
                  disabled={!selectedFile || isConverting || isValidating}
                  className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 font-medium"
                >
                  {isConverting || isValidating ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      {isConverting ? 'Convertendo...' : 'Validando...'}
                    </>
                  ) : (
                    <>
                      {sourceType === 'tcu' ? 'Converter e Validar' : 'Validar Planilha'}
                      <ArrowRight className="w-5 h-5" />
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ETAPA 2: VALIDAÇÃO E REVISÃO */}
      {currentStep === 2 && validationResult && (
        <div className="space-y-6">
          {/* Stats Card */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Resumo da Validação</h2>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <div className="text-3xl font-bold text-gray-900">{validationResult.stats.total}</div>
                <div className="text-sm text-gray-600">Total</div>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <div className="text-3xl font-bold text-green-600">{validationResult.stats.new}</div>
                <div className="text-sm text-green-800">Novos</div>
              </div>
              <div className="text-center p-4 bg-yellow-50 rounded-lg">
                <div className="text-3xl font-bold text-yellow-600">{validationResult.stats.duplicates}</div>
                <div className="text-sm text-yellow-800">Duplicatas</div>
              </div>
              <div className="text-center p-4 bg-red-50 rounded-lg">
                <div className="text-3xl font-bold text-red-600">{validationResult.stats.invalid}</div>
                <div className="text-sm text-red-800">Inválidos</div>
              </div>
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <div className="text-3xl font-bold text-blue-600">{validationResult.stats.valid}</div>
                <div className="text-sm text-blue-800">Válidos</div>
              </div>
            </div>
          </div>

          {/* Duplicates Warning */}
          {validationResult.stats.duplicates > 0 && (
            <div className="bg-yellow-50 border-l-4 border-yellow-500 rounded-r-lg p-4">
              <div className="flex gap-3">
                <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0" />
                <div>
                  <p className="font-bold text-yellow-900">
                    {validationResult.stats.duplicates} duplicata(s) detectada(s)
                  </p>
                  <p className="text-sm text-yellow-800">
                    Estes documentos já existem no banco de dados e serão pulados automaticamente.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="bg-white rounded-xl shadow-lg p-6 flex gap-3">
            <button
              onClick={() => setCurrentStep(1)}
              className="px-6 py-3 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors font-medium"
            >
              ← Voltar
            </button>
            <button
              onClick={handleDownloadForEdit}
              className="px-6 py-3 border-2 border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50 transition-colors font-medium flex items-center gap-2"
            >
              <Download className="w-5 h-5" />
              Baixar para Editar
            </button>
            {sourceType === 'tcu' ? (
              <button
                onClick={handleProceedToReview}
                disabled={validationResult.stats.new === 0}
                className="flex-1 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 font-medium"
              >
                <Sparkles className="w-5 h-5" />
                Revisar com IA ({validationResult.stats.new} docs)
                <ArrowRight className="w-5 h-5" />
              </button>
            ) : (
              <button
                onClick={handleImport}
                disabled={isImporting || validationResult.stats.new === 0}
                className="flex-1 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 font-medium"
              >
                {isImporting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Importando...
                  </>
                ) : (
                  <>
                    Importar {validationResult.stats.new} Novos
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      )}

      {/* ETAPA 2.5: REVISÃO COM IA */}
      {currentStep === 2.5 && (
        <div className="space-y-6">
          {/* Progress Banner */}
          {isClassifying && (
            <div className="bg-purple-50 border-l-4 border-purple-500 rounded-r-lg p-4">
              <div className="flex items-center gap-3">
                <Loader2 className="w-5 h-5 text-purple-600 animate-spin flex-shrink-0" />
                <div className="flex-1">
                  <p className="font-bold text-purple-900">
                    Classificando com IA... ({classificationProgress.current}/{classificationProgress.total})
                  </p>
                  <p className="text-sm text-purple-800">
                    Analisando contexto e sugerindo cursos/tags
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Review Table */}
          {!isClassifying && reviewDocuments.length > 0 && (
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-6">
                Revisar e Editar Classificações
              </h2>

              <TCUReviewTable
                documents={reviewDocuments}
                availableCourses={[
                  { id: '1', nome: 'Nova Lei de Licitações (Lei 14.133/2021)' },
                  { id: '2', nome: 'Planejamento das Contratações Públicas' },
                  { id: '3', nome: 'Gestão e Fiscalização de Contratos' },
                  { id: '4', nome: 'Processo Administrativo Sancionador' },
                  { id: '5', nome: 'Inovação nas Contratações Públicas' },
                  { id: '6', nome: 'Terceirização e Formação de Preços' },
                  { id: '7', nome: 'Assessoramento Jurídico na Nova Lei' },
                  { id: '8', nome: 'Revisão, Reajuste e Repactuação' },
                  { id: '9', nome: 'Alterações Contratuais' },
                  { id: '10', nome: 'Contratação Direta' },
                ]}
                onApprove={handleApproveDocument}
                onSkip={handleSkipDocument}
                onReprocess={handleReprocessDocument}
              />
            </div>
          )}

          {/* Action Buttons */}
          {!isClassifying && reviewDocuments.length > 0 && (
            <div className="bg-white rounded-xl shadow-lg p-6 flex gap-3">
              <button
                onClick={() => setCurrentStep(2)}
                className="px-6 py-3 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors font-medium"
              >
                ← Voltar para Validação
              </button>

              <div className="flex-1 text-center py-3">
                <p className="text-sm text-gray-600">
                  {reviewDocuments.filter(d => d.approved).length} de {reviewDocuments.length} documentos aprovados
                </p>
              </div>

              <button
                onClick={handleProceedToImport}
                disabled={reviewDocuments.filter(d => d.approved).length === 0}
                className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2 font-medium"
              >
                Importar Aprovados
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* ETAPA 3: RESULTADO DA IMPORTAÇÃO */}
      {currentStep === 3 && importResult && (
        <div className="bg-white rounded-xl shadow-lg p-8">
          <div className="text-center mb-8">
            <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-4" />
            <h2 className="text-3xl font-bold text-gray-900">Importação Concluída!</h2>
          </div>

          <div className="grid md:grid-cols-3 gap-4 mb-8">
            <div className="text-center p-6 bg-green-50 rounded-lg">
              <div className="text-4xl font-bold text-green-600">{importResult.imported}</div>
              <div className="text-sm text-green-800 mt-2">Importados</div>
            </div>
            <div className="text-center p-6 bg-yellow-50 rounded-lg">
              <div className="text-4xl font-bold text-yellow-600">{importResult.duplicates}</div>
              <div className="text-sm text-yellow-800 mt-2">Duplicatas Puladas</div>
            </div>
            <div className="text-center p-6 bg-red-50 rounded-lg">
              <div className="text-4xl font-bold text-red-600">{importResult.failed}</div>
              <div className="text-sm text-red-800 mt-2">Falhas</div>
            </div>
          </div>

          {importResult.errors.length > 0 && (
            <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 rounded-r-lg">
              <p className="font-bold text-red-900 mb-2">Erros durante a importação:</p>
              <ul className="list-disc list-inside text-sm text-red-800 space-y-1">
                {importResult.errors.map((err, idx) => (
                  <li key={idx}>{err}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex gap-3">
            <a
              href="/admin/documentos"
              className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-center font-medium"
            >
              Ver Documentos
            </a>
            <button
              onClick={handleReset}
              className="px-6 py-3 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors font-medium flex items-center gap-2"
            >
              <RefreshCw className="w-5 h-5" />
              Nova Importação
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
