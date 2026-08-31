'use client';

import { useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  FileText,
  Video,
  Heart,
  Scale,
  FileEdit,
  ClipboardList,
  ScrollText,
  BookOpen,
  Link2,
  Tv,
  FileCheck,
  Gavel,
  Landmark,
  File,
  MessageSquare,
  Newspaper,
} from 'lucide-react';
import { ArticleBadges } from './ArticleBadges';

interface Document {
  id: string;
  title: string;
  description?: string;
  category: string;
  type: string;
  url?: string;
  leiArticles?: string | null;
  entityType?: string;
}

interface DocumentsByCategoryProps {
  documents: Document[];
  courseId: string;
  onDocumentClick: (doc: Document) => void;
  isFavorite: (docId: string) => boolean;
  toggleFavorite: (docId: string, courseId: string) => void;
}

// Categorias que devem ser agrupadas sob "Pareceres"
const PARECER_CATEGORIES = ['parecer', 'parecer-vinculante', 'decor'];

// Labels de subtipo para badges de pareceres
const PARECER_SUBTYPE_LABELS: Record<string, string | null> = {
  'parecer': null,
  'parecer-vinculante': 'Vinculante',
  'decor': 'DECOR',
};

// Labels de órgãos para sub-agrupamento de enunciados
const ENTITY_TYPE_LABELS: Record<string, string> = {
  'INCP': 'INCP - Instituto Nacional de Contratações Públicas',
  'IBDA': 'IBDA - Instituto Brasileiro de Direito Administrativo',
  'CJF': 'CJF - Conselho da Justiça Federal',
  'FONACON': 'FONACON - Fórum Nacional de Contas',
  'PGE-SP': 'PGE-SP - Procuradoria Geral do Estado de São Paulo',
  'AGE-MG': 'AGE-MG - Advocacia-Geral do Estado de Minas Gerais',
};

// Mapeamento de categorias para ícones Lucide, cores e labels
const categoryConfig: Record<string, {
  icon: typeof Scale;
  color: string;
  label: string;
  gradient: string;
  iconBg: string;
  iconText: string;
  badgeBg: string;
  badgeText: string;
  docIconBg: string;
}> = {
  'acordao': {
    icon: Scale,
    color: 'blue',
    label: 'Acordãos',
    gradient: 'from-brand-500/10 via-brand-400/5 to-transparent',
    iconBg: 'bg-brand-100',
    iconText: 'text-brand-600',
    badgeBg: 'bg-brand-100',
    badgeText: 'text-brand-700',
    docIconBg: 'bg-brand-600',
  },
  'pareceres': {
    icon: FileEdit,
    color: 'green',
    label: 'Pareceres',
    gradient: 'from-green-500/10 via-green-400/5 to-transparent',
    iconBg: 'bg-green-100',
    iconText: 'text-green-600',
    badgeBg: 'bg-green-100',
    badgeText: 'text-green-700',
    docIconBg: 'bg-green-600',
  },
  'orientacao-normativa': {
    icon: ClipboardList,
    color: 'indigo',
    label: 'Orientações Normativas',
    gradient: 'from-brand-500/10 via-brand-400/5 to-transparent',
    iconBg: 'bg-brand-100',
    iconText: 'text-brand-600',
    badgeBg: 'bg-brand-100',
    badgeText: 'text-brand-700',
    docIconBg: 'bg-brand-600',
  },
  'instrucao-normativa': {
    icon: FileCheck,
    color: 'indigo',
    label: 'Instruções Normativas',
    gradient: 'from-brand-500/10 via-brand-400/5 to-transparent',
    iconBg: 'bg-brand-100',
    iconText: 'text-brand-600',
    badgeBg: 'bg-brand-100',
    badgeText: 'text-brand-700',
    docIconBg: 'bg-brand-600',
  },
  'portaria': {
    icon: ScrollText,
    color: 'emerald',
    label: 'Portarias',
    gradient: 'from-emerald-500/10 via-emerald-400/5 to-transparent',
    iconBg: 'bg-emerald-100',
    iconText: 'text-emerald-600',
    badgeBg: 'bg-emerald-100',
    badgeText: 'text-emerald-700',
    docIconBg: 'bg-emerald-600',
  },
  'decreto': {
    icon: Landmark,
    color: 'blue',
    label: 'Decretos',
    gradient: 'from-brand-500/10 via-brand-400/5 to-transparent',
    iconBg: 'bg-brand-100',
    iconText: 'text-brand-600',
    badgeBg: 'bg-brand-100',
    badgeText: 'text-brand-700',
    docIconBg: 'bg-brand-600',
  },
  'lei': {
    icon: Gavel,
    color: 'purple',
    label: 'Leis',
    gradient: 'from-brand-500/10 via-brand-400/5 to-transparent',
    iconBg: 'bg-brand-100',
    iconText: 'text-brand-600',
    badgeBg: 'bg-brand-100',
    badgeText: 'text-brand-700',
    docIconBg: 'bg-brand-600',
  },
  'resolucao': {
    icon: ScrollText,
    color: 'cyan',
    label: 'Resoluções',
    gradient: 'from-brand-500/10 via-brand-400/5 to-transparent',
    iconBg: 'bg-brand-100',
    iconText: 'text-brand-600',
    badgeBg: 'bg-brand-100',
    badgeText: 'text-brand-700',
    docIconBg: 'bg-brand-600',
  },
  'artigo': {
    icon: BookOpen,
    color: 'purple',
    label: 'Artigos',
    gradient: 'from-brand-500/10 via-brand-400/5 to-transparent',
    iconBg: 'bg-brand-100',
    iconText: 'text-brand-600',
    badgeBg: 'bg-brand-100',
    badgeText: 'text-brand-700',
    docIconBg: 'bg-brand-600',
  },
  'edital': {
    icon: FileText,
    color: 'orange',
    label: 'Editais',
    gradient: 'from-amber-accent/10 via-amber-accent/5 to-transparent',
    iconBg: 'bg-amber-accent-soft',
    iconText: 'text-amber-accent-deep',
    badgeBg: 'bg-amber-accent-soft',
    badgeText: 'text-amber-accent-deep',
    docIconBg: 'bg-amber-accent',
  },
  'apostila': {
    icon: BookOpen,
    color: 'indigo',
    label: 'Apostilas',
    gradient: 'from-brand-500/10 via-brand-400/5 to-transparent',
    iconBg: 'bg-brand-100',
    iconText: 'text-brand-600',
    badgeBg: 'bg-brand-100',
    badgeText: 'text-brand-700',
    docIconBg: 'bg-brand-600',
  },
  'link': {
    icon: Link2,
    color: 'cyan',
    label: 'Links',
    gradient: 'from-brand-500/10 via-brand-400/5 to-transparent',
    iconBg: 'bg-brand-100',
    iconText: 'text-brand-600',
    badgeBg: 'bg-brand-100',
    badgeText: 'text-brand-700',
    docIconBg: 'bg-brand-600',
  },
  'video': {
    icon: Tv,
    color: 'red',
    label: 'Vídeos',
    gradient: 'from-red-500/10 via-red-400/5 to-transparent',
    iconBg: 'bg-red-100',
    iconText: 'text-red-600',
    badgeBg: 'bg-red-100',
    badgeText: 'text-red-700',
    docIconBg: 'bg-red-600',
  },
  'enunciados': {
    icon: ClipboardList,
    color: 'purple',
    label: 'Enunciados',
    gradient: 'from-brand-500/10 via-brand-400/5 to-transparent',
    iconBg: 'bg-brand-100',
    iconText: 'text-brand-600',
    badgeBg: 'bg-brand-100',
    badgeText: 'text-brand-700',
    docIconBg: 'bg-brand-600',
  },
  'sumula': {
    icon: Scale,
    color: 'indigo',
    label: 'Súmulas TCU',
    gradient: 'from-brand-500/10 via-brand-400/5 to-transparent',
    iconBg: 'bg-brand-100',
    iconText: 'text-brand-600',
    badgeBg: 'bg-brand-100',
    badgeText: 'text-brand-700',
    docIconBg: 'bg-brand-600',
  },
  'consulta_tcu': {
    icon: MessageSquare,
    color: 'sky',
    label: 'Respostas a Consultas TCU',
    gradient: 'from-brand-500/10 via-brand-400/5 to-transparent',
    iconBg: 'bg-brand-100',
    iconText: 'text-brand-600',
    badgeBg: 'bg-brand-100',
    badgeText: 'text-brand-700',
    docIconBg: 'bg-brand-600',
  },
  'informativo': {
    icon: Newspaper,
    color: 'orange',
    label: 'Informativos de Licitação TCU',
    gradient: 'from-amber-accent/10 via-amber-accent/5 to-transparent',
    iconBg: 'bg-amber-accent-soft',
    iconText: 'text-amber-accent-deep',
    badgeBg: 'bg-amber-accent-soft',
    badgeText: 'text-amber-accent-deep',
    docIconBg: 'bg-amber-accent',
  },
  'outros': {
    icon: File,
    color: 'gray',
    label: 'Outros',
    gradient: 'from-brand-800/10 via-brand-800/5 to-transparent',
    iconBg: 'bg-surface-deep',
    iconText: 'text-ink-muted',
    badgeBg: 'bg-surface-deep',
    badgeText: 'text-ink-secondary',
    docIconBg: 'bg-brand-800',
  },
  'outro': {
    icon: File,
    color: 'gray',
    label: 'Outros',
    gradient: 'from-brand-800/10 via-brand-800/5 to-transparent',
    iconBg: 'bg-surface-deep',
    iconText: 'text-ink-muted',
    badgeBg: 'bg-surface-deep',
    badgeText: 'text-ink-secondary',
    docIconBg: 'bg-brand-800',
  },
};

const defaultConfig = categoryConfig['outro'];

export default function DocumentsByCategory({
  documents,
  courseId,
  onDocumentClick,
  isFavorite,
  toggleFavorite,
}: DocumentsByCategoryProps) {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  // Agrupar documentos por categoria (excluindo materiais destacados)
  const documentsByCategory = documents.reduce((acc, doc) => {
    if (['apostila', 'conteudo-programatico', 'bibliografia'].includes(doc.category)) {
      return acc;
    }

    const displayCategory = PARECER_CATEGORIES.includes(doc.category)
      ? 'pareceres'
      : doc.category;

    if (!acc[displayCategory]) {
      acc[displayCategory] = [];
    }
    acc[displayCategory].push(doc);
    return acc;
  }, {} as Record<string, Document[]>);

  const sortedCategories = Object.keys(documentsByCategory).sort();

  const toggleCategory = (category: string) => {
    setExpandedCategories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(category)) {
        newSet.delete(category);
      } else {
        newSet.add(category);
      }
      return newSet;
    });
  };

  const truncateDescription = (text: string, maxLength: number = 100): string => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength).trim() + '...';
  };

  if (sortedCategories.length === 0) {
    return (
      <div className="bg-brand-50 border-2 border-brand-200 rounded-[6px] p-6 lg:p-6 text-center">
        <p className="text-base lg:text-lg text-brand-800 font-medium">
          Não há outros documentos disponíveis para este curso no momento.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 lg:space-y-5">
      {/* Header */}
      <div className="mb-2">
        <h2 className="text-lg lg:text-2xl font-bold text-ink-primary">Materiais por Categoria</h2>
        <p className="text-sm text-ink-muted mt-1">Clique em um documento para ver detalhes completos</p>
      </div>

      {/* Cards por categoria */}
      {sortedCategories.map((category) => {
        const categoryDocs = documentsByCategory[category];
        const isExpanded = expandedCategories.has(category);
        const config = categoryConfig[category] || defaultConfig;
        const IconComponent = config.icon;

        return (
          <div
            key={category}
            className="bg-white rounded-[6px] border border-border-subtle overflow-hidden transition-shadow hover:"
          >
            {/* Header da categoria com gradiente */}
            <button
              onClick={() => toggleCategory(category)}
              className={`w-full flex items-center justify-between p-4 lg:p-5 ${config.gradient} hover:opacity-90 transition-opacity`}
            >
              <div className="flex items-center gap-3 lg:gap-4">
                <div className={`w-10 h-10 lg:w-11 lg:h-11 ${config.iconBg} ${config.iconText} rounded-[6px] flex items-center justify-center`}>
                  <IconComponent className="w-5 h-5 lg:w-6 lg:h-6" />
                </div>
                <div className="text-left">
                  <h3 className="text-base lg:text-lg font-bold text-ink-primary">{config.label}</h3>
                </div>
                <span className={`${config.badgeBg} ${config.badgeText} px-2.5 py-0.5 rounded-full text-xs font-bold`}>
                  {categoryDocs.length}
                </span>
              </div>
              <div className="text-ink-muted">
                {isExpanded ? (
                  <ChevronUp className="w-5 h-5" />
                ) : (
                  <ChevronDown className="w-5 h-5" />
                )}
              </div>
            </button>

            {/* Lista de documentos como mini-cards */}
            <div className="p-3 lg:p-4 space-y-3">
              {/* Aviso de documentos ostensivos para categorias AGU */}
              {['pareceres', 'orientacao-normativa', 'enunciados'].includes(category) && (
                <div className="bg-brand-50 border border-brand-200 rounded-[6px] px-4 py-3 text-xs text-brand-800 leading-relaxed">
                  <p>
                    <strong>Nota de transparência:</strong> Todos os documentos aqui reunidos são atos administrativos
                    de caráter ostensivo, publicados em portais oficiais de acesso público na internet
                    (AGU, TCU, DOU, CJF, entre outros), em conformidade com o princípio da publicidade (art. 37, CF)
                    e com a Lei de Acesso à Informação (Lei nº 12.527/2011). A contribuição do Prof. Daniel Barral
                    limita-se à seleção, organização temática e classificação por artigo da Lei nº 14.133/2021,
                    para fins exclusivamente didáticos.
                  </p>
                </div>
              )}

              {category === 'enunciados' ? (
                // Sub-agrupamento por entityType para enunciados
                (() => {
                  const groupedByEntity: Record<string, Document[]> = {};
                  categoryDocs.forEach((doc) => {
                    const key = doc.entityType || '_outros';
                    if (!groupedByEntity[key]) groupedByEntity[key] = [];
                    groupedByEntity[key].push(doc);
                  });
                  const entityKeys = Object.keys(groupedByEntity).sort((a, b) => {
                    if (a === '_outros') return 1;
                    if (b === '_outros') return -1;
                    return a.localeCompare(b);
                  });

                  return entityKeys.map((entityKey) => {
                    const entityDocs = groupedByEntity[entityKey];
                    const entityLabel = entityKey === '_outros'
                      ? 'Outros'
                      : ENTITY_TYPE_LABELS[entityKey] || entityKey;
                    const entityExpandKey = `${category}-${entityKey}`;
                    const isEntityExpanded = expandedCategories.has(entityExpandKey);

                    return (
                      <div key={entityKey} className="space-y-2">
                        <button
                          onClick={() => toggleCategory(entityExpandKey)}
                          className="w-full flex items-center justify-between px-3 py-2 bg-brand-50 rounded-[6px] hover:bg-brand-100 transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-semibold text-brand-800">{entityLabel}</h4>
                            <span className="bg-brand-200 text-brand-700 px-2 py-0.5 rounded-[3px] text-xs font-bold">
                              {entityDocs.length}
                            </span>
                          </div>
                          <div className="text-brand-400">
                            {isEntityExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </div>
                        </button>

                        {(isEntityExpanded ? entityDocs : entityDocs.slice(0, 2)).map((doc) => (
                          <div
                            key={doc.id}
                            className="bg-surface-raised hover:bg-white rounded-[6px] p-3 lg:p-4 border border-border-subtle hover:border-brand-200 hover: transition-all"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div
                                className="flex-1 min-w-0 cursor-pointer group"
                                onClick={() => onDocumentClick(doc)}
                                role="button"
                                tabIndex={0}
                                onKeyDown={(e) => { if (e.key === 'Enter') onDocumentClick(doc); }}
                              >
                                <div className="flex items-start gap-2.5 lg:gap-3 w-full">
                                  <div className={`w-8 h-8 ${config.docIconBg} rounded-[6px] flex items-center justify-center flex-shrink-0 mt-0.5`}>
                                    <FileText className="w-4 h-4 text-white" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <h4 className="text-sm lg:text-base font-semibold text-ink-primary group-hover:text-brand-600 transition-colors line-clamp-2">
                                      {doc.title}
                                    </h4>
                                    {doc.description && (
                                      <p className="text-xs lg:text-sm text-ink-muted mt-1 line-clamp-2">
                                        {truncateDescription(doc.description)}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleFavorite(doc.id, courseId);
                                }}
                                className={`p-2 rounded-[6px] transition-colors flex-shrink-0 min-h-[40px] min-w-[40px] lg:min-h-0 lg:min-w-0 flex items-center justify-center ${
                                  isFavorite(doc.id)
                                    ? 'text-red-600 bg-red-100 hover:bg-red-200'
                                    : 'text-ink-muted hover:text-red-600 hover:bg-red-50'
                                }`}
                                title={isFavorite(doc.id) ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
                              >
                                <Heart className={`w-4 h-4 lg:w-5 lg:h-5 ${isFavorite(doc.id) ? 'fill-current' : ''}`} />
                              </button>
                            </div>
                          </div>
                        ))}

                        {!isEntityExpanded && entityDocs.length > 2 && (
                          <button
                            onClick={() => toggleCategory(entityExpandKey)}
                            className="w-full py-2 border-2 border-dashed border-border-subtle hover:border-brand-300 rounded-[6px] text-xs font-medium text-ink-muted hover:text-brand-600 hover:bg-brand-50/50 flex items-center justify-center gap-2 transition-all"
                          >
                            <span>Ver mais {entityDocs.length - 2} {entityDocs.length - 2 === 1 ? 'enunciado' : 'enunciados'}</span>
                            <ChevronDown className="w-3 h-3" />
                          </button>
                        )}

                        {isEntityExpanded && entityDocs.length > 2 && (
                          <button
                            onClick={() => toggleCategory(entityExpandKey)}
                            className="w-full py-1.5 text-xs font-medium text-ink-muted hover:text-ink-secondary flex items-center justify-center gap-1 transition-colors"
                          >
                            <ChevronUp className="w-3 h-3" />
                            <span>Mostrar menos</span>
                          </button>
                        )}
                      </div>
                    );
                  });
                })()
              ) : (
                // Renderização padrão para outras categorias
                <>
                  {(isExpanded ? categoryDocs : categoryDocs.slice(0, 2)).map((doc) => (
                    <div
                      key={doc.id}
                      className="bg-surface-raised hover:bg-white rounded-[6px] p-3 lg:p-4 border border-border-subtle hover:border-brand-200 hover: transition-all"
                    >
                      <div className="flex items-start justify-between gap-3">
                        {/* Conteudo do documento */}
                        <div
                          className="flex-1 min-w-0 cursor-pointer group"
                          onClick={() => onDocumentClick(doc)}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => { if (e.key === 'Enter') onDocumentClick(doc); }}
                        >
                          <div className="flex items-start gap-2.5 lg:gap-3 w-full">
                            <div className={`w-8 h-8 ${config.docIconBg} rounded-[6px] flex items-center justify-center flex-shrink-0 mt-0.5`}>
                              {doc.type === 'video' ? (
                                <Video className="w-4 h-4 text-white" />
                              ) : (
                                <FileText className="w-4 h-4 text-white" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start gap-2">
                                <h4 className="text-sm lg:text-base font-semibold text-ink-primary group-hover:text-brand-600 transition-colors line-clamp-2">
                                  {doc.title}
                                </h4>
                                {PARECER_SUBTYPE_LABELS[doc.category] && (
                                  <span className={`flex-shrink-0 mt-0.5 px-2 py-0.5 rounded-full text-xs font-semibold ${
                                    doc.category === 'decor'
                                      ? 'bg-amber-accent-soft text-amber-accent-deep'
                                      : 'bg-emerald-100 text-emerald-800'
                                  }`}>
                                    {PARECER_SUBTYPE_LABELS[doc.category]}
                                  </span>
                                )}
                              </div>
                              {doc.description && (
                                <p className="text-xs lg:text-sm text-ink-muted mt-1 line-clamp-2">
                                  {truncateDescription(doc.description)}
                                </p>
                              )}
                              {doc.leiArticles && (
                                <div className="mt-2">
                                  <ArticleBadges
                                    leiArticles={doc.leiArticles}
                                    maxVisible={3}
                                    onArticleClick={(articleNum) => {
                                      console.log('Artigo clicado:', articleNum);
                                    }}
                                  />
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Botao de favoritar */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleFavorite(doc.id, courseId);
                          }}
                          className={`p-2 rounded-[6px] transition-colors flex-shrink-0 min-h-[40px] min-w-[40px] lg:min-h-0 lg:min-w-0 flex items-center justify-center ${
                            isFavorite(doc.id)
                              ? 'text-red-600 bg-red-100 hover:bg-red-200'
                              : 'text-ink-muted hover:text-red-600 hover:bg-red-50'
                          }`}
                          title={isFavorite(doc.id) ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
                        >
                          <Heart className={`w-4 h-4 lg:w-5 lg:h-5 ${isFavorite(doc.id) ? 'fill-current' : ''}`} />
                        </button>
                      </div>
                    </div>
                  ))}

                  {/* Botao "Ver mais" redesenhado */}
                  {!isExpanded && categoryDocs.length > 2 && (
                    <button
                      onClick={() => toggleCategory(category)}
                      className="w-full py-3 border-2 border-dashed border-border-subtle hover:border-brand-300 rounded-[6px] text-sm font-medium text-ink-muted hover:text-brand-600 hover:bg-brand-50/50 flex items-center justify-center gap-2 transition-all"
                    >
                      <span>Ver mais {categoryDocs.length - 2} {categoryDocs.length - 2 === 1 ? 'documento' : 'documentos'}</span>
                      <ChevronDown className="w-4 h-4" />
                    </button>
                  )}

                  {/* Botao para colapsar */}
                  {isExpanded && categoryDocs.length > 2 && (
                    <button
                      onClick={() => toggleCategory(category)}
                      className="w-full py-2 text-sm font-medium text-ink-muted hover:text-ink-secondary flex items-center justify-center gap-1 transition-colors"
                    >
                      <ChevronUp className="w-4 h-4" />
                      <span>Mostrar menos</span>
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
