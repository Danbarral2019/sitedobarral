'use client';

import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { Loader2, Network, Info } from 'lucide-react';
import { LEI_14133_ARTIGOS } from '@/data/lei-14133-artigos';

// Importação dinâmica para evitar SSR issues
const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), {
  ssr: false,
});

interface ArticleRelationship {
  articleNumber: string;
  strength: number;
  sharedDocuments: number;
}

interface GraphNode {
  id: string;
  name: string;
  val: number; // Tamanho do nó
  color: string;
  isCurrent?: boolean;
}

interface GraphLink {
  source: string;
  target: string;
  value: number; // Espessura da linha
  strength: number;
}

interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

interface ArticleRelationshipGraphProps {
  articleNumber: string;
  onArticleClick?: (articleNumber: string) => void;
}

export function ArticleRelationshipGraph({
  articleNumber,
  onArticleClick,
}: ArticleRelationshipGraphProps) {
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const graphRef = useRef<unknown>(null);

  const loadRelationships = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/artigos/${articleNumber}/relationships`);

      if (!response.ok) {
        throw new Error('Erro ao carregar relacionamentos');
      }

      const data = await response.json();

      if (!data.relationships || data.relationships.length === 0) {
        setGraphData(null);
        return;
      }

      // Construir dados do grafo
      const nodes: GraphNode[] = [];
      const links: GraphLink[] = [];

      // Nó central (artigo atual)
      nodes.push({
        id: articleNumber,
        name: `Art. ${articleNumber}`,
        val: 30, // Nó maior
        color: '#3b82f6', // Azul
        isCurrent: true,
      });

      // Nós relacionados
      data.relationships.forEach((rel: ArticleRelationship) => {
        // Cor baseada na força do relacionamento
        const color = getColorByStrength(rel.strength);

        // Tamanho baseado no número de documentos compartilhados
        const size = Math.max(10, Math.min(25, 10 + rel.sharedDocuments * 2));

        nodes.push({
          id: rel.articleNumber,
          name: `Art. ${rel.articleNumber}`,
          val: size,
          color,
        });

        // Link entre o artigo atual e o relacionado
        links.push({
          source: articleNumber,
          target: rel.articleNumber,
          value: rel.strength / 10, // Espessura da linha (0-10)
          strength: rel.strength,
        });
      });

      setGraphData({ nodes, links });
    } catch (err) {
      console.error('Erro ao carregar relacionamentos:', err);
      setError('Não foi possível carregar o mapa de relacionamentos');
    } finally {
      setIsLoading(false);
    }
  };

  const getColorByStrength = (strength: number): string => {
    if (strength >= 75) return '#ef4444'; // Vermelho - relacionamento muito forte
    if (strength >= 50) return '#f97316'; // Laranja - relacionamento forte
    if (strength >= 25) return '#eab308'; // Amarelo - relacionamento moderado
    return '#22c55e'; // Verde - relacionamento fraco
  };

  const handleNodeClick = (node: GraphNode) => {
    if (!node.isCurrent && onArticleClick) {
      onArticleClick(node.id);
    }
  };

  useEffect(() => {
    loadRelationships();
  }, [articleNumber]); // eslint-disable-line react-hooks/exhaustive-deps

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

  if (!graphData || graphData.nodes.length <= 1) {
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
    <div className="bg-white rounded-xl border-2 border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-purple-50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
            <Network className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900">
              Mapa de Relacionamentos
            </h3>
            <p className="text-sm text-gray-600">
              Artigos frequentemente citados juntos em documentos
            </p>
          </div>
        </div>
      </div>

      {/* Grafo */}
      <div className="relative" style={{ height: '500px' }}>
        <ForceGraph2D
          ref={graphRef}
          graphData={graphData}
          nodeLabel={(node: GraphNode) => {
            const article = LEI_14133_ARTIGOS[node.id];
            return `${node.name}\n${article?.ementa || ''}`;
          }}
          nodeCanvasObject={(node: GraphNode, ctx: CanvasRenderingContext2D, globalScale: number) => {
            const label = node.name;
            const fontSize = 12 / globalScale;
            ctx.font = `${fontSize}px Sans-Serif`;

            // Desenhar círculo
            ctx.beginPath();
            ctx.arc(node.x, node.y, node.val, 0, 2 * Math.PI, false);
            ctx.fillStyle = node.color;
            ctx.fill();

            // Desenhar borda para nó atual
            if (node.isCurrent) {
              ctx.strokeStyle = '#1d4ed8';
              ctx.lineWidth = 3 / globalScale;
              ctx.stroke();
            }

            // Desenhar texto
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = '#ffffff';
            ctx.fillText(label, node.x, node.y);
          }}
          linkWidth={(link: GraphLink) => link.value}
          linkColor={() => '#cbd5e1'}
          linkDirectionalParticles={2}
          linkDirectionalParticleWidth={2}
          onNodeClick={handleNodeClick}
          cooldownTicks={100}
          d3VelocityDecay={0.3}
        />
      </div>

      {/* Legenda */}
      <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h4 className="text-xs font-bold text-gray-700 mb-2">Força do Relacionamento:</h4>
            <div className="flex items-center gap-3 text-xs">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full bg-red-500"></div>
                <span className="text-gray-600">Muito Forte (≥75%)</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full bg-orange-500"></div>
                <span className="text-gray-600">Forte (50-74%)</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                <span className="text-gray-600">Moderado (25-49%)</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full bg-green-500"></div>
                <span className="text-gray-600">Fraco (&lt;25%)</span>
              </div>
            </div>
          </div>

          <div>
            <p className="text-xs text-gray-600">
              <span className="font-semibold">{graphData.nodes.length - 1}</span> artigos relacionados
            </p>
            <p className="text-xs text-gray-500">
              Clique em um artigo para navegar
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
