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
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    textColor: 'text-blue-700',
    badgeBg: 'bg-blue-100',
    badgeText: 'text-blue-700',
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
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-200',
    textColor: 'text-purple-700',
    badgeBg: 'bg-purple-100',
    badgeText: 'text-purple-700',
    description: 'Pareceres vinculantes da AGU',
  },
  'acordao': {
    label: 'Acórdão TCU',
    labelShort: 'TCU',
    icon: Gavel,
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
    textColor: 'text-amber-700',
    badgeBg: 'bg-amber-100',
    badgeText: 'text-amber-700',
    description: 'Jurisprudência do Tribunal de Contas da União',
  },
  'default': {
    label: 'Outro Documento',
    labelShort: 'Doc',
    icon: BookOpen,
    bgColor: 'bg-gray-50',
    borderColor: 'border-gray-200',
    textColor: 'text-gray-700',
    badgeBg: 'bg-gray-100',
    badgeText: 'text-gray-700',
    description: 'Outros documentos relacionados',
  },
} as const;

/**
 * Componente que agrupa e exibe documentos relacionados por categoria
 */
export function ArticleContentSections({ articleNum, documents }: ArticleContentSectionsProps) {
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
      <div className="text-sm text-gray-500 italic p-4 bg-gray-50 rounded-lg border border-gray-200">
        Nenhum documento indexado para este artigo ainda.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wide">
          Documentos Relacionados
        </h4>
        <span className="text-xs text-gray-500 font-medium px-2 py-1 bg-gray-100 rounded">
          {documents.length} {documents.length === 1 ? 'documento' : 'documentos'}
        </span>
      </div>

      {sortedCategories.map((categoryKey) => {
        const config = CATEGORY_CONFIG[categoryKey as keyof typeof CATEGORY_CONFIG] || CATEGORY_CONFIG.default;
        const Icon = config.icon;
        const categoryDocs = groupedDocuments[categoryKey];

        return (
          <div key={categoryKey} className={`rounded-lg border-2 ${config.borderColor} ${config.bgColor} overflow-hidden`}>
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
              <p className="text-xs text-gray-600 mt-1">
                {config.description}
              </p>
            </div>

            {/* Lista de Documentos */}
            <div className="divide-y divide-gray-200">
              {categoryDocs.map((doc) => (
                <Link
                  key={doc.id}
                  href={`/documento/${doc.id}`}
                  className="block px-4 py-3 hover:bg-white/70 transition-colors group"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-900 group-hover:text-blue-600 transition-colors line-clamp-2">
                        {doc.title}
                      </p>
                    </div>
                    {!doc.isPublic && (
                      <span className="flex-shrink-0 text-xs px-2 py-1 bg-yellow-100 text-yellow-700 rounded font-medium">
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
