'use client';

import { useEffect, useState } from 'react';
import { ThumbsUp, ThumbsDown, X } from 'lucide-react';

const STORAGE_KEY = 'feedback-tip-shown-v1';

export default function FeedbackTipBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      if (!localStorage.getItem(STORAGE_KEY)) {
        setVisible(true);
      }
    } catch {
      setVisible(true);
    }
  }, []);

  function dismiss() {
    setVisible(false);
    try {
      localStorage.setItem(STORAGE_KEY, '1');
    } catch {
      // localStorage indisponível (modo privado, etc.) — apenas ignora
    }
  }

  if (!visible) return null;

  return (
    <div
      role="status"
      className="mb-4 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 shadow-sm"
    >
      <div className="flex-shrink-0 pt-0.5" aria-hidden="true">
        <span className="text-base">💡</span>
      </div>
      <div className="flex-1">
        <p className="font-medium">Avalie as respostas e ajude a melhorar a busca</p>
        <p className="mt-1 text-amber-800">
          Após cada resposta, você pode clicar em{' '}
          <ThumbsUp
            className="inline-block h-3.5 w-3.5 align-text-bottom"
            aria-label="curtir"
          />{' '}
          ou{' '}
          <ThumbsDown
            className="inline-block h-3.5 w-3.5 align-text-bottom"
            aria-label="descurtir"
          />{' '}
          para sinalizar se ela foi útil. Seu retorno é usado para calibrar a IA
          jurídica e priorizar correções.
        </p>
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Fechar dica"
        className="flex-shrink-0 rounded p-1 text-amber-700 transition-colors hover:bg-amber-100 hover:text-amber-900"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
