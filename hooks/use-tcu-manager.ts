'use client';

import { useState } from 'react';
import {
  courseIdsToSlugs,
  buildValidationExcelData,
  VALIDATION_EXCEL_COLUMN_WIDTHS,
  mapValidationToImport,
} from '@/lib/admin/tcu-manager/helpers';

export type Step = 1 | 2 | 2.5 | 3;
export type SourceType = 'tcu' | 'custom' | null;

export interface ValidationResult {
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
    duplicateInfo?: { id: string; title: string; uploadedAt: string };
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

export interface EnrichmentResult {
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

export interface ClassificationResult {
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

export interface ReviewDocument {
  rowIndex: number;
  title: string;
  description: string;
  category: string;
  tcuData: NonNullable<ValidationResult['documents'][0]['tcuData']>;
  enrichment?: EnrichmentResult;
  classification?: ClassificationResult;
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

export interface ImportResult {
  total: number;
  imported: number;
  duplicates: number;
  failed: number;
  errors: string[];
  duplicateList: string[];
  importedList: string[];
}

export interface ReviewEdit {
  title: string;
  description: string;
  category: string;
  courses: string[];
  tags: string[];
  artigos: string[];
  url: string;
}

const BATCH_SIZE = 3;

export function useTcuManager() {
  const [currentStep, setCurrentStep] = useState<Step>(1);
  const [sourceType, setSourceType] = useState<SourceType>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const [isConverting, setIsConverting] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);

  const [reviewDocuments, setReviewDocuments] = useState<ReviewDocument[]>([]);
  const [isClassifying, setIsClassifying] = useState(false);
  const [classificationProgress, setClassificationProgress] = useState({ current: 0, total: 0 });

  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  const [error, setError] = useState<string | null>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setError(null);
    }
  };

  const validateDocuments = async (file: File, type: 'tcu' | 'custom') => {
    try {
      setIsValidating(true);
      setError(null);
      const formData = new FormData();
      formData.append('file', file);
      formData.append('sourceType', type);
      const response = await fetch('/api/admin/tcu-manager/validate', { method: 'POST', body: formData });
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

  const handleConvertTCU = async () => {
    if (!selectedFile) return;
    try {
      setIsConverting(true);
      setError(null);
      const formData = new FormData();
      formData.append('file', selectedFile);
      const response = await fetch('/api/admin/tcu-manager/convert', { method: 'POST', body: formData });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Erro ao converter');
      }
      await response.json();
      await validateDocuments(selectedFile, 'tcu');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setIsConverting(false);
    }
  };

  const handleUploadCustom = async () => {
    if (!selectedFile) return;
    await validateDocuments(selectedFile, 'custom');
  };

  const handleEnrichAndClassify = async (docs: ReviewDocument[]) => {
    if (docs.length === 0) return;
    try {
      setIsClassifying(true);
      setClassificationProgress({ current: 0, total: docs.length });
      let processedCount = 0;
      for (let i = 0; i < docs.length; i += BATCH_SIZE) {
        const batch = docs.slice(i, i + BATCH_SIZE);
        const response = await fetch('/api/admin/tcu-manager/classify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            documents: batch.map((doc) => ({
              tcuData: doc.tcuData,
              enrichment: doc.enrichment,
              rowIndex: doc.rowIndex,
            })),
          }),
        });
        if (!response.ok) continue;
        const classifyData = await response.json();
        setReviewDocuments((prev) => {
          const updated = [...prev];
          classifyData.results.forEach(
            (result: { rowIndex: number; classification: ClassificationResult }) => {
              const index = updated.findIndex((d) => d.rowIndex === result.rowIndex);
              if (index !== -1) updated[index].classification = result.classification;
            },
          );
          return updated;
        });
        processedCount += batch.length;
        setClassificationProgress({ current: processedCount, total: docs.length });
      }
    } catch {
      setError('Erro ao classificar documentos. Você pode editar manualmente.');
    } finally {
      setIsClassifying(false);
    }
  };

  const handleProceedToReview = async () => {
    if (!validationResult || sourceType !== 'tcu') {
      setCurrentStep(3);
      return;
    }
    const docsToReview: ReviewDocument[] = validationResult.documents
      .filter((doc) => doc.isValid && !doc.isDuplicate && doc.tcuData)
      .map((doc) => ({
        rowIndex: doc.rowIndex,
        title: doc.title,
        description: doc.description,
        category: doc.category,
        tcuData: doc.tcuData!,
      }));
    setReviewDocuments(docsToReview);
    setCurrentStep(2.5);
    await handleEnrichAndClassify(docsToReview);
  };

  const handleApproveDocument = (rowIndex: number, editedData: ReviewEdit) => {
    setReviewDocuments((prev) => {
      const updated = [...prev];
      const index = updated.findIndex((d) => d.rowIndex === rowIndex);
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
    setReviewDocuments((prev) => {
      const updated = [...prev];
      const index = updated.findIndex((d) => d.rowIndex === rowIndex);
      if (index !== -1) updated[index].skipped = true;
      return updated;
    });
  };

  const handleReprocessDocument = async (rowIndex: number) => {
    const doc = reviewDocuments.find((d) => d.rowIndex === rowIndex);
    if (!doc) return;
    await handleEnrichAndClassify([doc]);
  };

  const handleDownloadForEdit = async () => {
    if (!validationResult) return;
    try {
      const XLSX = await import('xlsx');
      const excelData = buildValidationExcelData(validationResult.documents);
      const ws = XLSX.utils.json_to_sheet(excelData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Validação');
      ws['!cols'] = [...VALIDATION_EXCEL_COLUMN_WIDTHS];
      XLSX.writeFile(wb, `tcu-validacao-${new Date().toISOString().split('T')[0]}.xlsx`);
    } catch {
      alert('Erro ao gerar arquivo para download');
    }
  };

  const handleImportFromReview = async () => {
    try {
      setIsImporting(true);
      setError(null);
      const documentsToImport = reviewDocuments
        .filter((doc) => doc.approved)
        .map((doc) => {
          const courseSlugs = courseIdsToSlugs(doc.editedCourses || []);
          return {
            title: doc.editedTitle || doc.title,
            description: doc.editedDescription || doc.description,
            category: doc.editedCategory || doc.category,
            course: courseSlugs,
            tags: (doc.editedTags || []).join(','),
            leiArticles: (doc.editedArtigos || []).join(','),
            publico: 'SIM',
            url: doc.editedUrl || doc.enrichment?.linkPDF || '#',
            arquivo: '',
            isDuplicate: false,
            tcuData: doc.tcuData,
            enrichment: doc.enrichment,
            classification: doc.classification,
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

  const handleImport = async () => {
    if (reviewDocuments.length > 0) return handleImportFromReview();
    if (!validationResult) return;
    try {
      setIsImporting(true);
      setError(null);
      const documentsToImport = mapValidationToImport(validationResult.documents);
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

  const handleProceedToImport = async () => {
    const approvedDocs = reviewDocuments.filter((d) => d.approved);
    if (approvedDocs.length === 0) {
      setError('Nenhum documento foi aprovado para importação');
      return;
    }
    await handleImportFromReview();
  };

  const handleReset = () => {
    setCurrentStep(1);
    setSourceType(null);
    setSelectedFile(null);
    setValidationResult(null);
    setImportResult(null);
    setError(null);
  };

  const goToStep = (step: Step) => setCurrentStep(step);
  const goBackToUpload = () => {
    setSourceType(null);
    setSelectedFile(null);
  };

  return {
    // Step
    currentStep,
    goToStep,
    handleReset,
    // Source
    sourceType,
    setSourceType,
    goBackToUpload,
    // File
    selectedFile,
    handleFileSelect,
    // Step 1
    isConverting,
    handleConvertTCU,
    handleUploadCustom,
    // Step 2
    isValidating,
    validationResult,
    handleProceedToReview,
    handleDownloadForEdit,
    // Step 2.5
    reviewDocuments,
    isClassifying,
    classificationProgress,
    handleApproveDocument,
    handleSkipDocument,
    handleReprocessDocument,
    handleProceedToImport,
    // Step 3
    isImporting,
    importResult,
    handleImport,
    // Error
    error,
  };
}
