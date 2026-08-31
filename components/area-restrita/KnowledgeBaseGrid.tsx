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
 blue: { bg: 'bg-surface-raised', border: 'border-border-subtle', iconBg: 'bg-surface-deep', text: 'text-brand-700', hover: 'hover:border-border-strong ' },
 purple: { bg: 'bg-surface-raised', border: 'border-border-subtle', iconBg: 'bg-surface-deep', text: 'text-ink-secondary', hover: 'hover:border-border-strong ' },
 green: { bg: 'bg-surface-raised', border: 'border-border-subtle', iconBg: 'bg-surface-deep', text: 'text-ink-secondary', hover: 'hover:border-border-strong ' },
 amber: { bg: 'bg-surface-raised', border: 'border-border-subtle', iconBg: 'bg-amber-accent-soft', text: 'text-amber-accent-deep', hover: 'hover:border-border-strong ' },
 teal: { bg: 'bg-surface-raised', border: 'border-border-subtle', iconBg: 'bg-surface-deep', text: 'text-ink-secondary', hover: 'hover:border-border-strong ' },
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
 <div className="bg-surface-page rounded-md border border-border-subtle p-8 text-center">
 <p className="text-ink-muted">Nenhum documento encontrado na base de conhecimento.</p>
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
 className={`${colors.bg} border-2 ${colors.border} ${colors.hover} rounded-md p-5 text-left transition-all cursor-pointer group`}
 >
 <div className={`inline-flex p-2.5 ${colors.iconBg} rounded-[3px] mb-3`}>
 <Icon className={`w-5 h-5 ${colors.text}`} />
 </div>
 <h3 className={`font-bold ${colors.text} text-sm mb-1`}>{cat.label}</h3>
 <p className="text-xs text-ink-muted">{cat.count} {cat.count === 1 ? 'documento' : 'documentos'}</p>
 </button>
 );
 })}
 </div>
 );
}
