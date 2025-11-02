'use client';

import { useState, useMemo } from 'react';
import { ChevronDown, ChevronRight, FileText } from 'lucide-react';
import Link from 'next/link';
import { LEI_14133_ARTIGOS, getArticlesByCapitulo } from '@/data/lei-14133-artigos';
import { formatArticleNumber, getArticleIcon } from '@/lib/article-utils';

interface TreeNode {
  id: string;
  label: string;
  type: 'titulo' | 'capitulo' | 'artigo';
  articles?: string[];
  children?: TreeNode[];
}

interface ArticleStats {
  [articleNum: string]: {
    documentCount: number;
    viewCount: number;
  };
}

interface ArticleTreeNavigatorProps {
  stats?: ArticleStats;
  onArticleClick?: (articleNum: string) => void;
}

export function ArticleTreeNavigator({ stats = {}, onArticleClick }: ArticleTreeNavigatorProps) {
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

  // Construir árvore hierárquica
  const tree = useMemo(() => {
    const articlesByCapitulo = getArticlesByCapitulo();
    const nodes: TreeNode[] = [];

    // Agrupar por TÍTULO
    const byTitulo: Record<string, typeof articlesByCapitulo> = {};

    Object.entries(articlesByCapitulo).forEach(([capitulo, articles]) => {
      const tituloMatch = capitulo.match(/^(TÍTULO [IVX]+)/);
      const titulo = tituloMatch ? tituloMatch[1] : 'OUTROS';

      if (!byTitulo[titulo]) {
        byTitulo[titulo] = {};
      }
      byTitulo[titulo][capitulo] = articles;
    });

    // Construir nós
    Object.entries(byTitulo).forEach(([titulo, capitulos]) => {
      const tituloNode: TreeNode = {
        id: titulo,
        label: titulo,
        type: 'titulo',
        children: [],
      };

      Object.entries(capitulos).forEach(([capitulo, articles]) => {
        const capituloNode: TreeNode = {
          id: capitulo,
          label: capitulo,
          type: 'capitulo',
          articles: articles.map(a => a.numero),
        };

        tituloNode.children!.push(capituloNode);
      });

      nodes.push(tituloNode);
    });

    return nodes;
  }, []);

  const toggleNode = (nodeId: string) => {
    setExpandedNodes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(nodeId)) {
        newSet.delete(nodeId);
      } else {
        newSet.add(nodeId);
      }
      return newSet;
    });
  };

  const getTotalDocs = (articles: string[]): number => {
    return articles.reduce((sum, num) => {
      return sum + (stats[num]?.documentCount || 0);
    }, 0);
  };

  const getColorIndicator = (count: number): string => {
    if (count >= 10) return 'bg-green-500';
    if (count >= 3) return 'bg-blue-500';
    return 'bg-gray-400';
  };

  const renderNode = (node: TreeNode, level: number = 0): JSX.Element => {
    const isExpanded = expandedNodes.has(node.id);
    const hasChildren = node.children && node.children.length > 0;
    const hasArticles = node.articles && node.articles.length > 0;
    const totalDocs = hasArticles ? getTotalDocs(node.articles) : 0;

    if (node.type === 'titulo') {
      return (
        <div key={node.id} className="mb-2">
          <button
            onClick={() => toggleNode(node.id)}
            className="w-full flex items-center gap-2 p-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all font-bold"
          >
            {isExpanded ? (
              <ChevronDown className="w-5 h-5 flex-shrink-0" />
            ) : (
              <ChevronRight className="w-5 h-5 flex-shrink-0" />
            )}
            <span className="text-sm">{node.label}</span>
          </button>

          {isExpanded && node.children && (
            <div className="ml-4 mt-2 space-y-2">
              {node.children.map(child => renderNode(child, level + 1))}
            </div>
          )}
        </div>
      );
    }

    if (node.type === 'capitulo') {
      return (
        <div key={node.id} className="mb-2">
          <button
            onClick={() => toggleNode(node.id)}
            className="w-full flex items-center gap-2 p-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
          >
            {isExpanded ? (
              <ChevronDown className="w-4 h-4 flex-shrink-0 text-gray-600" />
            ) : (
              <ChevronRight className="w-4 h-4 flex-shrink-0 text-gray-600" />
            )}
            <span className="text-xs font-medium text-gray-900 flex-1 text-left truncate">
              {node.label}
            </span>
            {hasArticles && (
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-[10px] text-gray-600">
                  {node.articles!.length} arts
                </span>
                {totalDocs > 0 && (
                  <div className="flex items-center gap-1">
                    <div className={`w-2 h-2 rounded-full ${getColorIndicator(totalDocs)}`}></div>
                    <span className="text-[10px] text-gray-600">{totalDocs}</span>
                  </div>
                )}
              </div>
            )}
          </button>

          {isExpanded && hasArticles && (
            <div className="ml-6 mt-1 space-y-1">
              {node.articles!.map(articleNum => {
                const article = LEI_14133_ARTIGOS[articleNum];
                const stat = stats[articleNum];
                const docCount = stat?.documentCount || 0;
                const viewCount = stat?.viewCount || 0;

                return (
                  <Link
                    key={articleNum}
                    href={`/artigo/${articleNum}`}
                    onClick={() => onArticleClick?.(articleNum)}
                    className="block p-2 hover:bg-blue-50 rounded-lg transition-colors group"
                  >
                    <div className="flex items-start gap-2">
                      <span className="text-sm flex-shrink-0">
                        {getArticleIcon(articleNum)}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2 mb-0.5">
                          <span className="text-xs font-bold text-gray-900 group-hover:text-blue-600">
                            {formatArticleNumber(articleNum)}
                          </span>
                          {(docCount > 0 || viewCount > 0) && (
                            <div className="flex items-center gap-2 text-[10px] text-gray-500">
                              {docCount > 0 && (
                                <span className="flex items-center gap-0.5">
                                  <div className={`w-1.5 h-1.5 rounded-full ${getColorIndicator(docCount)}`}></div>
                                  {docCount}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                        <p className="text-[10px] text-gray-600 line-clamp-2 leading-tight">
                          {article.ementa}
                        </p>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      );
    }

    return <div key={node.id}>Unknown node type</div>;
  };

  return (
    <div className="bg-white rounded-xl border-2 border-gray-200 p-4 shadow-lg">
      <div className="mb-4">
        <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
          <FileText className="w-5 h-5 text-blue-600" />
          Estrutura da Lei
        </h3>
        <p className="text-xs text-gray-600 mt-1">
          Navegue pela hierarquia completa da Lei 14.133/2021
        </p>
      </div>

      {/* Legenda */}
      <div className="mb-4 pb-4 border-b border-gray-200">
        <p className="text-xs font-medium text-gray-700 mb-2">Legenda:</p>
        <div className="flex flex-wrap gap-3 text-[10px] text-gray-600">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-green-500"></div>
            <span>≥10 docs</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-blue-500"></div>
            <span>3-9 docs</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-gray-400"></div>
            <span>&lt;3 docs</span>
          </div>
        </div>
      </div>

      {/* Árvore */}
      <div className="space-y-1 max-h-[600px] overflow-y-auto">
        {tree.map(node => renderNode(node))}
      </div>
    </div>
  );
}
