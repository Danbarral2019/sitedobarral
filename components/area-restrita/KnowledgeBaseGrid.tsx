/** @deprecated Replaced by KnowledgeBaseSection (2026-02-18) */
'use client';

import { Scale, FileText, BookOpen, List, Book } from 'lucide-react';

// Categorias que devem ser agrupadas sob "Pareceres"
const PARECER_CATEGORIES = ['parecer', 'parecer-vinculante', 'decor'];

// Configuração das categorias para o grid da Base de Conhecimento
const KNOWLEDGE_BASE_CATEGORIES: Array<{
  category: string;
  label: string;
  icon: typeof Scale;
  color: string;
  matchCategories?: readonly string[];
}> = [
  { category: 'acordao', label: 'Acórdãos TCU', icon: Scale, color: 'blue' },
  { category: 'pareceres', label: 'Pareceres', icon: FileText, color: 'purple', matchCategories: PARECER_CATEGORIES },
  { category: 'orientacao-normativa', label: 'Orientações Normativas', icon: BookOpen, color: 'green' },
  { category: 'enunciados', label: 'Enunciados', icon: List, color: 'amber' },
  { category: 'manual-tcu', label: 'Manual do TCU', icon: Book, color: 'teal' },
];

const CATEGORY_COLORS: Record<string, { bg: string; border: string; iconBg: string; text: string; hover: string }> = {
  blue: { bg: 'bg-blue-50', border: 'border-blue-200', iconBg: 'bg-blue-100', text: 'text-blue-700', hover: 'hover:border-blue-400 hover:shadow-md' },
  purple: { bg: 'bg-purple-50', border: 'border-purple-200', iconBg: 'bg-purple-100', text: 'text-purple-700', hover: 'hover:border-purple-400 hover:shadow-md' },
  green: { bg: 'bg-green-50', border: 'border-green-200', iconBg: 'bg-green-100', text: 'text-green-700', hover: 'hover:border-green-400 hover:shadow-md' },
  amber: { bg: 'bg-amber-50', border: 'border-amber-200', iconBg: 'bg-amber-100', text: 'text-amber-700', hover: 'hover:border-amber-400 hover:shadow-md' },
  teal: { bg: 'bg-teal-50', border: 'border-teal-200', iconBg: 'bg-teal-100', text: 'text-teal-700', hover: 'hover:border-teal-400 hover:shadow-md' },
};

interface DocumentType {
  id: string;
  category: string;
}

interface KnowledgeBaseGridProps {
  documents: DocumentType[];
  onSelectCategory: (category: string) => void;
}

export function KnowledgeBaseGrid({ documents, onSelectCategory }: KnowledgeBaseGridProps) {
  const categoriesWithCounts = KNOWLEDGE_BASE_CATEGORIES.map((cat) => {
    const mc = cat.matchCategories;
    const count = mc
      ? documents.filter((d) => mc.includes(d.category)).length
      : documents.filter((d) => d.category === cat.category).length;
    return { ...cat, count };
  }).filter((cat) => cat.count > 0);

  if (categoriesWithCounts.length === 0) {
    return (
      <div className="bg-white rounded-2xl border-2 border-gray-200 p-8 text-center">
        <p className="text-gray-500">Nenhum documento encontrado na base de conhecimento.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {categoriesWithCounts.map((cat) => {
        const colors = CATEGORY_COLORS[cat.color] || CATEGORY_COLORS.blue;
        const Icon = cat.icon;
        return (
          <button
            key={cat.category}
            onClick={() => onSelectCategory(cat.category)}
            className={`${colors.bg} border-2 ${colors.border} ${colors.hover} rounded-xl p-5 text-left transition-all cursor-pointer group`}
          >
            <div className={`inline-flex p-2.5 ${colors.iconBg} rounded-lg mb-3`}>
              <Icon className={`w-5 h-5 ${colors.text}`} />
            </div>
            <h3 className={`font-bold ${colors.text} text-sm mb-1`}>{cat.label}</h3>
            <p className="text-xs text-gray-500">{cat.count} {cat.count === 1 ? 'documento' : 'documentos'}</p>
          </button>
        );
      })}
    </div>
  );
}
