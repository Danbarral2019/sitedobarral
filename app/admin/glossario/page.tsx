'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AdminLayout from '@/components/AdminLayout';
import {
  Search, Plus, Edit2, Trash2, Eye, EyeOff, BookOpen,
  Filter, BarChart3, Scale, Loader2
} from 'lucide-react';

interface GlossaryTerm {
  id: string;
  term: string;
  slug: string;
  shortDef?: string;
  longDef: string;
  category: string;
  legalBasis?: string;
  order: number;
  isPublished: boolean;
  tags: string[];
  views: number;
  createdAt: string;
  updatedAt: string;
}

export default function GlossarioAdminPage() {
  const router = useRouter();
  const [terms, setTerms] = useState<GlossaryTerm[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [showPublishedOnly, setShowPublishedOnly] = useState(false);

  useEffect(() => {
    loadTerms();
  }, []);

  const loadTerms = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/admin/glossary');
      if (response.ok) {
        const data = await response.json();
        setTerms(data.terms || []);
      } else {
        console.error('Erro ao carregar termos');
      }
    } catch (error) {
      console.error('Erro ao carregar termos:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: string, term: string) => {
    if (!confirm(`Tem certeza que deseja deletar o termo:\n\n"${term}"?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/glossary/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        alert('Termo deletado com sucesso!');
        loadTerms();
      } else {
        alert('Erro ao deletar termo');
      }
    } catch (error) {
      console.error('Erro ao deletar termo:', error);
      alert('Erro ao deletar termo');
    }
  };

  const handleTogglePublish = async (termData: GlossaryTerm) => {
    try {
      const response = await fetch(`/api/admin/glossary/${termData.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...termData,
          isPublished: !termData.isPublished,
        }),
      });

      if (response.ok) {
        loadTerms();
      } else {
        alert('Erro ao atualizar status');
      }
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
      alert('Erro ao atualizar status');
    }
  };

  const filteredTerms = terms.filter(term => {
    const matchesSearch = term.term.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         term.longDef.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (term.shortDef && term.shortDef.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesCategory = selectedCategory === 'all' || term.category === selectedCategory;
    const matchesPublished = !showPublishedOnly || term.isPublished;

    return matchesSearch && matchesCategory && matchesPublished;
  });

  const categories = Array.from(new Set(terms.map(t => t.category))).sort();

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      'licitacao': 'bg-blue-100 text-blue-800',
      'contrato': 'bg-green-100 text-green-800',
      'fiscalizacao': 'bg-purple-100 text-purple-800',
      'planejamento': 'bg-yellow-100 text-yellow-800',
      'sancionamento': 'bg-red-100 text-red-800',
      'conceitos-gerais': 'bg-gray-100 text-gray-800',
    };
    return colors[category] || 'bg-gray-100 text-gray-800';
  };

  return (
    <AdminLayout>
      <div className="p-6 md:p-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-purple-600 to-indigo-600 rounded-xl flex items-center justify-center">
                <BookOpen className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Gerenciar Glossário</h1>
                <p className="text-gray-600">
                  {filteredTerms.length} {filteredTerms.length === 1 ? 'termo' : 'termos'}
                  {searchTerm && ' encontrado(s)'}
                </p>
              </div>
            </div>

            <button
              onClick={() => router.push('/admin/glossario/new')}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              <Plus className="w-5 h-5" />
              Novo Termo
            </button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-lg p-4 border-2 border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total</p>
                  <p className="text-2xl font-bold text-gray-900">{terms.length}</p>
                </div>
                <BookOpen className="w-8 h-8 text-purple-600" />
              </div>
            </div>

            <div className="bg-white rounded-lg p-4 border-2 border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Publicados</p>
                  <p className="text-2xl font-bold text-green-600">
                    {terms.filter(t => t.isPublished).length}
                  </p>
                </div>
                <Eye className="w-8 h-8 text-green-600" />
              </div>
            </div>

            <div className="bg-white rounded-lg p-4 border-2 border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Visualizações</p>
                  <p className="text-2xl font-bold text-indigo-600">
                    {terms.reduce((acc, t) => acc + t.views, 0)}
                  </p>
                </div>
                <BarChart3 className="w-8 h-8 text-indigo-600" />
              </div>
            </div>

            <div className="bg-white rounded-lg p-4 border-2 border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Com Base Legal</p>
                  <p className="text-2xl font-bold text-orange-600">
                    {terms.filter(t => t.legalBasis).length}
                  </p>
                </div>
                <Scale className="w-8 h-8 text-orange-600" />
              </div>
            </div>
          </div>

          {/* Filtros */}
          <div className="bg-white rounded-xl border-2 border-gray-200 p-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Busca */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Buscar termo ou definição..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>

              {/* Categoria */}
              <div className="relative">
                <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent appearance-none"
                >
                  <option value="all">Todas as Categorias</option>
                  {categories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              {/* Toggle Publicados */}
              <label className="flex items-center gap-3 px-4 py-2 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors">
                <input
                  type="checkbox"
                  checked={showPublishedOnly}
                  onChange={(e) => setShowPublishedOnly(e.target.checked)}
                  className="w-5 h-5 text-purple-600 rounded focus:ring-2 focus:ring-purple-500"
                />
                <span className="text-sm font-medium text-gray-700">Apenas publicados</span>
              </label>
            </div>
          </div>
        </div>

        {/* Lista de Termos */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
          </div>
        ) : filteredTerms.length === 0 ? (
          <div className="bg-gray-50 rounded-xl p-12 text-center">
            <BookOpen className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-gray-900 mb-2">Nenhum termo encontrado</h3>
            <p className="text-gray-600 mb-6">
              {searchTerm
                ? 'Tente ajustar os filtros de busca'
                : 'Comece criando seu primeiro termo'}
            </p>
            {!searchTerm && (
              <button
                onClick={() => router.push('/admin/glossario/new')}
                className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
              >
                Criar Primeiro Termo
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {filteredTerms.map((term) => (
              <div
                key={term.id}
                className="bg-white rounded-xl border-2 border-gray-200 p-6 hover:shadow-lg transition-shadow"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    {/* Termo */}
                    <div className="flex items-start gap-3 mb-3">
                      <span className="text-3xl">📖</span>
                      <div className="flex-1">
                        <h3 className="text-lg font-bold text-gray-900">
                          {term.term}
                        </h3>
                        {term.shortDef && (
                          <p className="text-sm text-gray-600 italic mt-1">
                            {term.shortDef}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Definição (preview) */}
                    <p className="text-gray-600 mb-3 line-clamp-2">
                      {term.longDef.substring(0, 150)}...
                    </p>

                    {/* Meta info */}
                    <div className="flex flex-wrap items-center gap-3">
                      <span className={`px-3 py-1 text-xs font-bold rounded-full ${getCategoryColor(term.category)}`}>
                        {term.category}
                      </span>

                      <span className="flex items-center gap-1 text-sm text-gray-600">
                        <Eye className="w-4 h-4" />
                        {term.views} visualizações
                      </span>

                      {term.legalBasis && (
                        <span className="flex items-center gap-1 text-sm text-orange-600">
                          <Scale className="w-4 h-4" />
                          {term.legalBasis}
                        </span>
                      )}

                      <span className="text-sm text-gray-500">
                        /{term.slug}
                      </span>

                      {term.tags && term.tags.length > 0 && (
                        <div className="flex items-center gap-1">
                          {term.tags.slice(0, 3).map((tag, idx) => (
                            <span
                              key={idx}
                              className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded"
                            >
                              #{tag}
                            </span>
                          ))}
                          {term.tags.length > 3 && (
                            <span className="text-xs text-gray-500">
                              +{term.tags.length - 3}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Ações */}
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={() => handleTogglePublish(term)}
                      className={`p-2 rounded-lg transition-colors ${
                        term.isPublished
                          ? 'bg-green-100 text-green-600 hover:bg-green-200'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                      title={term.isPublished ? 'Despublicar' : 'Publicar'}
                    >
                      {term.isPublished ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
                    </button>

                    <button
                      onClick={() => router.push(`/admin/glossario/${term.id}/edit`)}
                      className="p-2 bg-purple-100 text-purple-600 rounded-lg hover:bg-purple-200 transition-colors"
                      title="Editar"
                    >
                      <Edit2 className="w-5 h-5" />
                    </button>

                    <button
                      onClick={() => handleDelete(term.id, term.term)}
                      className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors"
                      title="Deletar"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
