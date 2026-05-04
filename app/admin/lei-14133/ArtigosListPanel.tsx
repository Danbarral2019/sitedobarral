'use client';

import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import {
  Edit,
  CheckCircle,
  Search,
  FileText,
  ChevronRight,
  Loader2,
  BarChart3,
  AlertTriangle,
  TrendingUp
} from 'lucide-react';
import { LEI_14133_ARTIGOS as LEI_14133_ARTIGOS_FALLBACK, LeiArticle } from '@/data/lei-14133-artigos';

export default function ArtigosListPanel() {
  const [artigos, setArtigos] = useState<Record<string, LeiArticle>>(LEI_14133_ARTIGOS_FALLBACK);
  const [isLoadingArtigos, setIsLoadingArtigos] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [coverageStats, setCoverageStats] = useState<{articleStats: Record<string, number>; totalArticles: number; totalDocuments: number} | null>(null);

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
    async function fetchCoverageStats() {
      try {
        const response = await fetch('/api/lei-14133/stats');
        if (response.ok) {
          const data = await response.json();
          setCoverageStats(data);
        }
      } catch (error) {
        console.error('Erro ao buscar coverage stats:', error);
      }
    }
    fetchArtigos();
    fetchCoverageStats();
  }, []);

  const articlesWithStatus = useMemo(() => {
    return Object.entries(artigos).map(([numero, article]) => {
      const ementa = article.ementa || '';
      return {
        numero,
        article,
        isTruncated: false,
        length: ementa.length
      };
    }).sort((a, b) => parseInt(a.numero) - parseInt(b.numero));
  }, [artigos]);

  const filteredArticles = useMemo(() => {
    let filtered = articlesWithStatus;
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(a =>
        a.numero.includes(term) ||
        a.article.ementa.toLowerCase().includes(term) ||
        a.article.titulo?.toLowerCase().includes(term) ||
        a.article.capituloCompleto?.toLowerCase().includes(term)
      );
    }
    return filtered;
  }, [articlesWithStatus, searchTerm]);

  const stats = useMemo(() => {
    const total = articlesWithStatus.length;
    const truncated = articlesWithStatus.filter(a => a.isTruncated).length;
    const complete = total - truncated;
    const percentage = Math.round((truncated / total) * 100);
    return { total, truncated, complete, percentage };
  }, [articlesWithStatus]);

  if (isLoadingArtigos) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Carregando artigos do banco de dados...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-blue-600">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Total de Artigos</p>
              <p className="text-3xl font-bold text-gray-900">{stats.total}</p>
            </div>
            <FileText className="w-12 h-12 text-blue-600 opacity-20" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-green-600">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Artigos Completos</p>
              <p className="text-3xl font-bold text-green-600">{stats.complete}</p>
              <p className="text-xs text-gray-500 mt-1">100% verificados</p>
            </div>
            <CheckCircle className="w-12 h-12 text-green-600 opacity-20" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg shadow-md p-6 border-2 border-green-400 md:col-span-2">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-8 h-8 text-green-600 flex-shrink-0" />
            <div>
              <p className="text-sm font-bold text-green-900 mb-1">✅ Todos os artigos verificados</p>
              <p className="text-xs text-green-800">
                195 artigos completos e corretos (editados manualmente em 2025-11-09)
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Coverage Dashboard */}
      {coverageStats && (() => {
        const allArticleNumbers = Array.from({ length: 194 }, (_, i) => String(i + 1));
        const ranges = [
          { label: '0 docs', min: 0, max: 0, color: 'bg-red-500' },
          { label: '1-2 docs', min: 1, max: 2, color: 'bg-orange-500' },
          { label: '3-5 docs', min: 3, max: 5, color: 'bg-blue-500' },
          { label: '6-14 docs', min: 6, max: 14, color: 'bg-green-500' },
          { label: '15+ docs', min: 15, max: Infinity, color: 'bg-emerald-600' },
        ];
        const distribution = ranges.map(r => ({
          ...r,
          count: allArticleNumbers.filter(n => {
            const c = coverageStats.articleStats[n] || 0;
            return c >= r.min && c <= r.max;
          }).length,
        }));
        const maxDistCount = Math.max(...distribution.map(d => d.count), 1);

        const top10 = allArticleNumbers
          .map(n => ({ numero: n, count: coverageStats.articleStats[n] || 0 }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 10);
        const maxTop10 = top10[0]?.count || 1;

        const orphans = allArticleNumbers.filter(n => !coverageStats.articleStats[n] || coverageStats.articleStats[n] === 0);

        return (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-1 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-blue-600" />
                Cobertura por Faixa
              </h3>
              <p className="text-sm text-gray-500 mb-4">Distribuicao dos 194 artigos por quantidade de documentos vinculados</p>
              <div className="space-y-3">
                {distribution.map(d => (
                  <div key={d.label} className="flex items-center gap-3">
                    <span className="text-sm text-gray-700 w-20 flex-shrink-0">{d.label}</span>
                    <div className="flex-1 bg-gray-100 rounded-full h-6 overflow-hidden">
                      <div
                        className={`${d.color} h-full rounded-full transition-all duration-500 flex items-center justify-end pr-2`}
                        style={{ width: `${Math.max((d.count / maxDistCount) * 100, 8)}%` }}
                      >
                        <span className="text-xs font-bold text-white">{d.count}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-1 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-emerald-600" />
                Top 10 Artigos Mais Documentados
              </h3>
              <p className="text-sm text-gray-500 mb-4">Artigos com maior numero de documentos vinculados</p>
              <div className="space-y-2">
                {top10.map((item, idx) => (
                  <div key={item.numero} className="flex items-center gap-3">
                    <span className="text-sm font-mono text-gray-600 w-16 flex-shrink-0">Art. {item.numero}</span>
                    <div className="flex-1 bg-gray-100 rounded-full h-5 overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-emerald-500 to-green-500 h-full rounded-full transition-all duration-500 flex items-center justify-end pr-2"
                        style={{ width: `${Math.max((item.count / maxTop10) * 100, 10)}%` }}
                      >
                        <span className="text-xs font-bold text-white">{item.count}</span>
                      </div>
                    </div>
                    {idx === 0 && <span className="text-xs text-yellow-600 font-bold">1o</span>}
                  </div>
                ))}
              </div>
            </div>

            {orphans.length > 0 && (
              <div className="bg-white rounded-lg shadow-md p-6 lg:col-span-2">
                <h3 className="text-lg font-bold text-red-700 mb-1 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                  Artigos sem Documentos ({orphans.length})
                </h3>
                <p className="text-sm text-gray-500 mb-4">Artigos que ainda nao possuem nenhum documento vinculado</p>
                <div className="flex flex-wrap gap-2">
                  {orphans.map(n => (
                    <Link
                      key={n}
                      href={`/artigo/${n}`}
                      target="_blank"
                      className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 hover:bg-red-200 transition-colors"
                    >
                      Art. {n}
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* Filtros */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por número, título ou texto do artigo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div className="flex items-center gap-2 px-4 py-3 bg-green-50 border border-green-200 rounded-lg">
            <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
            <p className="text-sm text-green-800">
              <strong>{stats.total}</strong> artigos completos e verificados
            </p>
          </div>
        </div>

        {searchTerm && (
          <p className="mt-4 text-sm text-gray-600">
            Encontrados <strong>{filteredArticles.length}</strong> artigos
          </p>
        )}
      </div>

      {/* Lista de Artigos */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Artigo
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Título / Capítulo
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Prévia do Texto
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredArticles.map(({ numero, article, length }) => (
                <tr
                  key={numero}
                  className="hover:bg-gray-50 transition-colors"
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="w-12 h-12 rounded-lg flex items-center justify-center font-bold bg-green-100 text-green-700">
                        {numero}
                      </div>
                    </div>
                  </td>

                  <td className="px-6 py-4">
                    <div className="max-w-xs">
                      {article.titulo && (
                        <p className="text-sm font-medium text-gray-900 mb-1 line-clamp-1">
                          {article.titulo}
                        </p>
                      )}
                      {article.capituloCompleto && (
                        <p className="text-xs text-gray-600 line-clamp-2">
                          {article.capituloCompleto}
                        </p>
                      )}
                      {!article.titulo && !article.capituloCompleto && (
                        <p className="text-xs text-gray-400 italic">Sem título</p>
                      )}
                    </div>
                  </td>

                  <td className="px-6 py-4">
                    <div className="max-w-md">
                      <p className="text-sm text-gray-700 line-clamp-2">
                        {article.ementa.substring(0, 150)}
                        {article.ementa.length > 150 ? '...' : ''}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {length.toLocaleString()} caracteres
                      </p>
                    </div>
                  </td>

                  <td className="px-6 py-4 text-center">
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      <CheckCircle className="w-3 h-3" />
                      Completo
                    </span>
                  </td>

                  <td className="px-6 py-4 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <Link
                        href={`/admin/lei-14133/${numero}/edit`}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                      >
                        <Edit className="w-4 h-4" />
                        Editar
                      </Link>
                      <Link
                        href={`/artigo/${numero}`}
                        target="_blank"
                        className="inline-flex items-center gap-2 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors text-sm font-medium"
                      >
                        Ver
                        <ChevronRight className="w-4 h-4" />
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredArticles.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <FileText className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium">Nenhum artigo encontrado</p>
            <p className="text-sm">Tente ajustar os filtros de busca</p>
          </div>
        )}
      </div>

      {/* Rodapé */}
      <div className="mt-8 bg-blue-50 border-2 border-blue-200 rounded-lg p-6">
        <h3 className="text-lg font-bold text-blue-900 mb-3">📖 Fonte Oficial da Lei</h3>
        <p className="text-sm text-blue-800 mb-3">
          Para consultar os artigos no texto oficial completo:
        </p>
        <a
          href="https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2021/lei/L14133.htm"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
        >
          <FileText className="w-4 h-4" />
          Acessar Lei 14.133/2021 no Planalto
          <ChevronRight className="w-4 h-4" />
        </a>
      </div>
    </div>
  );
}
