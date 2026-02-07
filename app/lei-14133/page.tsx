'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  BookOpen, Home, ChevronRight,
  Scale, FileText, Search,
  ChevronsDown, ChevronsUp,
  Gavel, ExternalLink, Loader2,
} from 'lucide-react';
import { LEI_14133_GRUPOS } from '@/data/lei-14133-grupos';
import { LEI_14133_ARTIGOS as LEI_14133_ARTIGOS_FALLBACK } from '@/data/lei-14133-artigos';
import { CollapsibleArticle } from '@/components/CollapsibleArticle';

type LeiArticle = {
  numero: string;
  ementa: string;
  capitulo: string;
  secao?: string;
  titulo?: string;
  capituloCompleto?: string;
};

type LegislativeAct = {
  id: string;
  type: string;
  fullNumber: string;
  title: string;
  ementa: string;
  summary?: string | null;
  issuer: string;
  publishDate: string;
  hierarchyLevel: number;
  leiArticles: string[];
  officialUrl?: string | null;
  pdfUrl?: string | null;
};

// Função auxiliar para converter ID de grupo em emoji
const getGroupEmoji = (icon: string) => icon;

// Cores Tailwind por grupo
const COLOR_CLASSES: Record<string, { bg: string; border: string; text: string; hover: string }> = {
  blue: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', hover: 'hover:border-blue-400' },
  yellow: { bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-700', hover: 'hover:border-yellow-400' },
  green: { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-700', hover: 'hover:border-green-400' },
  indigo: { bg: 'bg-indigo-50', border: 'border-indigo-200', text: 'text-indigo-700', hover: 'hover:border-indigo-400' },
  purple: { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700', hover: 'hover:border-purple-400' },
  cyan: { bg: 'bg-cyan-50', border: 'border-cyan-200', text: 'text-cyan-700', hover: 'hover:border-cyan-400' },
  emerald: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', hover: 'hover:border-emerald-400' },
  orange: { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700', hover: 'hover:border-orange-400' },
  amber: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', hover: 'hover:border-amber-400' },
  red: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', hover: 'hover:border-red-400' },
  teal: { bg: 'bg-teal-50', border: 'border-teal-200', text: 'text-teal-700', hover: 'hover:border-teal-400' },
  gray: { bg: 'bg-gray-50', border: 'border-gray-200', text: 'text-gray-700', hover: 'hover:border-gray-400' },
};

export default function Lei14133Page() {
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandAll, setExpandAll] = useState(false);
  const [artigos, setArtigos] = useState<Record<string, LeiArticle>>(LEI_14133_ARTIGOS_FALLBACK);
  const [isLoadingArtigos, setIsLoadingArtigos] = useState(true);
  const [showAtosNormativos, setShowAtosNormativos] = useState(false);
  const [legislativeActs, setLegislativeActs] = useState<LegislativeAct[]>([]);
  const [isLoadingActs, setIsLoadingActs] = useState(false);

  // Buscar artigos do banco de dados ao montar componente
  useEffect(() => {
    async function fetchArtigos() {
      try {
        const response = await fetch('/api/lei-14133/artigos');
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.artigos) {
            setArtigos(data.artigos);
          }
        }
      } catch (error) {
        console.error('Erro ao buscar artigos:', error);
      } finally {
        setIsLoadingArtigos(false);
      }
    }
    fetchArtigos();
  }, []);

  // Buscar atos normativos ao montar componente
  useEffect(() => {
    async function fetchLegislativeActs() {
      setIsLoadingActs(true);
      try {
        const response = await fetch('/api/legislative-acts?limit=100');
        if (response.ok) {
          const data = await response.json();
          setLegislativeActs(data.acts || []);
        }
      } catch (error) {
        console.error('Erro ao buscar atos normativos:', error);
      } finally {
        setIsLoadingActs(false);
      }
    }
    fetchLegislativeActs();
  }, []);

  const selectedGroupData = selectedGroup
    ? LEI_14133_GRUPOS.find(g => g.id === selectedGroup)
    : null;

  // Filtrar artigos se houver busca
  const filteredGroups = searchTerm.trim().length >= 2
    ? LEI_14133_GRUPOS.filter(group => {
        const term = searchTerm.toLowerCase();
        return (
          group.title.toLowerCase().includes(term) ||
          group.description.toLowerCase().includes(term) ||
          group.articles.some(articleNum => {
            const article = artigos[articleNum];
            return article && (
              article.numero.includes(term) ||
              article.ementa.toLowerCase().includes(term)
            );
          })
        );
      })
    : LEI_14133_GRUPOS;

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white py-12">
        <div className="max-w-7xl mx-auto px-4">
          {/* Breadcrumbs */}
          <div className="flex items-center gap-2 text-sm text-blue-100 mb-4">
            <Link href="/" className="hover:text-white transition-colors flex items-center gap-1">
              <Home className="w-4 h-4" />
              Início
            </Link>
            <ChevronRight className="w-4 h-4" />
            <span className="text-white font-medium">Lei 14.133/2021</span>
          </div>

          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 bg-white/20 backdrop-blur rounded-2xl flex items-center justify-center">
              <Scale className="w-10 h-10" />
            </div>
            <div>
              <h1 className="text-4xl font-bold mb-2">Lei 14.133/2021</h1>
              <p className="text-xl text-blue-100">
                Nova Lei de Licitações - Navegação por Temas
              </p>
            </div>
          </div>

          {/* Search Bar */}
          <div className="relative max-w-2xl">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar tema ou artigo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 text-gray-900 bg-white rounded-xl border-2 border-transparent focus:border-white focus:ring-4 focus:ring-white/30 shadow-lg"
            />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Sidebar - Grupos Temáticos */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl shadow-lg border-2 border-gray-200 p-6 sticky top-4">
              <div className="flex items-center gap-2 mb-6">
                <BookOpen className="w-6 h-6 text-blue-600" />
                <h2 className="text-xl font-bold text-gray-900">
                  Grupos Temáticos
                </h2>
              </div>

              <div className="space-y-2 max-h-[70vh] overflow-y-auto">
                {filteredGroups.map((group) => {
                  const colors = COLOR_CLASSES[group.color] || COLOR_CLASSES.gray;
                  const isSelected = selectedGroup === group.id;

                  return (
                    <button
                      key={group.id}
                      onClick={() => {
                        setSelectedGroup(group.id === selectedGroup ? null : group.id);
                        setShowAtosNormativos(false);
                      }}
                      className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                        isSelected
                          ? `${colors.bg} ${colors.border} ${colors.text} shadow-md`
                          : `bg-white border-gray-200 text-gray-700 ${colors.hover}`
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="text-2xl flex-shrink-0">
                          {getGroupEmoji(group.icon)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-bold text-sm mb-1 line-clamp-2">
                            {group.title}
                          </h3>
                          <p className="text-xs opacity-80 line-clamp-2">
                            {group.description}
                          </p>
                          <div className="mt-2">
                            <span className="text-xs font-medium px-2 py-1 bg-white/50 rounded">
                              {group.articles.length} {group.articles.length === 1 ? 'artigo' : 'artigos'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {filteredGroups.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <Search className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Nenhum grupo encontrado</p>
                </div>
              )}

              {/* Botão Atos Normativos */}
              {legislativeActs.length > 0 && (
                <div className="mt-4 pt-4 border-t-2 border-gray-200">
                  <button
                    onClick={() => {
                      setShowAtosNormativos(!showAtosNormativos);
                      if (!showAtosNormativos) setSelectedGroup(null);
                    }}
                    className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                      showAtosNormativos
                        ? 'bg-amber-50 border-amber-200 text-amber-700 shadow-md'
                        : 'bg-white border-gray-200 text-gray-700 hover:border-amber-400'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <Gavel className="w-6 h-6 flex-shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-sm mb-1">
                          Atos Normativos Infralegais
                        </h3>
                        <p className="text-xs opacity-80">
                          Decretos, portarias e instruções normativas
                        </p>
                        <div className="mt-2">
                          <span className="text-xs font-medium px-2 py-1 bg-white/50 rounded">
                            {legislativeActs.length} {legislativeActs.length === 1 ? 'ato' : 'atos'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Main Content - Artigos do Grupo Selecionado */}
          <div className="lg:col-span-2">
            {showAtosNormativos ? (
              <div className="bg-white rounded-2xl shadow-lg border-2 border-gray-200 p-8">
                <div className="mb-6">
                  <div className="flex items-center gap-3 mb-4">
                    <Gavel className="w-10 h-10 text-amber-600" />
                    <div className="flex-1">
                      <h2 className="text-2xl font-bold text-gray-900">
                        Atos Normativos Infralegais
                      </h2>
                      <p className="text-gray-600">
                        Decretos, portarias e instruções normativas que regulamentam a Lei 14.133/2021
                      </p>
                    </div>
                  </div>
                  <span className="flex items-center gap-1 text-sm text-gray-600">
                    <FileText className="w-4 h-4" />
                    {legislativeActs.length} {legislativeActs.length === 1 ? 'ato normativo' : 'atos normativos'}
                  </span>
                </div>

                {isLoadingActs ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-amber-600" />
                  </div>
                ) : (
                  <div className="space-y-4">
                    {legislativeActs.map((act) => {
                      const typeLabels: Record<string, string> = {
                        decreto: 'Decreto',
                        portaria: 'Portaria',
                        in: 'Instrução Normativa',
                        'ordem-servico': 'Ordem de Serviço',
                        lei: 'Lei',
                        'medida-provisoria': 'Medida Provisória',
                      };

                      return (
                        <div
                          key={act.id}
                          className="border-2 border-gray-200 rounded-xl p-5 hover:border-amber-300 transition-all"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <h3 className="font-bold text-gray-900 text-lg">
                                {act.fullNumber}
                              </h3>
                              <p className="text-sm text-gray-600 mt-1">
                                {act.title}
                              </p>
                              <p className="text-sm text-gray-500 mt-2 line-clamp-3">
                                {act.ementa}
                              </p>

                              <div className="flex items-center gap-2 mt-3 flex-wrap">
                                <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
                                  {typeLabels[act.type] || act.type}
                                </span>
                                <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                                  {act.issuer}
                                </span>
                                {act.leiArticles && act.leiArticles.length > 0 && (
                                  <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700">
                                    Art. {act.leiArticles.slice(0, 5).join(', ')}{act.leiArticles.length > 5 ? '...' : ''}
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="flex flex-col gap-2 flex-shrink-0">
                              {act.officialUrl && (
                                <a
                                  href={act.officialUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-amber-700 bg-amber-50 rounded-lg hover:bg-amber-100 transition-colors"
                                >
                                  <ExternalLink className="w-3.5 h-3.5" />
                                  Texto oficial
                                </a>
                              )}
                              {act.pdfUrl && (
                                <a
                                  href={act.pdfUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-700 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                                >
                                  <FileText className="w-3.5 h-3.5" />
                                  PDF
                                </a>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : selectedGroupData ? (
              <div className="bg-white rounded-2xl shadow-lg border-2 border-gray-200 p-8">
                <div className="mb-6">
                  <div className="flex items-center gap-3 mb-4">
                    <span className="text-4xl">
                      {getGroupEmoji(selectedGroupData.icon)}
                    </span>
                    <div className="flex-1">
                      <h2 className="text-2xl font-bold text-gray-900">
                        {selectedGroupData.title}
                      </h2>
                      <p className="text-gray-600">
                        {selectedGroupData.description}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between flex-wrap gap-4">
                    <span className="flex items-center gap-1 text-sm text-gray-600">
                      <FileText className="w-4 h-4" />
                      {selectedGroupData.articles.length} {selectedGroupData.articles.length === 1 ? 'artigo' : 'artigos'}
                    </span>

                    {/* Botões Expandir/Colapsar Todos */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setExpandAll(true)}
                        className="inline-flex items-center gap-2 px-3 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors text-sm font-medium"
                      >
                        <ChevronsDown className="w-4 h-4" />
                        Expandir Todos
                      </button>
                      <button
                        onClick={() => setExpandAll(false)}
                        className="inline-flex items-center gap-2 px-3 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors text-sm font-medium"
                      >
                        <ChevronsUp className="w-4 h-4" />
                        Colapsar Todos
                      </button>
                    </div>
                  </div>
                </div>

                <div className="space-y-3" key={expandAll ? 'expanded' : 'collapsed'}>
                  {selectedGroupData.articles.map((articleNum) => {
                    const article = artigos[articleNum];
                    if (!article) return null;

                    const colors = COLOR_CLASSES[selectedGroupData.color] || COLOR_CLASSES.gray;

                    return (
                      <CollapsibleArticle
                        key={articleNum}
                        articleNum={articleNum}
                        article={article}
                        colors={colors}
                        defaultExpanded={expandAll}
                      />
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-2xl shadow-lg border-2 border-gray-200 p-12 text-center">
                <Scale className="w-20 h-20 text-gray-300 mx-auto mb-6" />
                <h2 className="text-2xl font-bold text-gray-900 mb-4">
                  Selecione um Grupo Temático
                </h2>
                <p className="text-gray-600 mb-8 max-w-md mx-auto">
                  Escolha um dos grupos temáticos ao lado para visualizar os artigos organizados por tema.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl mx-auto">
                  <div className="p-6 bg-blue-50 rounded-xl border-2 border-blue-200">
                    <div className="text-3xl mb-2">📋</div>
                    <h3 className="font-bold text-gray-900 mb-1">Navegação Temática</h3>
                    <p className="text-sm text-gray-600">
                      21 grupos organizados por assunto
                    </p>
                  </div>

                  <div className="p-6 bg-indigo-50 rounded-xl border-2 border-indigo-200">
                    <div className="text-3xl mb-2">⚖️</div>
                    <h3 className="font-bold text-gray-900 mb-1">193 Artigos</h3>
                    <p className="text-sm text-gray-600">
                      Texto completo da lei
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
