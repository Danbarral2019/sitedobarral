'use client';

import { Scale } from 'lucide-react';
import type { LeiArticle } from '@/hooks/use-lei14133-preview';

interface CrossRefTopic {
  topic: string;
  articles: string[];
}

interface LeiCrossReferencesProps {
  selectedNumero: string;
  topics: CrossRefTopic[];
  allArticles: LeiArticle[];
  onSelectArticle: (article: LeiArticle) => void;
}

export function LeiCrossReferences({ selectedNumero, topics, allArticles, onSelectArticle }: LeiCrossReferencesProps) {
  if (topics.length === 0) return null;

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
        <Scale className="w-5 h-5 text-indigo-600" />
        Artigos Relacionados
      </h3>
      <div className="space-y-4">
        {topics.map((topic) => (
          <div key={topic.topic}>
            <span className="inline-block px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-sm font-medium mb-2">
              {topic.topic}
            </span>
            <div className="flex flex-wrap gap-2">
              {topic.articles
                .filter((a) => a !== selectedNumero)
                .map((artNum) => {
                  const art = allArticles.find((a) => a.numero === artNum);
                  if (!art) return null;
                  return (
                    <button
                      key={artNum}
                      onClick={() => onSelectArticle(art)}
                      className="px-2.5 py-1 bg-blue-50 text-blue-700 rounded text-xs font-medium hover:bg-blue-100 transition-colors"
                    >
                      Art. {artNum}
                    </button>
                  );
                })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
