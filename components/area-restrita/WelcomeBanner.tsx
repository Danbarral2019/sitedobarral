'use client';

import { useState, useEffect } from 'react';
import { Sparkles, X } from 'lucide-react';

const STORAGE_KEY = 'barral-onboarding-dismissed';

export function WelcomeBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      const dismissed = localStorage.getItem(STORAGE_KEY);
      if (!dismissed) {
        setVisible(true);
      }
    } catch {
      // localStorage not available
    }
  }, []);

  const dismiss = () => {
    setVisible(false);
    try {
      localStorage.setItem(STORAGE_KEY, 'true');
    } catch {
      // localStorage not available
    }
  };

  if (!visible) return null;

  return (
    <div className="bg-brand-50 border border-brand-200 rounded-xl px-4 py-3 flex items-center gap-3">
      <Sparkles className="w-4 h-4 text-brand-600 flex-shrink-0" />
      <p className="text-sm text-brand-800 flex-1">
        Bem-vindo! Use a busca acima para encontrar qualquer conteúdo — documentos, artigos da Lei, pareceres e mais.
      </p>
      <button
        onClick={dismiss}
        className="p-1 text-brand-400 hover:text-brand-600 hover:bg-brand-100 rounded-lg transition-colors flex-shrink-0"
        aria-label="Fechar"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
