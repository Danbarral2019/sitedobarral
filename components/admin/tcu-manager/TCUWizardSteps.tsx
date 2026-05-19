'use client';

import { CheckCircle, Sparkles } from 'lucide-react';
import type { Step } from '@/hooks/use-tcu-manager';

const STEPS: { id: Step; label: string }[] = [
  { id: 1, label: 'Upload' },
  { id: 2, label: 'Validação' },
  { id: 2.5, label: 'Revisão IA' },
  { id: 3, label: 'Importação' },
];

interface TCUWizardStepsProps {
  currentStep: Step;
}

export function TCUWizardSteps({ currentStep }: TCUWizardStepsProps) {
  return (
    <div className="mb-8 flex items-center justify-center overflow-x-auto">
      {STEPS.map((step, index) => (
        <div key={step.id} className="flex items-center flex-shrink-0">
          <div
            className={`flex items-center gap-2 px-3 py-2 rounded-lg ${
              currentStep === step.id
                ? 'bg-blue-100 text-blue-800 font-bold'
                : currentStep > step.id
                ? 'bg-green-100 text-green-800'
                : 'bg-gray-100 text-gray-600'
            }`}
          >
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-xs ${
                currentStep === step.id
                  ? 'bg-blue-600 text-white'
                  : currentStep > step.id
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-300 text-gray-600'
              }`}
            >
              {currentStep > step.id ? (
                <CheckCircle className="w-4 h-4" />
              ) : step.id === 2.5 ? (
                <Sparkles className="w-4 h-4" />
              ) : (
                Math.floor(step.id)
              )}
            </div>
            <span className="hidden sm:inline text-sm">{step.label}</span>
          </div>
          {index < STEPS.length - 1 && <div className="w-8 h-1 bg-gray-300 mx-1" />}
        </div>
      ))}
    </div>
  );
}
