'use client';

import { AlertCircle } from 'lucide-react';

interface TCUErrorBannerProps {
  message: string | null;
}

export function TCUErrorBanner({ message }: TCUErrorBannerProps) {
  if (!message) return null;
  return (
    <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 rounded-r-lg">
      <div className="flex gap-3">
        <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
        <div>
          <p className="font-bold text-red-900">Erro</p>
          <p className="text-sm text-red-800">{message}</p>
        </div>
      </div>
    </div>
  );
}
