'use client';

import Link from 'next/link';
import { FileText, Scale, Gavel, FileCheck, BookOpen } from 'lucide-react';

/**
 * Tipo de documento relacionado ao artigo
 */
interface RelatedDocument {
  id: string;
  title: string;
  isPublic: boolean;
  category: string | null;
}

/**
 * Props do componente
 */
interface ArticleContentSectionsProps {
  articleNum: string;
  documents: RelatedDocument[];
}

/**
 * Mapeamento de categorias para metadados visuais
 */
const CATEGORY_CONFIG = {
  'orientacao-normativa': {
    label: 'Orientação Normativa',
    labelShort: 'ON',
    icon: FileText,
    bgColor: 'bg-brand-50',
    borderColor: 'border-brand-200',
    textColor: 'text-brand-700',
    badgeBg: 'bg-brand-100',
    badgeText: 'text-brand-700',
    description: 'Orientações da AGU sobre aplicação da lei',
  },
  'decor': {
    label: 'Parecer DECOR',
    labelShort: 'DECOR',
    icon: FileCheck,
    bgColor: 'bg-emerald-50',
    borderColor: 'border-emerald-200',
    textColor: 'text-emerald-700',
    badgeBg: 'bg-emerald-100',
    badgeText: 'text-emerald-700',
    description: 'Pareceres do Departamento de Coordenação (AGU)',
  },
  'parecer-vinculante': {
    label: 'Parecer Vinculante',
    labelShort: 'Parecer',
    icon: Scale,
    bgColor: 'bg-brand-50',
    borderColor: 'border-brand-200',
    textColor: 'text-brand-700',
    badgeBg: 'bg-brand-100',
    badgeText: 'text-brand-700',
    description: 'Pareceres vinculantes da AGU',
  },
  'acordao': {
    label: 'Acórdão TCU',
    labelShort: 'TCU',
    icon: Gavel,
    bgColor: 'bg-amber-accent-soft',
    borderColor: 'border-amber-accent-soft',
    textColor: 'text-amber-accent-deep',
    badgeBg: 'bg-amber-accent-soft',
    badgeText: 'text-amber-accent-deep',
    description: 'Jurisprudência do Tribunal de Contas da União',
  },
  'default': {
    label: 'Outro Documento',
    labelShort: 'Doc',
    icon: BookOpen,
    bgColor: 'bg-surface-raised',
    borderColor: 'border-border-subtle',
    textColor: 'text-ink-secondary',
    badgeBg: 'bg-surface-deep',
    badgeText: 'text-ink-secondary',
    description: 'Outros documentos relacionados',
  },
} as const;

/**
 * Componente que agrupa e exibe documentos relacionados por categoria
 */
export function ArticleContentSections({ documents }: ArticleContentSectionsProps) {
  // Agrupar documentos por categoria
  const groupedDocuments = documents.reduce((acc, doc) => {
    const category = doc.category || 'default';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(doc);
    return acc;
  }, {} as Record<string, RelatedDocument[]>);

  // Ordenar categorias por prioridade
  const categoryOrder = ['orientacao-normativa', 'decor', 'parecer-vinculante', 'acordao', 'default'];
  const sortedCategories = Object.keys(groupedDocuments).sort((a, b) => {
    const indexA = categoryOrder.indexOf(a);
    const indexB = categoryOrder.indexOf(b);
    return (indexA === -1 ? 999 : indexA) - (indexB === -1 ? 999 : indexB);
  });

  if (documents.length === 0) {
    return (
      <div className="text-sm text-ink-muted italic p-4 bg-surface-raised rounded-[6px] border border-border-subtle">
        Nenhum documento indexado para este artigo ainda.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-bold text-ink-primary uppercase tracking-wide">
          Documentos Relacionados
        </h4>
        <span className="text-xs text-ink-muted font-medium px-2 py-1 bg-surface-deep rounded">
          {documents.length} {documents.length === 1 ? 'documento' : 'documentos'}
        </span>
      </div>

      {sortedCategories.map((categoryKey) => {
        const config = CATEGORY_CONFIG[categoryKey as keyof typeof CATEGORY_CONFIG] || CATEGORY_CONFIG.default;
        const Icon = config.icon;
        const categoryDocs = groupedDocuments[categoryKey];

        return (
          <div key={categoryKey} className={`rounded-[6px] border-2 ${config.borderColor} ${config.bgColor} overflow-hidden`}>
            {/* Header da Seção */}
            <div className={`px-4 py-3 ${config.borderColor} border-b-2 bg-white/50`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Icon className={`w-5 h-5 ${config.textColor}`} />
                  <h5 className={`font-bold text-sm ${config.textColor}`}>
                    {config.label}
                  </h5>
                  <span className={`text-xs px-2 py-0.5 ${config.badgeBg} ${config.badgeText} rounded-full font-medium`}>
                    {categoryDocs.length}
                  </span>
                </div>
              </div>
              <p className="text-xs text-ink-muted mt-1">
                {config.description}
              </p>
            </div>

            {/* Lista de Documentos */}
            <div className="divide-y divide-border-subtle">
              {categoryDocs.map((doc) => (
                <Link
                  key={doc.id}
                  href={`/documento/${doc.id}`}
                  className="block px-4 py-3 hover:bg-white/70 transition-colors group"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-ink-primary group-hover:text-brand-600 transition-colors line-clamp-2">
                        {doc.title}
                      </p>
                    </div>
                    {!doc.isPublic && (
                      <span className="flex-shrink-0 text-xs px-2 py-1 bg-amber-accent-soft text-ink-primary rounded font-medium">
                        Restrito
                      </span>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
