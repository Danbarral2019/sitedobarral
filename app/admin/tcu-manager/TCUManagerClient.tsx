'use client';

import { FileSpreadsheet, ArrowRight, Star } from 'lucide-react';
import Link from 'next/link';
import { useTcuManager } from '@/hooks/use-tcu-manager';
import { TCUWizardSteps } from '@/components/admin/tcu-manager/TCUWizardSteps';
import { TCUErrorBanner } from '@/components/admin/tcu-manager/TCUErrorBanner';
import { TCUStepUpload } from '@/components/admin/tcu-manager/TCUStepUpload';
import { TCUStepValidation } from '@/components/admin/tcu-manager/TCUStepValidation';
import { TCUStepReview } from '@/components/admin/tcu-manager/TCUStepReview';
import { TCUStepImportResult } from '@/components/admin/tcu-manager/TCUStepImportResult';

export default function TCUManagerClient() {
  const tcu = useTcuManager();

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
          <FileSpreadsheet className="w-8 h-8 text-blue-600" />
          Gerenciador de Acórdãos TCU
        </h1>
        <p className="text-gray-600 mt-2">
          Importe, converta e gerencie acórdãos com detecção automática de duplicatas
        </p>
      </div>

      <Link
        href="/admin/tcu-highlights"
        className="mb-6 flex items-center gap-3 p-4 bg-purple-50 border border-purple-200 rounded-lg hover:bg-purple-100 transition-colors"
      >
        <Star className="w-5 h-5 text-purple-600 flex-shrink-0" />
        <div className="flex-1">
          <span className="font-semibold text-purple-900">Destaques TCU</span>
          <span className="text-sm text-purple-600 ml-2">
            Acórdãos com potencial editorial identificados pela IA
          </span>
        </div>
        <ArrowRight className="w-4 h-4 text-purple-400" />
      </Link>

      <TCUWizardSteps currentStep={tcu.currentStep} />

      <TCUErrorBanner message={tcu.error} />

      {tcu.currentStep === 1 && (
        <TCUStepUpload
          sourceType={tcu.sourceType}
          onSourceTypeChange={tcu.setSourceType}
          selectedFile={tcu.selectedFile}
          onFileSelect={tcu.handleFileSelect}
          isConverting={tcu.isConverting}
          isValidating={tcu.isValidating}
          onConvertTCU={tcu.handleConvertTCU}
          onUploadCustom={tcu.handleUploadCustom}
          onBack={tcu.goBackToUpload}
        />
      )}

      {tcu.currentStep === 2 && tcu.validationResult && (
        <TCUStepValidation
          validationResult={tcu.validationResult}
          sourceType={tcu.sourceType}
          isImporting={tcu.isImporting}
          onBack={() => tcu.goToStep(1)}
          onDownloadForEdit={tcu.handleDownloadForEdit}
          onProceedToReview={tcu.handleProceedToReview}
          onImport={tcu.handleImport}
        />
      )}

      {tcu.currentStep === 2.5 && (
        <TCUStepReview
          isClassifying={tcu.isClassifying}
          classificationProgress={tcu.classificationProgress}
          reviewDocuments={tcu.reviewDocuments}
          onBack={() => tcu.goToStep(2)}
          onApprove={tcu.handleApproveDocument}
          onSkip={tcu.handleSkipDocument}
          onReprocess={tcu.handleReprocessDocument}
          onProceedToImport={tcu.handleProceedToImport}
        />
      )}

      {tcu.currentStep === 3 && tcu.importResult && (
        <TCUStepImportResult result={tcu.importResult} onReset={tcu.handleReset} />
      )}
    </div>
  );
}
