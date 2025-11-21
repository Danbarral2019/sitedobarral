'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { DocumentFormState } from './types';
import Step1BasicInfo from './Step1BasicInfo';
import Step2LeiArticles from './Step2LeiArticles';
import Step3EducationalContent from './Step3EducationalContent';
import Step4Finalization from './Step4Finalization';

interface DocumentWizardProps {
  documentId?: string; // Se presente, estamos editando; se ausente, criando novo
  initialData?: Partial<DocumentFormState>;
}

const INITIAL_FORM_STATE: DocumentFormState = {
  // Step 1
  title: '',
  description: '',
  category: 'apostila',
  courseId: '',
  isPublic: false,
  isCommon: false,
  url: '',
  type: 'pdf',
  selectedFile: null,
  entityType: '',
  enunciadoNumber: '',

  // Step 2
  leiArticles: [],
  tags: [],

  // Step 3
  summary: '',
  keyPoints: '',
  practicalUse: '',
  publicNotes: '',

  // Step 4
  importance: '',
  adminNotes: '',
  alternativeUrls: [],
};

export default function DocumentWizard({ documentId, initialData }: DocumentWizardProps) {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [formState, setFormState] = useState<DocumentFormState>(() => ({
    ...INITIAL_FORM_STATE,
    ...initialData,
  }));
  const [isSaving, setIsSaving] = useState(false);

  const updateForm = (updates: Partial<DocumentFormState>) => {
    setFormState((prev) => ({ ...prev, ...updates }));
  };

  const handleNext = () => {
    if (currentStep < 4) {
      setCurrentStep((prev) => prev + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => prev - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleSave = async () => {
    setIsSaving(true);

    try {
      // Determinar endpoint (criar ou atualizar)
      const endpoint = documentId
        ? `/api/admin/documents/${documentId}`
        : '/api/admin/documents';

      const method = documentId ? 'PUT' : 'POST';

      let requestBody: FormData | string;
      let requestHeaders: HeadersInit = {};

      // EDIÇÃO (PUT): Usar JSON (não suporta upload de arquivo na edição)
      if (documentId) {
        const payload = {
          // Step 1 - Basic Info
          title: formState.title,
          description: formState.description,
          category: formState.category,
          courseId: formState.courseId,
          isPublic: formState.isPublic,
          isCommon: formState.isCommon,
          type: formState.type,
          url: formState.url || '',
          entityType: formState.category === 'enunciados' ? formState.entityType : '',
          enunciadoNumber: formState.category === 'enunciados' ? formState.enunciadoNumber : '',

          // Step 2 - Lei Articles & Tags
          leiArticles: formState.leiArticles,
          tags: formState.tags,

          // Step 3 - Educational Content
          summary: formState.summary,
          keyPoints: formState.keyPoints,
          practicalUse: formState.practicalUse,
          publicNotes: formState.publicNotes,

          // Step 4 - Finalization
          importance: formState.importance || '',
          adminNotes: formState.adminNotes,
          alternativeUrls: formState.alternativeUrls,
        };

        requestBody = JSON.stringify(payload);
        requestHeaders = { 'Content-Type': 'application/json' };
      }
      // CRIAÇÃO (POST): Usar FormData (suporta upload de arquivo)
      else {
        const formData = new FormData();

        // Step 1 - Basic Info
        formData.append('title', formState.title);
        formData.append('description', formState.description);
        formData.append('category', formState.category);
        formData.append('courseId', formState.courseId);
        formData.append('isPublic', String(formState.isPublic));
        formData.append('isCommon', String(formState.isCommon));
        formData.append('type', formState.type);

        if (formState.selectedFile) {
          formData.append('file', formState.selectedFile);
        } else if (formState.url) {
          formData.append('url', formState.url);
        }

        if (formState.category === 'enunciados') {
          formData.append('entityType', formState.entityType || '');
          formData.append('enunciadoNumber', formState.enunciadoNumber || '');
        }

        // Step 2 - Lei Articles & Tags
        formData.append('leiArticles', JSON.stringify(formState.leiArticles));
        formData.append('tags', JSON.stringify(formState.tags));

        // Step 3 - Educational Content
        formData.append('summary', formState.summary);
        formData.append('keyPoints', formState.keyPoints);
        formData.append('practicalUse', formState.practicalUse);
        formData.append('publicNotes', formState.publicNotes);

        // Step 4 - Finalization
        if (formState.importance) {
          formData.append('importance', formState.importance);
        }
        formData.append('adminNotes', formState.adminNotes);
        formData.append('alternativeUrls', JSON.stringify(formState.alternativeUrls));

        requestBody = formData;
      }

      const response = await fetch(endpoint, {
        method,
        headers: requestHeaders,
        body: requestBody,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao salvar documento');
      }

      const data = await response.json();

      // Sucesso!
      alert(
        documentId
          ? 'Documento atualizado com sucesso!'
          : 'Documento criado com sucesso!'
      );

      // Redirecionar para lista de documentos
      router.push('/admin/documentos');
    } catch (error) {
      console.error('[DocumentWizard] Erro ao salvar:', error);
      alert(
        error instanceof Error
          ? `Erro: ${error.message}`
          : 'Erro ao salvar documento. Tente novamente.'
      );
    } finally {
      setIsSaving(false);
    }
  };

  // Progress Indicator
  const steps = [
    { number: 1, name: 'Básico', completed: currentStep > 1 },
    { number: 2, name: 'Lei 14.133', completed: currentStep > 2 },
    { number: 3, name: 'Conteúdo', completed: currentStep > 3 },
    { number: 4, name: 'Finalizar', completed: currentStep > 4 },
  ];

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            {steps.map((step, idx) => (
              <div key={step.number} className="flex items-center flex-1">
                <div className="flex flex-col items-center">
                  {/* Circle */}
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm transition-all ${
                      currentStep === step.number
                        ? 'bg-blue-600 text-white scale-110 shadow-lg'
                        : step.completed
                        ? 'bg-green-500 text-white'
                        : 'bg-gray-300 text-gray-600'
                    }`}
                  >
                    {step.completed ? '✓' : step.number}
                  </div>
                  {/* Label */}
                  <span
                    className={`text-xs mt-2 font-medium ${
                      currentStep === step.number
                        ? 'text-blue-600'
                        : step.completed
                        ? 'text-green-600'
                        : 'text-gray-500'
                    }`}
                  >
                    {step.name}
                  </span>
                </div>

                {/* Connector Line */}
                {idx < steps.length - 1 && (
                  <div
                    className={`flex-1 h-1 mx-2 transition-all ${
                      step.completed ? 'bg-green-500' : 'bg-gray-300'
                    }`}
                    style={{ marginBottom: '24px' }}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Wizard Card */}
        <div className="bg-white rounded-xl shadow-lg p-8">
          {/* Step 1 */}
          {currentStep === 1 && (
            <Step1BasicInfo
              formState={formState}
              updateForm={updateForm}
              onNext={handleNext}
              onPrevious={handlePrevious}
              isFirstStep={true}
              isLastStep={false}
            />
          )}

          {/* Step 2 */}
          {currentStep === 2 && (
            <Step2LeiArticles
              formState={formState}
              updateForm={updateForm}
              onNext={handleNext}
              onPrevious={handlePrevious}
              isFirstStep={false}
              isLastStep={false}
            />
          )}

          {/* Step 3 */}
          {currentStep === 3 && (
            <Step3EducationalContent
              formState={formState}
              updateForm={updateForm}
              onNext={handleNext}
              onPrevious={handlePrevious}
              isFirstStep={false}
              isLastStep={false}
            />
          )}

          {/* Step 4 */}
          {currentStep === 4 && (
            <Step4Finalization
              formState={formState}
              updateForm={updateForm}
              onNext={handleNext}
              onPrevious={handlePrevious}
              onSave={handleSave}
              isSaving={isSaving}
              documentId={documentId}
              isFirstStep={false}
              isLastStep={true}
            />
          )}
        </div>

        {/* Debug Info (apenas em desenvolvimento) */}
        {process.env.NODE_ENV === 'development' && (
          <div className="mt-6 p-4 bg-gray-100 rounded-lg text-xs font-mono">
            <details>
              <summary className="cursor-pointer font-semibold">
                🐛 Debug: Form State (clique para expandir)
              </summary>
              <pre className="mt-2 overflow-auto">{JSON.stringify(formState, null, 2)}</pre>
            </details>
          </div>
        )}
      </div>
    </div>
  );
}
