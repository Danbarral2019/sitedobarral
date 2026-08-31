'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, ThumbsUp, ThumbsDown } from 'lucide-react';
import MarkdownContent from '@/components/MarkdownContent';

interface FAQAccordionItemProps {
  id: string;
  question: string;
  answer: string;
}

export function FAQAccordionItem({ id, question, answer }: FAQAccordionItemProps) {
  const [open, setOpen] = useState(false);
  const [feedbackSent, setFeedbackSent] = useState<'helpful' | 'notHelpful' | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const sendFeedback = async (wasHelpful: boolean) => {
    if (submitting || feedbackSent) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/faq/${id}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wasHelpful }),
      });
      if (res.ok) setFeedbackSent(wasHelpful ? 'helpful' : 'notHelpful');
    } catch {
      // silently fail
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="border-2 border-border-subtle rounded-[6px] overflow-hidden bg-white">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full px-6 py-4 flex items-center justify-between gap-4 text-left hover:bg-surface-raised transition-colors"
      >
        <span className="font-semibold text-ink-primary">{question}</span>
        {open ? (
          <ChevronUp className="w-5 h-5 text-ink-muted flex-shrink-0" />
        ) : (
          <ChevronDown className="w-5 h-5 text-ink-muted flex-shrink-0" />
        )}
      </button>

      {open && (
        <div className="px-6 pb-6 border-t border-border-subtle">
          <div className="prose prose-sm max-w-none pt-4 text-ink-secondary">
            <MarkdownContent content={answer} />
          </div>

          <div className="mt-6 pt-4 border-t border-border-subtle flex items-center justify-between gap-3">
            {feedbackSent ? (
              <p className="text-sm text-ink-muted">
                {feedbackSent === 'helpful'
                  ? 'Obrigado pelo feedback! 👍'
                  : 'Obrigado pelo feedback. Vamos melhorar.'}
              </p>
            ) : (
              <>
                <span className="text-sm text-ink-muted">Esta resposta foi útil?</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => sendFeedback(true)}
                    disabled={submitting}
                    className="flex items-center gap-1 px-3 py-1.5 border-2 border-border-subtle rounded-[6px] text-sm font-medium hover:bg-green-50 hover:border-green-400 transition-colors disabled:opacity-50"
                  >
                    <ThumbsUp className="w-4 h-4" />
                    Sim
                  </button>
                  <button
                    onClick={() => sendFeedback(false)}
                    disabled={submitting}
                    className="flex items-center gap-1 px-3 py-1.5 border-2 border-border-subtle rounded-[6px] text-sm font-medium hover:bg-red-50 hover:border-red-400 transition-colors disabled:opacity-50"
                  >
                    <ThumbsDown className="w-4 h-4" />
                    Não
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
