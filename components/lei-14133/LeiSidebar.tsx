'use client';

import { ChevronRight, ChevronDown } from 'lucide-react';
import type { RefObject } from 'react';

export interface LeiArticleListItem {
  numero: string;
  titulo: string | null;
  capitulo: string;
  capituloCompleto: string | null;
  ementa: string;
  documentCount: number;
}

export interface LeiHierarchyCapitulo {
  capituloCompleto: string;
  artigos: LeiArticleListItem[];
}

export interface LeiHierarchyTitulo {
  titulo: string;
  capitulos: Record<string, LeiHierarchyCapitulo>;
}

export type LeiHierarchy = Record<string, LeiHierarchyTitulo>;

interface LeiSidebarProps {
  hierarchy: LeiHierarchy | null;
  selectedNumero: string | null;
  expandedTitulos: Set<string>;
  expandedCapitulos: Set<string>;
  onToggleTitulo: (titulo: string) => void;
  onToggleCapitulo: (tituloKey: string, capituloKey: string) => void;
  onSelectArticle: (article: LeiArticleListItem) => void;
  articleRefs?: RefObject<Record<string, HTMLElement | null>>;
}

export function LeiSidebar({
  hierarchy,
  selectedNumero,
  expandedTitulos,
  expandedCapitulos,
  onToggleTitulo,
  onToggleCapitulo,
  onSelectArticle,
  articleRefs,
}: LeiSidebarProps) {
  if (!hierarchy) return null;

  return (
    <div className="p-2">
      {Object.entries(hierarchy).map(([tk, td]) => {
        const open = expandedTitulos.has(tk);
        return (
          <div key={tk} className="mb-2">
            <button
              onClick={() => onToggleTitulo(tk)}
              className="w-full flex items-center gap-2 p-3 hover:bg-surface-raised rounded-lg transition-colors text-left"
            >
              {open ? (
                <ChevronDown className="w-5 h-5 text-brand-600 flex-shrink-0" />
              ) : (
                <ChevronRight className="w-5 h-5 text-ink-muted flex-shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-ink-primary truncate">{td.titulo}</p>
                <p className="text-xs text-ink-muted">
                  {Object.values(td.capitulos).reduce((sum, c) => sum + c.artigos.length, 0)} artigos
                </p>
              </div>
            </button>

            {open && (
              <div className="ml-4 mt-1 space-y-1">
                {Object.entries(td.capitulos).map(([ck, cd]) => {
                  const cId = `${tk}::${ck}`;
                  const cOpen = expandedCapitulos.has(cId);
                  return (
                    <div key={ck}>
                      <button
                        onClick={() => onToggleCapitulo(tk, ck)}
                        className="w-full flex items-center gap-2 p-2 hover:bg-surface-raised rounded-lg transition-colors text-left"
                      >
                        {cOpen ? (
                          <ChevronDown className="w-4 h-4 text-brand-600 flex-shrink-0" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-ink-muted flex-shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-ink-primary truncate">{cd.capituloCompleto}</p>
                          <p className="text-xs text-ink-muted">{cd.artigos.length} artigos</p>
                        </div>
                      </button>

                      {cOpen && (
                        <div className="ml-4 mt-1 space-y-1">
                          {cd.artigos.map((art) => {
                            const sel = selectedNumero === art.numero;
                            return (
                              <button
                                key={art.numero}
                                ref={(el) => {
                                  if (articleRefs?.current) articleRefs.current[art.numero] = el;
                                }}
                                onClick={() => onSelectArticle(art)}
                                className={`w-full flex items-center gap-2 p-2 rounded-lg transition-colors text-left ${
                                  sel ? 'bg-surface-deep border-2 border-brand-600' : 'hover:bg-surface-deep'
                                }`}
                              >
                                <span
                                  className={`px-2 py-1 rounded text-xs font-bold ${
                                    sel ? 'bg-brand-600 text-white' : 'bg-surface-deep text-ink-secondary'
                                  }`}
                                >
                                  Art. {art.numero}
                                </span>
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs text-ink-secondary truncate">
                                    {art.ementa.substring(0, 40)}…
                                  </p>
                                </div>
                                {art.documentCount > 0 && (
                                  <span className="flex-shrink-0 px-2 py-0.5 bg-surface-deep text-ink-secondary text-xs font-medium rounded">
                                    {art.documentCount}
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
