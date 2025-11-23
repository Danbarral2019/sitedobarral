'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ChevronDown,
  ChevronUp,
  ExternalLink,
  AlertTriangle,
  FileText,
  List,
  Loader2
} from 'lucide-react';
import { LeiArticle } from '@/data/lei-14133-artigos';
import { ArticleContentSections } from '@/components/ArticleContentSections';

interface CollapsibleArticleProps {
  articleNum: string;
  article: LeiArticle;
  colors: {
    bg: string;
    border: string;
    text: string;
    hover: string;
  };
  defaultExpanded?: boolean;
}

interface RelatedDocument {
  id: string;
  title: string;
  isPublic: boolean;
  category: string | null;
}

export function CollapsibleArticle({
  articleNum,
  article,
  colors,
  defaultExpanded = false
}: CollapsibleArticleProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [relatedDocs, setRelatedDocs] = useState<RelatedDocument[]>([]);
  const [isLoadingDocs, setIsLoadingDocs] = useState(false);
  const [docsLoaded, setDocsLoaded] = useState(false);

  // Buscar documentos relacionados quando expandir pela primeira vez
  useEffect(() => {
    if (isExpanded && !docsLoaded) {
      fetchRelatedDocuments();
    }
  }, [isExpanded]);

  async function fetchRelatedDocuments() {
    setIsLoadingDocs(true);
    try {
      const response = await fetch(`/api/lei-14133/articles?withDocuments=true`);
      if (response.ok) {
        const data = await response.json();
        const articleData = data.articles.find((a: any) => a.numero === articleNum);
        if (articleData && articleData.documents) {
          setRelatedDocs(articleData.documents);
        }
        setDocsLoaded(true);
      }
    } catch (error) {
      console.error('Erro ao buscar documentos relacionados:', error);
    } finally {
      setIsLoadingDocs(false);
    }
  }

  // Verificar se está truncado
  const ementa = article.ementa || '';
  const suspicious = /\s(do|da|de|dos|das|no|na|nos|nas|ao|à|aos|às|com|por|para|pelo|pela|que|se|e|ou)\s*$/i.test(ementa);
  const isTruncated = suspicious || ementa.length < 100;

  // Extrair caput (primeira parte até primeiro inciso ou parágrafo)
  const caputMatch = ementa.match(/^([^IV§]*?)(?=\n\s*[IV]|§|$)/);
  const caput = caputMatch ? caputMatch[1].trim() : ementa.substring(0, 200);

  // Contar incisos e parágrafos
  const incisosCount = (ementa.match(/\n\s*[IVX]+\s*[-–—]\s/g) || []).length;
  const paragrafosCount = (ementa.match(/§\s*\d+/g) || []).length;

  return (
    <div className={`rounded-xl border-2 ${colors.border} ${colors.bg} ${colors.hover} transition-all ${isExpanded ? 'shadow-lg' : 'shadow-sm'}`}>
      {/* Header - Sempre visível */}
      <div className="p-5">
        <div className="flex items-start gap-4">
          {/* Número do Artigo - Clicável */}
          <Link
            href={`/artigo/${articleNum}`}
            className={`flex-shrink-0 px-3 py-1 ${colors.text} bg-white rounded-lg text-sm font-bold border-2 ${colors.border} hover:shadow-md hover:scale-105 transition-all cursor-pointer`}
          >
            Art. {article.numero}
          </Link>

          {/* Conteúdo */}
          <div className="flex-1 min-w-0">
            {/* Título e Capítulo */}
            {article.capituloCompleto && (
              <p className="text-xs text-gray-500 mb-1">
                {article.capituloCompleto}
              </p>
            )}

            {/* Caput / Preview */}
            <p className="text-sm text-gray-700 mb-3">
              {isExpanded ? (
                <span className="whitespace-pre-line leading-relaxed">
                  {ementa}
                </span>
              ) : (
                <>
                  {caput}
                  {ementa.length > caput.length && '...'}
                </>
              )}
            </p>

            {/* Contador de Incisos/Parágrafos (quando colapsado) */}
            {!isExpanded && (incisosCount > 0 || paragrafosCount > 0) && (
              <div className="flex items-center gap-3 text-xs text-gray-500 mb-2">
                {incisosCount > 0 && (
                  <span className="flex items-center gap-1">
                    <List className="w-3 h-3" />
                    {incisosCount} {incisosCount === 1 ? 'inciso' : 'incisos'}
                  </span>
                )}
                {paragrafosCount > 0 && (
                  <span className="flex items-center gap-1">
                    <FileText className="w-3 h-3" />
                    {paragrafosCount} {paragrafosCount === 1 ? 'parágrafo' : 'parágrafos'}
                  </span>
                )}
              </div>
            )}

            {/* Alerta de Truncamento */}
            {isTruncated && (
              <div className="mb-2 inline-flex items-center gap-1 px-2 py-1 bg-red-100 border border-red-300 rounded text-xs text-red-700">
                <AlertTriangle className="w-3 h-3" />
                Texto possivelmente incompleto
              </div>
            )}
          </div>

          {/* Botão Expandir/Colapsar */}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className={`flex-shrink-0 p-2 rounded-lg ${colors.text} hover:bg-white/50 transition-colors`}
            aria-label={isExpanded ? 'Colapsar artigo' : 'Expandir artigo'}
          >
            {isExpanded ? (
              <ChevronUp className="w-5 h-5" />
            ) : (
              <ChevronDown className="w-5 h-5" />
            )}
          </button>
        </div>

        {/* Documentos Relacionados e Ações (quando expandido) */}
        {isExpanded && (
          <div className="mt-4 pt-4 border-t border-gray-200 space-y-4">
            {/* Loading State */}
            {isLoadingDocs && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
                <span className="ml-2 text-sm text-gray-500">Carregando documentos relacionados...</span>
              </div>
            )}

            {/* Documentos Relacionados */}
            {!isLoadingDocs && docsLoaded && (
              <ArticleContentSections articleNum={articleNum} documents={relatedDocs} />
            )}

            {/* Ações */}
            <div className="flex items-center gap-2 pt-4">
              <Link
                href={`/artigo/${articleNum}`}
                className="inline-flex items-center gap-2 px-4 py-2 bg-white border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
              >
                <ExternalLink className="w-4 h-4" />
                Ver Página Completa
              </Link>
              {relatedDocs.length > 0 && (
                <span className="text-xs text-gray-500 ml-auto">
                  {relatedDocs.length} {relatedDocs.length === 1 ? 'documento relacionado' : 'documentos relacionados'}
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
