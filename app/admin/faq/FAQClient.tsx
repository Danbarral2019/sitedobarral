'use client';

/**
 * FAQ Admin Client Component (Fase 7)
 * Layout customizado de cards com ações inline
 */

import { useState } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import {
  Search, Plus, Edit2, Trash2, Eye, EyeOff, HelpCircle,
  Filter, BarChart3, ThumbsUp, ThumbsDown
} from 'lucide-react';
import { PaginatedResult } from '@/lib/types/admin-list';
import { FAQ } from '@/lib/faq';
import { buildSearchParams } from '@/lib/url-state';
import { useToast } from '@/hooks/use-toast';

interface FAQClientProps {
  initialData: PaginatedResult<FAQ>;
  categories: string[];
  stats: {
    total: number;
    published: number;
    totalViews: number;
    totalHelpful: number;
  };
}

export function FAQClient({ initialData, categories, stats }: FAQClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { success, error: errorToast } = useToast();

  const [searchTerm, setSearchTerm] = useState(searchParams.get('search') || '');

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      'acesso': 'bg-blue-100 text-blue-800',
      'curso': 'bg-green-100 text-green-800',
      'certificado': 'bg-purple-100 text-purple-800',
      'pagamento': 'bg-yellow-100 text-yellow-800',
      'suporte': 'bg-orange-100 text-orange-800',
      'geral': 'bg-gray-100 text-gray-800',
    };
    return colors[category] || 'bg-gray-100 text-gray-800';
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const query = buildSearchParams(searchParams, { search: searchTerm || null, page: null });
    router.replace(`${pathname}?${query}`);
  };

  const handleCategoryChange = (category: string) => {
    const query = buildSearchParams(searchParams, { category, page: null });
    router.replace(`${pathname}?${query}`);
  };

  const handlePublishedToggle = (checked: boolean) => {
    const query = buildSearchParams(searchParams, {
      isPublished: checked ? 'true' : null,
      page: null
    });
    router.replace(`${pathname}?${query}`);
  };

  const handleTogglePublish = async (faq: FAQ) => {
    try {
      const response = await fetch(`/api/admin/faq/${faq.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPublished: faq.isPublished })
      });

      if (!response.ok) {
        throw new Error('Failed to toggle publish status');
      }

      success(
        'Status atualizado!',
        `FAQ ${faq.isPublished ? 'despublicada' : 'publicada'} com sucesso.`
      );
      router.refresh();
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
      errorToast('Erro ao atualizar', 'Tente novamente.');
    }
  };

  const handleDelete = async (faq: FAQ) => {
    if (!confirm(`Tem certeza que deseja deletar a FAQ:\n\n"${faq.question}"?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/faq/${faq.id}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        throw new Error('Failed to delete FAQ');
      }

      success('FAQ deletada!', 'A FAQ foi removida com sucesso.');
      router.refresh();
    } catch (error) {
      console.error('Erro ao deletar FAQ:', error);
      errorToast('Erro ao deletar', 'Tente novamente.');
    }
  };

  const selectedCategory = searchParams.get('category') || 'all';
  const showPublishedOnly = searchParams.get('isPublished') === 'true';

  return (
    <div className="p-6 md:p-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl flex items-center justify-center">
              <HelpCircle className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Gerenciar FAQ</h1>
              <p className="text-gray-600">
                {initialData.total} {initialData.total === 1 ? 'pergunta' : 'perguntas'}
              </p>
            </div>
          </div>

          <button
            onClick={() => router.push('/admin/faq/new')}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-5 h-5" />
            Nova FAQ
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg p-4 border-2 border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total</p>
                <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
              </div>
              <HelpCircle className="w-8 h-8 text-blue-600" />
            </div>
          </div>

          <div className="bg-white rounded-lg p-4 border-2 border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Publicadas</p>
                <p className="text-2xl font-bold text-green-600">{stats.published}</p>
              </div>
              <Eye className="w-8 h-8 text-green-600" />
            </div>
          </div>

          <div className="bg-white rounded-lg p-4 border-2 border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Visualizações</p>
                <p className="text-2xl font-bold text-purple-600">{stats.totalViews}</p>
              </div>
              <BarChart3 className="w-8 h-8 text-purple-600" />
            </div>
          </div>

          <div className="bg-white rounded-lg p-4 border-2 border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Útil</p>
                <p className="text-2xl font-bold text-orange-600">{stats.totalHelpful}</p>
              </div>
              <ThumbsUp className="w-8 h-8 text-orange-600" />
            </div>
          </div>
        </div>

        {/* Filtros */}
        <div className="bg-white rounded-xl border-2 border-gray-200 p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Busca */}
            <form onSubmit={handleSearchSubmit} className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar pergunta ou resposta..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </form>

            {/* Categoria */}
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <select
                value={selectedCategory}
                onChange={(e) => handleCategoryChange(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none"
              >
                <option value="all">Todas as Categorias</option>
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            {/* Toggle Publicadas */}
            <label className="flex items-center gap-3 px-4 py-2 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors">
              <input
                type="checkbox"
                checked={showPublishedOnly}
                onChange={(e) => handlePublishedToggle(e.target.checked)}
                className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-sm font-medium text-gray-700">Apenas publicadas</span>
            </label>
          </div>
        </div>
      </div>

      {/* Lista de FAQs */}
      {initialData.items.length === 0 ? (
        <div className="bg-gray-50 rounded-xl p-12 text-center">
          <HelpCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-gray-900 mb-2">Nenhuma FAQ encontrada</h3>
          <p className="text-gray-600 mb-6">
            {searchTerm ? 'Tente ajustar os filtros de busca' : 'Comece criando sua primeira FAQ'}
          </p>
          {!searchTerm && (
            <button
              onClick={() => router.push('/admin/faq/new')}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Criar Primeira FAQ
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {initialData.items.map((faq) => (
            <div
              key={faq.id}
              className="bg-white rounded-xl border-2 border-gray-200 p-6 hover:shadow-lg transition-shadow"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  {/* Pergunta */}
                  <div className="flex items-start gap-3 mb-3">
                    <span className="text-3xl">❓</span>
                    <h3 className="text-lg font-bold text-gray-900 flex-1">{faq.question}</h3>
                  </div>

                  {/* Resposta (preview) */}
                  <p className="text-gray-600 mb-4 line-clamp-2">
                    {faq.answer.substring(0, 150)}...
                  </p>

                  {/* Meta info */}
                  <div className="flex flex-wrap items-center gap-3">
                    <span className={`px-3 py-1 text-xs font-bold rounded-full ${getCategoryColor(faq.category)}`}>
                      {faq.category}
                    </span>

                    <span className="flex items-center gap-1 text-sm text-gray-600">
                      <Eye className="w-4 h-4" />
                      {faq.views} visualizações
                    </span>

                    <span className="flex items-center gap-1 text-sm text-green-600">
                      <ThumbsUp className="w-4 h-4" />
                      {faq.helpfulCount}
                    </span>

                    <span className="flex items-center gap-1 text-sm text-red-600">
                      <ThumbsDown className="w-4 h-4" />
                      {faq.notHelpfulCount}
                    </span>

                    {faq.tags && faq.tags.length > 0 && (
                      <div className="flex items-center gap-1">
                        {faq.tags.slice(0, 3).map((tag, idx) => (
                          <span key={idx} className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded">
                            #{tag}
                          </span>
                        ))}
                        {faq.tags.length > 3 && (
                          <span className="text-xs text-gray-500">+{faq.tags.length - 3}</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Ações */}
                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => handleTogglePublish(faq)}
                    className={`p-2 rounded-lg transition-colors ${
                      faq.isPublished
                        ? 'bg-green-100 text-green-600 hover:bg-green-200'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                    title={faq.isPublished ? 'Despublicar' : 'Publicar'}
                  >
                    {faq.isPublished ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
                  </button>

                  <button
                    onClick={() => router.push(`/admin/faq/${faq.id}/edit`)}
                    className="p-2 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200 transition-colors"
                    title="Editar"
                  >
                    <Edit2 className="w-5 h-5" />
                  </button>

                  <button
                    onClick={() => handleDelete(faq)}
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
  );
}
