'use client';

import { useState } from 'react';
import { ThumbsUp, ThumbsDown } from 'lucide-react';

interface FAQFeedbackProps {
  faqId: string;
}

export function FAQFeedback({ faqId }: FAQFeedbackProps) {
  const [feedback, setFeedback] = useState<boolean | null>(null);
  const [showComment, setShowComment] = useState(false);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleFeedback = async (wasHelpful: boolean) => {
    setFeedback(wasHelpful);

    if (!wasHelpful) {
      setShowComment(true);
    } else {
      await submitFeedback(wasHelpful);
    }
  };

  const submitFeedback = async (wasHelpful: boolean, commentText?: string) => {
    setSubmitting(true);
    try {
      await fetch(`/api/faq/${faqId}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wasHelpful,
          comment: commentText || null,
        }),
      });
    } catch (error) {
      console.error('Error submitting feedback:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCommentSubmit = async () => {
    await submitFeedback(false, comment);
    setShowComment(false);
  };

  const handleSkip = async () => {
    await submitFeedback(false);
    setShowComment(false);
  };

  if (feedback !== null && !showComment) {
    return (
      <div className="text-green-600 text-sm font-medium mt-4 p-3 bg-green-50 rounded-md">
        ✓ Obrigado pelo feedback!
      </div>
    );
  }

  return (
    <div className="mt-4 border-t pt-4">
      {feedback === null && (
        <>
          <p className="text-sm text-gray-700 font-medium mb-3">
            Esta resposta foi útil?
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => handleFeedback(true)}
              disabled={submitting}
              className="flex items-center gap-2 px-4 py-2 bg-green-50 hover:bg-green-100 text-green-700 rounded-md transition-colors font-medium disabled:opacity-50"
            >
              <ThumbsUp className="h-4 w-4" />
              Sim, foi útil
            </button>
            <button
              onClick={() => handleFeedback(false)}
              disabled={submitting}
              className="flex items-center gap-2 px-4 py-2 bg-red-50 hover:bg-red-100 text-red-700 rounded-md transition-colors font-medium disabled:opacity-50"
            >
              <ThumbsDown className="h-4 w-4" />
              Não foi útil
            </button>
          </div>
        </>
      )}

      {showComment && (
        <div className="mt-4 bg-gray-50 p-4 rounded-lg">
          <p className="text-sm text-gray-700 font-medium mb-2">
            O que podemos melhorar nesta resposta?
          </p>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Seu comentário (opcional)"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            rows={3}
          />
          <div className="flex gap-2 mt-3">
            <button
              onClick={handleCommentSubmit}
              disabled={submitting}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium disabled:opacity-50"
            >
              {submitting ? 'Enviando...' : 'Enviar Feedback'}
            </button>
            <button
              onClick={handleSkip}
              disabled={submitting}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors text-sm font-medium disabled:opacity-50"
            >
              Pular
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
