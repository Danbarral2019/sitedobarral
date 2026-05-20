'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  LinkIcon,
  Search,
  Loader2,
  CheckCircle,
  FileText,
  AlertTriangle,
} from 'lucide-react';

interface DocumentItem {
  id: string;
  title: string;
  category: string;
  leiArticles: string | null;
  courseId: string | null;
}

const CATEGORIES = [
  { value: '', label: 'Todas categorias' },
  { value: 'apostila', label: 'Apostila' },
  { value: 'acordao', label: 'Acordao' },
  { value: 'parecer', label: 'Parecer' },
  { value: 'orientacao-normativa', label: 'Orientacao Normativa (AGU)' },
  { value: 'enunciados', label: 'Enunciados' },
  { value: 'sumula', label: 'Sumula' },
  { value: 'edital', label: 'Edital' },
  { value: 'artigo', label: 'Artigo' },
  { value: 'outro', label: 'Outro' },
];

import { parseLeiArticles, stringifyLeiArticles, getLeiArticles } from '@/lib/lei-articles';

export default function BulkLinkerPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [articleNumber, setArticleNumber] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isLinking, setIsLinking] = useState(false);
  const [linkResults, setLinkResults] = useState<{ success: number; failed: number } | null>(null);

  // Verify admin auth
  useEffect(() => {
    async function verifyAdmin() {
      try {
        const response = await fetch('/api/auth/verify');
        if (!response.ok) {
          router.push('/validar-acesso');
          return;
        }
        const data = await response.json();
        if (data.user.role !== 'admin') {
          router.push('/area-restrita');
          return;
        }
      } catch {
        router.push('/validar-acesso');
      }
    }
    verifyAdmin();
  }, [router]);

  // Fetch all documents
  useEffect(() => {
    async function fetchDocuments() {
      try {
        const res = await fetch('/api/admin/documents?pageSize=2000');
        if (res.ok) {
          const data = await res.json();
          setDocuments(data.documents || []);
        }
      } catch (error) {
        console.error('Erro ao buscar documentos:', error);
      } finally {
        setIsLoading(false);
      }
    }
    fetchDocuments();
  }, []);

  // Filter documents that DON'T already have the selected article
  const filteredDocs = useMemo(() => {
    if (!articleNumber) return [];
    return documents.filter(doc => {
      const existing = getLeiArticles(doc);
      if (existing.includes(articleNumber)) return false;
      if (filterCategory && doc.category !== filterCategory) return false;
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        if (!doc.title.toLowerCase().includes(term)) return false;
      }
      return true;
    });
  }, [documents, articleNumber, filterCategory, searchTerm]);

  // Count of docs already linked to this article
  const alreadyLinkedCount = useMemo(() => {
    if (!articleNumber) return 0;
    return documents.filter(doc => {
      const existing = getLeiArticles(doc);
      return existing.includes(articleNumber);
    }).length;
  }, [documents, articleNumber]);

  const toggleSelect = useCallback((id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    if (selected.size === filteredDocs.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filteredDocs.map(d => d.id)));
    }
  }, [filteredDocs, selected.size]);

  const handleBulkLink = useCallback(async () => {
    if (!articleNumber || selected.size === 0) return;
    setIsLinking(true);
    setLinkResults(null);

    let success = 0;
    let failed = 0;

    for (const docId of Array.from(selected)) {
      try {
        const doc = documents.find(d => d.id === docId);
        if (!doc) { failed++; continue; }

        const existingArticles = getLeiArticles(doc);
        const updatedArticles = [...existingArticles, articleNumber];

        const res = await fetch(`/api/admin/documents/${docId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ leiArticles: updatedArticles }),
        });

        if (res.ok) {
          success++;
          // Update local state to reflect the change
          setDocuments(prev => prev.map(d =>
            d.id === docId
              ? { ...d, leiArticles: stringifyLeiArticles(updatedArticles) }
              : d
          ));
        } else {
          failed++;
        }
      } catch {
        failed++;
      }
    }

    setLinkResults({ success, failed });
    setSelected(new Set());
    setIsLinking(false);
  }, [articleNumber, selected, documents]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-green-600 mx-auto mb-4" />
          <p className="text-gray-600">Carregando documentos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <Link
          href="/admin/lei-14133"
          className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar ao Editor de Artigos
        </Link>
        <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
          <LinkIcon className="w-8 h-8 text-green-600" />
          Bulk Document Linker
        </h1>
        <p className="text-gray-600">
          Vincule documentos em lote a artigos da Lei 14.133/2021
        </p>
      </div>

      {/* Article Selector */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4">1. Selecione o Artigo</h2>
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-xs">
            <input
              type="number"
              min="1"
              max="194"
              placeholder="Numero do artigo (1-194)"
              value={articleNumber}
              onChange={(e) => {
                const val = e.target.value;
                if (val === '' || (parseInt(val) >= 1 && parseInt(val) <= 194)) {
                  setArticleNumber(val);
                  setSelected(new Set());
                  setLinkResults(null);
                }
              }}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-lg"
            />
          </div>
          {articleNumber && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <FileText className="w-4 h-4" />
              <span><strong>{alreadyLinkedCount}</strong> docs ja vinculados</span>
              <span className="text-gray-400">|</span>
              <span><strong>{filteredDocs.length}</strong> docs disponiveis</span>
            </div>
          )}
        </div>
      </div>

      {/* Filters + Documents */}
      {articleNumber && (
        <>
          {/* Filters */}
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">2. Filtre e Selecione Documentos</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Buscar por titulo..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              >
                {CATEGORIES.map(c => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
              <button
                onClick={toggleAll}
                className="px-4 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
              >
                {selected.size === filteredDocs.length && filteredDocs.length > 0
                  ? 'Desmarcar Todos'
                  : `Selecionar Todos (${filteredDocs.length})`}
              </button>
            </div>
          </div>

          {/* Results notification */}
          {linkResults && (
            <div className={`rounded-lg p-4 mb-6 ${linkResults.failed > 0 ? 'bg-yellow-50 border border-yellow-200' : 'bg-green-50 border border-green-200'}`}>
              <div className="flex items-center gap-2">
                {linkResults.failed > 0
                  ? <AlertTriangle className="w-5 h-5 text-yellow-600" />
                  : <CheckCircle className="w-5 h-5 text-green-600" />
                }
                <span className="font-medium">
                  {linkResults.success} documentos vinculados com sucesso ao Art. {articleNumber}
                  {linkResults.failed > 0 && ` (${linkResults.failed} falharam)`}
                </span>
              </div>
            </div>
          )}

          {/* Document List */}
          <div className="bg-white rounded-lg shadow-md overflow-hidden mb-6">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left w-12">
                      <input
                        type="checkbox"
                        checked={selected.size === filteredDocs.length && filteredDocs.length > 0}
                        onChange={toggleAll}
                        className="w-4 h-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                      />
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Titulo</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Categoria</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Artigos Vinculados</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredDocs.slice(0, 200).map(doc => {
                    const existing = getLeiArticles(doc);
                    return (
                      <tr
                        key={doc.id}
                        className={`hover:bg-gray-50 transition-colors cursor-pointer ${selected.has(doc.id) ? 'bg-green-50' : ''}`}
                        onClick={() => toggleSelect(doc.id)}
                      >
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={selected.has(doc.id)}
                            onChange={() => toggleSelect(doc.id)}
                            className="w-4 h-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-sm font-medium text-gray-900 line-clamp-2">{doc.title}</p>
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                            {doc.category}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {existing.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {existing.slice(0, 5).map(a => (
                                <span key={a} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                                  Art. {a}
                                </span>
                              ))}
                              {existing.length > 5 && (
                                <span className="text-xs text-gray-500">+{existing.length - 5}</span>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400">Nenhum</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {filteredDocs.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                <FileText className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">Nenhum documento disponivel</p>
                <p className="text-sm">Todos os documentos ja estao vinculados a este artigo ou nenhum corresponde aos filtros</p>
              </div>
            )}

            {filteredDocs.length > 200 && (
              <div className="text-center py-4 text-sm text-gray-500 border-t">
                Mostrando 200 de {filteredDocs.length} documentos. Refine os filtros para ver mais.
              </div>
            )}
          </div>

          {/* Link Button */}
          {selected.size > 0 && (
            <div className="sticky bottom-4 z-10">
              <div className="bg-white rounded-lg shadow-lg border-2 border-green-500 p-4 flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">
                  {selected.size} documento{selected.size !== 1 ? 's' : ''} selecionado{selected.size !== 1 ? 's' : ''}
                </span>
                <button
                  onClick={handleBulkLink}
                  disabled={isLinking}
                  className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg hover:from-green-700 hover:to-emerald-700 transition-all font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLinking ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Vinculando...
                    </>
                  ) : (
                    <>
                      <LinkIcon className="w-5 h-5" />
                      Vincular Selecionados ao Art. {articleNumber}
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
