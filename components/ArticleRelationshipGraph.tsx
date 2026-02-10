'use client';

import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { Loader2, Network, Info, ArrowRight, GitBranch, List } from 'lucide-react';
import { LEI_14133_ARTIGOS } from '@/data/lei-14133-artigos';
import dynamic from 'next/dynamic';

const ForceGraph2D = dynamic(
  () => import('react-force-graph-2d').then(mod => mod.default || mod),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center" style={{ height: 420 }}>
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    ),
  }
);

interface ArticleRelationship {
  articleNumber: string;
  strength: number;
  sharedDocuments: number;
}

interface ArticleRelationshipGraphProps {
  articleNumber: string;
  onArticleClick?: (articleNumber: string) => void;
}

interface GraphNode {
  id: string;
  label: string;
  ementa: string;
  strength: number;
  sharedDocuments: number;
  isCentral: boolean;
  fx: number;
  fy: number;
  color: string;
  radius: number;
  ring: number; // 0 = center, 1 = inner, 2 = outer
  x?: number;
  y?: number;
}

interface GraphLink {
  source: string | GraphNode;
  target: string | GraphNode;
  strength: number;
}

function getColorByStrength(strength: number): string {
  if (strength >= 75) return '#dc2626'; // red-600
  if (strength >= 50) return '#ea580c'; // orange-600
  if (strength >= 25) return '#ca8a04'; // yellow-600
  return '#16a34a'; // green-600
}

function getBorderByStrength(strength: number): string {
  if (strength >= 75) return '#991b1b'; // red-800
  if (strength >= 50) return '#9a3412'; // orange-800
  if (strength >= 25) return '#854d0e'; // yellow-800
  return '#166534'; // green-800
}

function getBadgeColor(strength: number): string {
  if (strength >= 75) return 'bg-red-100 text-red-700 border-red-300';
  if (strength >= 50) return 'bg-orange-100 text-orange-700 border-orange-300';
  if (strength >= 25) return 'bg-yellow-100 text-yellow-700 border-yellow-300';
  return 'bg-green-100 text-green-700 border-green-300';
}

// Orbital ring radii
const RING_RADII = [0, 100, 175];

export function ArticleRelationshipGraph({
  articleNumber,
  onArticleClick,
}: ArticleRelationshipGraphProps) {
  const [relationships, setRelationships] = useState<ArticleRelationship[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'graph' | 'list'>('graph');
  const [containerWidth, setContainerWidth] = useState(700);
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const graphRef = useRef<any>(null);
  const [hasZoomed, setHasZoomed] = useState(false);

  // ResizeObserver for container width
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateWidth = () => {
      const w = container.getBoundingClientRect().width;
      if (w > 0) setContainerWidth(w);
    };

    updateWidth();

    const observer = new ResizeObserver(() => updateWidth());
    observer.observe(container);

    return () => observer.disconnect();
  }, []);

  // Auto-default to list on mobile
  useEffect(() => {
    if (containerWidth > 0 && containerWidth < 640) {
      setViewMode('list');
    }
  }, [containerWidth]);

  useEffect(() => {
    setHasZoomed(false);
    setIsLoading(true);
    setError(null);

    fetch(`/api/artigos/${articleNumber}/relationships`)
      .then(res => {
        if (!res.ok) throw new Error('Erro ao carregar relacionamentos');
        return res.json();
      })
      .then(data => {
        if (!data.relationships || data.relationships.length === 0) {
          setRelationships([]);
        } else {
          const top = data.relationships
            .sort((a: ArticleRelationship, b: ArticleRelationship) => b.strength - a.strength)
            .slice(0, 12);
          setRelationships(top);
        }
      })
      .catch(err => {
        console.error('Erro ao carregar relacionamentos:', err);
        setError('Não foi possível carregar o mapa de relacionamentos');
      })
      .finally(() => setIsLoading(false));
  }, [articleNumber]);

  // Build graph data with orbital positioning
  const graphData = useMemo(() => {
    if (relationships.length === 0) return { nodes: [] as GraphNode[], links: [] as GraphLink[] };

    const centralArticle = LEI_14133_ARTIGOS[articleNumber];

    const centralNode: GraphNode = {
      id: articleNumber,
      label: `Art. ${articleNumber}`,
      ementa: centralArticle?.ementa || '',
      strength: 100,
      sharedDocuments: 0,
      isCentral: true,
      fx: 0,
      fy: 0,
      color: '#2563eb',
      radius: 28,
      ring: 0,
    };

    // Split into inner ring (strong ≥50%) and outer ring (<50%)
    const innerRels = relationships.filter(r => r.strength >= 50);
    const outerRels = relationships.filter(r => r.strength < 50);

    const positionOnRing = (
      rels: ArticleRelationship[],
      ringIndex: number,
    ): GraphNode[] => {
      const ringRadius = RING_RADII[ringIndex];
      const count = rels.length;
      if (count === 0) return [];

      // Start from top (-π/2) and distribute evenly
      const angleStep = (2 * Math.PI) / count;
      const startAngle = -Math.PI / 2;

      return rels.map((rel, i) => {
        const art = LEI_14133_ARTIGOS[rel.articleNumber];
        const angle = startAngle + i * angleStep;

        // Node size based on strength: stronger = bigger
        const nodeRadius = ringIndex === 1
          ? 16 + (rel.strength / 12) // inner ring: 16-24
          : 12 + (rel.strength / 15); // outer ring: 12-18

        return {
          id: rel.articleNumber,
          label: `Art. ${rel.articleNumber}`,
          ementa: art?.ementa || '',
          strength: rel.strength,
          sharedDocuments: rel.sharedDocuments,
          isCentral: false,
          fx: ringRadius * Math.cos(angle),
          fy: ringRadius * Math.sin(angle),
          color: getColorByStrength(rel.strength),
          radius: nodeRadius,
          ring: ringIndex,
        };
      });
    };

    // If all are strong or all are weak, use only one ring (inner)
    let relatedNodes: GraphNode[];
    if (innerRels.length === 0) {
      relatedNodes = positionOnRing(outerRels, 1);
    } else if (outerRels.length === 0) {
      relatedNodes = positionOnRing(innerRels, 1);
    } else {
      relatedNodes = [
        ...positionOnRing(innerRels, 1),
        ...positionOnRing(outerRels, 2),
      ];
    }

    const links: GraphLink[] = relationships.map((rel) => ({
      source: articleNumber,
      target: rel.articleNumber,
      strength: rel.strength,
    }));

    return {
      nodes: [centralNode, ...relatedNodes],
      links,
    };
  }, [relationships, articleNumber]);

  // Draw orbital rings in the background
  const onRenderFramePre = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    (ctx: CanvasRenderingContext2D, _globalScale: number) => {
      // Determine which rings are used
      const hasInner = graphData.nodes.some(n => n.ring === 1);
      const hasOuter = graphData.nodes.some(n => n.ring === 2);

      ctx.save();

      if (hasInner) {
        ctx.beginPath();
        ctx.arc(0, 0, RING_RADII[1], 0, 2 * Math.PI);
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.2)';
        ctx.lineWidth = 1;
        ctx.setLineDash([6, 4]);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      if (hasOuter) {
        ctx.beginPath();
        ctx.arc(0, 0, RING_RADII[2], 0, 2 * Math.PI);
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.15)';
        ctx.lineWidth = 1;
        ctx.setLineDash([6, 4]);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Ring labels
      if (hasInner && hasOuter) {
        ctx.font = '6px Sans-Serif';
        ctx.fillStyle = 'rgba(148, 163, 184, 0.5)';
        ctx.textAlign = 'center';
        ctx.fillText('FORTE', 0, -RING_RADII[1] + 14);
        ctx.fillText('MODERADO', 0, -RING_RADII[2] + 14);
      }

      ctx.restore();
    },
    [graphData.nodes]
  );

  // Canvas custom node renderer
  const nodeCanvasObject = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars
    (node: any, ctx: CanvasRenderingContext2D, _globalScale: number) => {
      const x = node.x ?? 0;
      const y = node.y ?? 0;
      const radius = node.radius ?? 14;

      // Shadow for depth
      if (node.isCentral) {
        ctx.shadowColor = 'rgba(37, 99, 235, 0.3)';
        ctx.shadowBlur = 12;
      } else {
        ctx.shadowColor = 'rgba(0, 0, 0, 0.15)';
        ctx.shadowBlur = 6;
      }

      // Fill circle
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, 2 * Math.PI);
      ctx.fillStyle = node.color || '#666';
      ctx.fill();

      // Reset shadow
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;

      // Border
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, 2 * Math.PI);
      if (node.isCentral) {
        ctx.strokeStyle = '#1e40af';
        ctx.lineWidth = 3;
      } else {
        ctx.strokeStyle = getBorderByStrength(node.strength ?? 0);
        ctx.lineWidth = 2;
      }
      ctx.stroke();

      // Article number text
      const artNum = String(node.id);
      if (node.isCentral) {
        // Central: "Art." label on top, number below
        ctx.font = 'bold 7px Sans-Serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.fillText('Art.', x, y - 6);
        ctx.font = 'bold 13px Sans-Serif';
        ctx.fillStyle = '#ffffff';
        ctx.fillText(artNum, x, y + 5);
      } else {
        // Related: number with strength% below
        ctx.font = `bold ${radius > 16 ? 9 : 7}px Sans-Serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#ffffff';
        ctx.fillText(artNum, x, y - 3);

        ctx.font = `bold 6px Sans-Serif`;
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        ctx.fillText(`${node.strength}%`, x, y + 7);
      }
    },
    []
  );

  // Node pointer area paint
  const nodePointerAreaPaint = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (node: any, color: string, ctx: CanvasRenderingContext2D) => {
      const x = node.x ?? 0;
      const y = node.y ?? 0;
      ctx.beginPath();
      ctx.arc(x, y, (node.radius ?? 14) + 4, 0, 2 * Math.PI);
      ctx.fillStyle = color;
      ctx.fill();
    },
    []
  );

  // Handle engine stop - zoom to fit
  const handleEngineStop = useCallback(() => {
    if (graphRef.current && !hasZoomed) {
      try {
        graphRef.current.zoomToFit(400, 40);
      } catch {
        // ignore zoom errors
      }
      setHasZoomed(true);
    }
  }, [hasZoomed]);

  // Handle node click
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleNodeClick = useCallback((node: any) => {
    if (!node.isCentral && onArticleClick) {
      onArticleClick(String(node.id));
    }
  }, [onArticleClick]);

  // Node label for tooltip
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const nodeLabel = useCallback((node: any) => {
    if (node.isCentral) return `<b>Art. ${node.id}</b> (atual)`;
    const ementa = (node.ementa || '').length > 120
      ? node.ementa.substring(0, 120) + '...'
      : (node.ementa || '');
    return `<b>Art. ${node.id}</b> - ${node.strength}% | ${node.sharedDocuments} docs<br/><small>${ementa}</small>`;
  }, []);

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl border-2 border-gray-200 p-8">
        <div className="flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          <span className="ml-3 text-gray-600">Carregando mapa de relacionamentos...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-xl border-2 border-red-200 p-8">
        <div className="flex items-center justify-center text-red-600">
          <Info className="w-6 h-6 mr-2" />
          <span>{error}</span>
        </div>
      </div>
    );
  }

  if (relationships.length === 0) {
    return (
      <div className="bg-white rounded-xl border-2 border-gray-200 p-8">
        <div className="flex items-center justify-center text-gray-500">
          <Network className="w-6 h-6 mr-2" />
          <span>Nenhum relacionamento encontrado para este artigo</span>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="bg-white rounded-xl border-2 border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-purple-50">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
              <Network className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">
                Artigos Relacionados
              </h3>
              <p className="text-sm text-gray-600">
                {relationships.length} artigos mais citados juntos
              </p>
            </div>
          </div>

          {/* Toggle Grafo/Lista */}
          <div className="flex bg-gray-100 rounded-lg p-0.5">
            <button
              onClick={() => setViewMode('graph')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                viewMode === 'graph'
                  ? 'bg-white text-blue-700 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <GitBranch className="w-4 h-4" />
              <span className="hidden sm:inline">Orbital</span>
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                viewMode === 'list'
                  ? 'bg-white text-blue-700 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <List className="w-4 h-4" />
              <span className="hidden sm:inline">Lista</span>
            </button>
          </div>
        </div>
      </div>

      {/* Orbital Graph View */}
      {viewMode === 'graph' && (
        <div className="relative" style={{ height: 420 }}>
          <ForceGraph2D
            ref={graphRef}
            graphData={graphData}
            width={containerWidth}
            height={420}
            backgroundColor="#ffffff"
            nodeCanvasObject={nodeCanvasObject}
            nodeCanvasObjectMode={() => 'replace'}
            nodePointerAreaPaint={nodePointerAreaPaint}
            nodeLabel={nodeLabel}
            onRenderFramePre={onRenderFramePre}
            linkColor={(link: GraphLink) => {
              const str = typeof link.strength === 'number' ? link.strength : 25;
              const opacity = Math.max(0.15, str / 150);
              return `rgba(148, 163, 184, ${opacity})`;
            }}
            linkWidth={(link: GraphLink) => {
              const str = typeof link.strength === 'number' ? link.strength : 25;
              return Math.max(0.5, str / 30);
            }}
            onNodeClick={handleNodeClick}
            enableNodeDrag={false}
            warmupTicks={0}
            cooldownTicks={0}
            d3AlphaDecay={1}
            d3VelocityDecay={1}
            onEngineStop={handleEngineStop}
            minZoom={0.5}
            maxZoom={4}
          />
        </div>
      )}

      {/* List View */}
      {viewMode === 'list' && (
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {relationships.map((rel) => {
              const article = LEI_14133_ARTIGOS[rel.articleNumber];
              return (
                <button
                  key={rel.articleNumber}
                  onClick={() => onArticleClick && onArticleClick(rel.articleNumber)}
                  className="flex items-center gap-3 p-4 bg-gray-50 hover:bg-blue-50 border-2 border-gray-200 hover:border-blue-300 rounded-lg transition-all text-left group"
                >
                  <div
                    className="flex-shrink-0 w-12 h-12 rounded-lg flex flex-col items-center justify-center font-bold text-white"
                    style={{ backgroundColor: getColorByStrength(rel.strength) }}
                  >
                    <div className="text-lg">{rel.strength}%</div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-bold text-gray-900 text-base">
                        Art. {rel.articleNumber}
                      </h4>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium border ${getBadgeColor(rel.strength)}`}>
                        {rel.sharedDocuments} {rel.sharedDocuments === 1 ? 'doc' : 'docs'}
                      </span>
                    </div>
                    {article && (
                      <p className="text-xs text-gray-600 line-clamp-2">
                        {article.ementa}
                      </p>
                    )}
                  </div>
                  <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-blue-600 flex-shrink-0 transition-colors" />
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Legenda */}
      <div className="px-6 py-3 border-t border-gray-200 bg-gray-50">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3 text-xs">
            <span className="text-gray-500 font-medium">Proximidade = forca:</span>
            <div className="flex items-center gap-1">
              <div className="w-2.5 h-2.5 rounded-full bg-red-600"></div>
              <span className="text-gray-500">{'\u2265'}75%</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2.5 h-2.5 rounded-full bg-orange-600"></div>
              <span className="text-gray-500">50-74%</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2.5 h-2.5 rounded-full bg-yellow-600"></div>
              <span className="text-gray-500">25-49%</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2.5 h-2.5 rounded-full bg-green-600"></div>
              <span className="text-gray-500">&lt;25%</span>
            </div>
          </div>
          {viewMode === 'graph' && (
            <p className="text-xs text-gray-500">
              Clique em um no para navegar
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
