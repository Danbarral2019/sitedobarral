'use client';

import Link from 'next/link';
import { Scale, FileText, BookOpen, List, Book, Landmark } from 'lucide-react';

const PARECER_CATEGORIES = ['parecer', 'parecer-vinculante', 'decor', 'nota-tecnica', 'despacho'];

const KNOWLEDGE_BASE_CATEGORIES: Array<{
 category: string;
 label: string;
 icon: typeof Scale;
 matchCategories?: readonly string[];
}> = [
 { category: 'acordao', label: 'Acórdãos TCU', icon: Scale },
 { category: 'pareceres', label: 'Pareceres, Notas e Despachos', icon: FileText, matchCategories: PARECER_CATEGORIES },
 { category: 'orientacao-normativa', label: 'Orientações Normativas', icon: BookOpen },
 { category: 'enunciados', label: 'Enunciados', icon: List },
 { category: 'manual-tcu', label: 'Manual do TCU', icon: Book },
];

interface DocumentType {
 id: string;
 category: string;
 licitacoesContratos?: boolean | null;
}

interface KnowledgeBaseSectionProps {
 documents: DocumentType[];
 onSelectCategory: (category: string) => void;
 tribunalDecisionCount?: number;
}

const CONUNI_CATEGORIES = new Set(['parecer', 'parecer-vinculante', 'decor', 'nota-tecnica', 'despacho']);

export function KnowledgeBaseSection({ documents, onSelectCategory, tribunalDecisionCount }: KnowledgeBaseSectionProps) {
 // Pra categorias CONUNI: oculta docs marcados como irrelevantes pelo Gemini
 // (licitacoesContratos === false). Sem classificação ainda conta.
 const filteredDocs = documents.filter((d) => {
 if (!CONUNI_CATEGORIES.has(d.category)) return true;
 return d.licitacoesContratos !== false;
 });

 const categoriesWithCounts = KNOWLEDGE_BASE_CATEGORIES.map((cat) => {
 const mc = cat.matchCategories;
 const count = mc
 ? filteredDocs.filter((d) => mc.includes(d.category)).length
 : filteredDocs.filter((d) => d.category === cat.category).length;
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
 className="bg-surface-page border border-border-subtle rounded-md p-4 text-left hover:border-brand-300 hover:shadow-sm transition-all"
 >
 <div className="w-9 h-9 bg-brand-100 rounded-full flex items-center justify-center mb-2">
 <Icon className="w-4 h-4 text-brand-600" />
 </div>
 <p className="text-sm font-semibold text-ink-primary">{cat.label}</p>
 <p className="text-xs text-ink-muted">{cat.count} {cat.count === 1 ? 'documento' : 'documentos'}</p>
 </button>
 );
 })}
 {tribunalDecisionCount != null && tribunalDecisionCount > 0 && (
 <Link
 href="/jurisprudencia"
 className="bg-surface-page border border-border-subtle rounded-md p-4 text-left hover:border-brand-300 hover:shadow-sm transition-all"
 >
 <div className="w-9 h-9 bg-brand-100 rounded-full flex items-center justify-center mb-2">
 <Landmark className="w-4 h-4 text-brand-600" />
 </div>
 <p className="text-sm font-semibold text-ink-primary">TCEs Estaduais</p>
 <p className="text-xs text-ink-muted">{tribunalDecisionCount} {tribunalDecisionCount === 1 ? 'decisão' : 'decisões'}</p>
 </Link>
 )}
 </div>
 </div>
 );
}
