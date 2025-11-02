'use client';

import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { ChevronDown, Pin, Eye } from 'lucide-react';
import { FAQFeedback } from './FAQFeedback';

interface FAQ {
  id: string;
  question: string;
  answer: string;
  category: string;
  isPinned: boolean;
  viewCount: number;
  helpfulCount: number;
  notHelpfulCount: number;
}

interface FAQAccordionProps {
  faqs: FAQ[];
}

export function FAQAccordion({ faqs }: FAQAccordionProps) {
  const [openId, setOpenId] = useState<string | null>(null);

  const toggleFAQ = async (id: string) => {
    const isOpening = openId !== id;
    setOpenId(isOpening ? id : null);

    // Registrar visualização ao abrir
    if (isOpening) {
      try {
        await fetch(`/api/faq/${id}/view`, { method: 'POST' });
      } catch (error) {
        console.error('Error tracking view:', error);
      }
    }
  };

  if (faqs.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        Nenhuma pergunta encontrada
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {faqs.map((faq) => (
        <div
          key={faq.id}
          className="border border-gray-200 rounded-lg bg-white shadow-sm hover:shadow-md transition-shadow"
        >
          <button
            onClick={() => toggleFAQ(faq.id)}
            className="w-full px-6 py-4 text-left flex justify-between items-start hover:bg-gray-50 transition-colors rounded-lg"
          >
            <div className="flex-1 pr-4">
              <div className="flex items-center gap-2 mb-1">
                {faq.isPinned && (
                  <Pin className="h-4 w-4 text-blue-600 flex-shrink-0" />
                )}
                <span className="font-semibold text-lg text-gray-900">
                  {faq.question}
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs text-gray-500 mt-2">
                <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded font-medium">
                  {faq.category}
                </span>
                <span className="flex items-center gap-1">
                  <Eye className="h-3 w-3" />
                  {faq.viewCount}
                </span>
              </div>
            </div>
            <ChevronDown
              className={`h-5 w-5 text-gray-400 flex-shrink-0 transition-transform ${
                openId === faq.id ? 'rotate-180' : ''
              }`}
            />
          </button>

          {openId === faq.id && (
            <div className="px-6 py-4 border-t bg-gray-50">
              <div className="prose prose-sm max-w-none text-gray-700">
                <ReactMarkdown>{faq.answer}</ReactMarkdown>
              </div>

              <FAQFeedback faqId={faq.id} />

              <div className="text-xs text-gray-500 mt-4 pt-3 border-t flex items-center gap-4">
                <span>
                  {faq.helpfulCount} {faq.helpfulCount === 1 ? 'pessoa achou' : 'pessoas acharam'} útil
                </span>
                <span>•</span>
                <span>
                  {faq.notHelpfulCount} {faq.notHelpfulCount === 1 ? 'pessoa não achou' : 'pessoas não acharam'} útil
                </span>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
