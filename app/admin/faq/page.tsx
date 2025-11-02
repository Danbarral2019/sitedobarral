'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AdminLayout from '@/components/AdminLayout';
import {
  Search, Plus, Edit2, Trash2, Eye, EyeOff, HelpCircle,
  Filter, BarChart3, ThumbsUp, ThumbsDown, Loader2
} from 'lucide-react';

interface FAQ {
  id: string;
  question: string;
  answer: string;
  category: string;
  order: number;
  isPublished: boolean;
  tags: string[];
  views: number;
  helpfulCount: number;
  notHelpfulCount: number;
  createdAt: string;
  updatedAt: string;
}

export default function FAQAdminPage() {
  const router = useRouter();
  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [showPublishedOnly, setShowPublishedOnly] = useState(false);

  useEffect(() => {
    loadFAQs();
  }, []);

  const loadFAQs = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/admin/faq');
      if (response.ok) {
        const data = await response.json();
        setFaqs(data.faqs || []);
      } else {
        console.error('Erro ao carregar FAQs');
      }
    } catch (error) {
      console.error('Erro ao carregar FAQs:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: string, question: string) => {
    if (!confirm(`Tem certeza que deseja deletar a FAQ:\n\n"${question}"?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/faq/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        alert('FAQ deletada com sucesso!');
        loadFAQs();
      } else {
        alert('Erro ao deletar FAQ');
      }
    } catch (error) {
      console.error('Erro ao deletar FAQ:', error);
      alert('Erro ao deletar FAQ');
    }
  };

  const handleTogglePublish = async (faq: FAQ) => {
    try {
      const response = await fetch(`/api/admin/faq/${faq.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...faq,
          isPublished: !faq.isPublished,
        }),
      });

      if (response.ok) {
        loadFAQs();
      } else {
        alert('Erro ao atualizar status');
      }
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
      alert('Erro ao atualizar status');
    }
  };

  const filteredFAQs = faqs.filter(faq => {
    const matchesSearch = faq.question.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         faq.answer.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || faq.category === selectedCategory;
    const matchesPublished = !showPublishedOnly || faq.isPublished;

    return matchesSearch && matchesCategory && matchesPublished;
  });

  const categories = Array.from(new Set(faqs.map(f => f.category))).sort();

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

  return (
    <AdminLayout>
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
                  {filteredFAQs.length} {filteredFAQs.length === 1 ? 'pergunta' : 'perguntas'}
                  {searchTerm && ' encontrada(s)'}
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
                  <p className="text-2xl font-bold text-gray-900">{faqs.length}</p>
                </div>
                <HelpCircle className="w-8 h-8 text-blue-600" />
              </div>
            </div>

            <div className="bg-white rounded-lg p-4 border-2 border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Publicadas</p>
                  <p className="text-2xl font-bold text-green-600">
                    {faqs.filter(f => f.isPublished).length}
                  </p>
                </div>
                <Eye className="w-8 h-8 text-green-600" />
              </div>
            </div>

            <div className="bg-white rounded-lg p-4 border-2 border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Visualizações</p>
                  <p className="text-2xl font-bold text-purple-600">
                    {faqs.reduce((acc, f) => acc + f.views, 0)}
                  </p>
                </div>
                <BarChart3 className="w-8 h-8 text-purple-600" />
              </div>
            </div>

            <div className="bg-white rounded-lg p-4 border-2 border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Útil</p>
                  <p className="text-2xl font-bold text-orange-600">
                    {faqs.reduce((acc, f) => acc + f.helpfulCount, 0)}
                  </p>
                </div>
                <ThumbsUp className="w-8 h-8 text-orange-600" />
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
                  placeholder="Buscar pergunta ou resposta..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Categoria */}
              <div className="relative">
                <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
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
                  onChange={(e) => setShowPublishedOnly(e.target.checked)}
                  className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-gray-700">Apenas publicadas</span>
              </label>
            </div>
          </div>
        </div>

        {/* Lista de FAQs */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : filteredFAQs.length === 0 ? (
          <div className="bg-gray-50 rounded-xl p-12 text-center">
            <HelpCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-gray-900 mb-2">Nenhuma FAQ encontrada</h3>
            <p className="text-gray-600 mb-6">
              {searchTerm
                ? 'Tente ajustar os filtros de busca'
                : 'Comece criando sua primeira FAQ'}
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
            {filteredFAQs.map((faq) => (
              <div
                key={faq.id}
                className="bg-white rounded-xl border-2 border-gray-200 p-6 hover:shadow-lg transition-shadow"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    {/* Pergunta */}
                    <div className="flex items-start gap-3 mb-3">
                      <span className="text-3xl">❓</span>
                      <h3 className="text-lg font-bold text-gray-900 flex-1">
                        {faq.question}
                      </h3>
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
                            <span
                              key={idx}
                              className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded"
                            >
                              #{tag}
                            </span>
                          ))}
                          {faq.tags.length > 3 && (
                            <span className="text-xs text-gray-500">
                              +{faq.tags.length - 3}
                            </span>
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
                      onClick={() => handleDelete(faq.id, faq.question)}
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
