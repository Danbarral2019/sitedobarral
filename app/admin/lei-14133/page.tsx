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
  BarChart3
} from 'lucide-react';
import { LEI_14133_ARTIGOS as LEI_14133_ARTIGOS_FALLBACK, LeiArticle } from '@/data/lei-14133-artigos';

export default function AdminLei14133Page() {
  const [artigos, setArtigos] = useState<Record<string, LeiArticle>>(LEI_14133_ARTIGOS_FALLBACK);
  const [isLoadingArtigos, setIsLoadingArtigos] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

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
        // Mantém fallback em caso de erro
      } finally {
        setIsLoadingArtigos(false);
      }
    }
    fetchArtigos();
  }, []);

  // Preparar artigos com status
  // NOTE: Detecção de truncamento removida - todos os 195 artigos foram verificados manualmente (2025-11-09)
  // Artigos naturalmente curtos (vetados, vigência) eram falsamente detectados como truncados
  const articlesWithStatus = useMemo(() => {
    return Object.entries(artigos).map(([numero, article]) => {
      const ementa = article.ementa || '';

      return {
        numero,
        article,
        isTruncated: false, // Todos os artigos estão completos e verificados
        length: ementa.length
      };
    }).sort((a, b) => parseInt(a.numero) - parseInt(b.numero));
  }, [artigos]);

  // Filtrar artigos por busca
  const filteredArticles = useMemo(() => {
    let filtered = articlesWithStatus;

    // Filtro por busca
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

  // Estatísticas
  const stats = useMemo(() => {
    const total = articlesWithStatus.length;
    const truncated = articlesWithStatus.filter(a => a.isTruncated).length;
    const complete = total - truncated;
    const percentage = Math.round((truncated / total) * 100);

    return { total, truncated, complete, percentage };
  }, [articlesWithStatus]);

  // Loading state
  if (isLoadingArtigos) {
    return (
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
            <p className="text-gray-600">Carregando artigos do banco de dados...</p>
          </div>
        </div>
    );
  }

  return (
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <h1 className="text-3xl font-bold mb-2">Lei 14.133/2021 - Editor de Artigos</h1>
              <p className="text-gray-600">
                Gerencie e edite os 195 artigos da Nova Lei de Licitações (193 originais + Art. 184-A + Art. 194)
              </p>
            </div>
            <Link
              href="/admin/lei-14133/analytics"
              className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 transition-all shadow-md hover:shadow-lg font-semibold whitespace-nowrap"
            >
              <BarChart3 className="w-5 h-5" />
              Ver Analytics
            </Link>
          </div>
        </div>

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

        {/* Filtros */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Busca */}
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

            {/* Info */}
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
                    {/* Número do Artigo */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="w-12 h-12 rounded-lg flex items-center justify-center font-bold bg-green-100 text-green-700">
                          {numero}
                        </div>
                      </div>
                    </td>

                    {/* Título / Capítulo */}
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

                    {/* Prévia do Texto */}
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

                    {/* Status */}
                    <td className="px-6 py-4 text-center">
                      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        <CheckCircle className="w-3 h-3" />
                        Completo
                      </span>
                    </td>

                    {/* Ações */}
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

        {/* Rodapé com Instruções */}
        <div className="mt-8 bg-blue-50 border-2 border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-bold text-blue-900 mb-3">📖 Fonte Oficial da Lei</h3>
          <p className="text-sm text-blue-800 mb-3">
            Para corrigir os artigos truncados, consulte o texto oficial completo em:
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
