'use client';

import Link from 'next/link';
import { Scale, FileText, BookOpen, List, Book, Landmark } from 'lucide-react';

const PARECER_CATEGORIES = ['parecer', 'parecer-vinculante', 'decor'];

const KNOWLEDGE_BASE_CATEGORIES: Array<{
  category: string;
  label: string;
  icon: typeof Scale;
  matchCategories?: readonly string[];
}> = [
  { category: 'acordao', label: 'Acórdãos TCU', icon: Scale },
  { category: 'pareceres', label: 'Pareceres', icon: FileText, matchCategories: PARECER_CATEGORIES },
  { category: 'orientacao-normativa', label: 'Orientações Normativas', icon: BookOpen },
  { category: 'enunciados', label: 'Enunciados', icon: List },
  { category: 'manual-tcu', label: 'Manual do TCU', icon: Book },
];

interface DocumentType {
  id: string;
  category: string;
}

interface KnowledgeBaseSectionProps {
  documents: DocumentType[];
  onSelectCategory: (category: string) => void;
  tribunalDecisionCount?: number;
}

export function KnowledgeBaseSection({ documents, onSelectCategory, tribunalDecisionCount }: KnowledgeBaseSectionProps) {
  const categoriesWithCounts = KNOWLEDGE_BASE_CATEGORIES.map((cat) => {
    const mc = cat.matchCategories;
    const count = mc
      ? documents.filter((d) => mc.includes(d.category)).length
      : documents.filter((d) => d.category === cat.category).length;
    return { ...cat, count };
  }).filter((cat) => cat.count > 0);

  if (categoriesWithCounts.length === 0 && !tribunalDecisionCount) return null;

  return (
    <div>
      <h3 className="font-serif text-brand-800 text-lg font-bold mb-3">Base de Conhecimento</h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {categoriesWithCounts.map((cat) => {
          const Icon = cat.icon;
          return (
            <button
              key={cat.category}
              onClick={() => onSelectCategory(cat.category)}
              className="bg-white border border-gray-200 rounded-xl p-4 text-left hover:border-brand-300 hover:shadow-sm transition-all"
            >
              <div className="w-9 h-9 bg-brand-100 rounded-full flex items-center justify-center mb-2">
                <Icon className="w-4 h-4 text-brand-600" />
              </div>
              <p className="text-sm font-semibold text-gray-800">{cat.label}</p>
              <p className="text-xs text-gray-500">{cat.count} {cat.count === 1 ? 'documento' : 'documentos'}</p>
            </button>
          );
        })}
        {tribunalDecisionCount != null && tribunalDecisionCount > 0 && (
          <Link
            href="/jurisprudencia"
            className="bg-white border border-gray-200 rounded-xl p-4 text-left hover:border-brand-300 hover:shadow-sm transition-all"
          >
            <div className="w-9 h-9 bg-brand-100 rounded-full flex items-center justify-center mb-2">
              <Landmark className="w-4 h-4 text-brand-600" />
            </div>
            <p className="text-sm font-semibold text-gray-800">TCEs Estaduais</p>
            <p className="text-xs text-gray-500">{tribunalDecisionCount} {tribunalDecisionCount === 1 ? 'decisão' : 'decisões'}</p>
          </Link>
        )}
      </div>
    </div>
  );
}
