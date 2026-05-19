'use client';

import { Loader2, ArrowRight } from 'lucide-react';
import TCUReviewTable from '@/components/TCUReviewTable';
import type { ReviewDocument, ReviewEdit } from '@/hooks/use-tcu-manager';

const AVAILABLE_COURSES = [
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
];

interface TCUStepReviewProps {
  isClassifying: boolean;
  classificationProgress: { current: number; total: number };
  reviewDocuments: ReviewDocument[];
  onBack: () => void;
  onApprove: (rowIndex: number, editedData: ReviewEdit) => void;
  onSkip: (rowIndex: number) => void;
  onReprocess: (rowIndex: number) => Promise<void>;
  onProceedToImport: () => void;
}

export function TCUStepReview({
  isClassifying,
  classificationProgress,
  reviewDocuments,
  onBack,
  onApprove,
  onSkip,
  onReprocess,
  onProceedToImport,
}: TCUStepReviewProps) {
  const approvedCount = reviewDocuments.filter((d) => d.approved).length;

  return (
    <div className="space-y-6">
      {isClassifying && (
        <div className="bg-purple-50 border-l-4 border-purple-500 rounded-r-lg p-4">
          <div className="flex items-center gap-3">
            <Loader2 className="w-5 h-5 text-purple-600 animate-spin flex-shrink-0" />
            <div className="flex-1">
              <p className="font-bold text-purple-900">
                Classificando com IA... ({classificationProgress.current}/{classificationProgress.total})
              </p>
              <p className="text-sm text-purple-800">Analisando contexto e sugerindo cursos/tags</p>
            </div>
          </div>
        </div>
      )}

      {!isClassifying && reviewDocuments.length > 0 && (
        <>
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-6">Revisar e Editar Classificações</h2>
            <TCUReviewTable
              documents={reviewDocuments}
              availableCourses={AVAILABLE_COURSES}
              onApprove={onApprove}
              onSkip={onSkip}
              onReprocess={onReprocess}
            />
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6 flex gap-3">
            <button
              onClick={onBack}
              className="px-6 py-3 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors font-medium"
            >
              ← Voltar para Validação
            </button>

            <div className="flex-1 text-center py-3">
              <p className="text-sm text-gray-600">
                {approvedCount} de {reviewDocuments.length} documentos aprovados
              </p>
            </div>

            <button
              onClick={onProceedToImport}
              disabled={approvedCount === 0}
              className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2 font-medium"
            >
              Importar Aprovados
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </>
      )}
    </div>
  );
}
