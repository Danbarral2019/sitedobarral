'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import AdminLayout from '@/components/AdminLayout';
import {
  Save, X, Eye, HelpCircle, Tag, Grid, ArrowUpDown,
  AlertCircle, Loader2, BarChart3, ThumbsUp, ThumbsDown
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
}

export default function EditFAQPage() {
  const router = useRouter();
  const params = useParams();
  const faqId = params.id as string;

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [faq, setFaq] = useState<FAQ | null>(null);

  const [formData, setFormData] = useState({
    question: '',
    answer: '',
    category: 'geral',
    order: 0,
    isPublished: false,
    tags: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const categories = [
    { value: 'acesso', label: 'Acesso' },
    { value: 'curso', label: 'Curso' },
    { value: 'certificado', label: 'Certificado' },
    { value: 'pagamento', label: 'Pagamento' },
    { value: 'suporte', label: 'Suporte' },
    { value: 'geral', label: 'Geral' },
  ];

  const loadFAQ = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/admin/faq/${faqId}`);
      if (response.ok) {
        const data = await response.json();
        setFaq(data.faq);
        setFormData({
          question: data.faq.question,
          answer: data.faq.answer,
          category: data.faq.category,
          order: data.faq.order,
          isPublished: data.faq.isPublished,
          tags: data.faq.tags?.join(', ') || '',
        });
      } else {
        alert('FAQ não encontrada');
        router.push('/admin/faq');
      }
    } catch (error) {
      console.error('Erro ao carregar FAQ:', error);
      alert('Erro ao carregar FAQ');
      router.push('/admin/faq');
    } finally {
      setIsLoading(false);
    }
  }, [faqId, router]);

  useEffect(() => {
    loadFAQ();
  }, [loadFAQ]);

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.question.trim()) {
      newErrors.question = 'Pergunta é obrigatória';
    }

    if (!formData.answer.trim()) {
      newErrors.answer = 'Resposta é obrigatória';
    }

    if (!formData.category) {
      newErrors.category = 'Categoria é obrigatória';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) {
      alert('Por favor, corrija os erros no formulário');
      return;
    }

    setIsSaving(true);

    try {
      const tagsArray = formData.tags
        .split(',')
        .map(tag => tag.trim())
        .filter(tag => tag.length > 0);

      const response = await fetch(`/api/admin/faq/${faqId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: formData.question,
          answer: formData.answer,
          category: formData.category,
          order: formData.order,
          isPublished: formData.isPublished,
          tags: tagsArray,
        }),
      });

      if (response.ok) {
        alert('FAQ atualizada com sucesso!');
        router.push('/admin/faq');
      } else {
        const data = await response.json();
        alert(`Erro ao atualizar FAQ: ${data.error || 'Erro desconhecido'}`);
      }
    } catch (error) {
      console.error('Erro ao atualizar FAQ:', error);
      alert('Erro ao atualizar FAQ');
    } finally {
      setIsSaving(false);
    }
  };

  const renderMarkdownPreview = (text: string) => {
    return text
      .split('\n')
      .map((line, idx) => {
        if (line.startsWith('### ')) {
          return <h3 key={idx} className="text-lg font-bold text-gray-900 mt-4 mb-2">{line.substring(4)}</h3>;
        }
        if (line.startsWith('## ')) {
          return <h2 key={idx} className="text-xl font-bold text-gray-900 mt-4 mb-2">{line.substring(3)}</h2>;
        }
        if (line.startsWith('# ')) {
          return <h1 key={idx} className="text-2xl font-bold text-gray-900 mt-4 mb-2">{line.substring(2)}</h1>;
        }

        const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
        const parts = line.split(linkRegex);
        if (parts.length > 1) {
          return (
            <p key={idx} className="mb-2">
              {parts.map((part, i) => {
                if (i % 3 === 1) {
                  return <a key={i} href={parts[i + 1]} className="text-blue-600 underline">{part}</a>;
                } else if (i % 3 === 0) {
                  return <span key={i}>{part}</span>;
                }
                return null;
              })}
            </p>
          );
        }

        const processedLine = line.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

        if (line.startsWith('- ')) {
          return <li key={idx} className="ml-4" dangerouslySetInnerHTML={{ __html: processedLine.substring(2) }} />;
        }

        if (line.trim() === '') {
          return <br key={idx} />;
        }

        return <p key={idx} className="mb-2" dangerouslySetInnerHTML={{ __html: processedLine }} />;
      });
  };

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      </AdminLayout>
    );
  }

  if (!faq) {
    return null;
  }

  return (
    <AdminLayout>
      <div className="p-6 md:p-8 max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl flex items-center justify-center">
              <HelpCircle className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Editar FAQ</h1>
              <p className="text-gray-600">ID: {faq.id}</p>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-lg p-4 border-2 border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Visualizações</p>
                  <p className="text-2xl font-bold text-purple-600">{faq.views}</p>
                </div>
                <BarChart3 className="w-8 h-8 text-purple-600" />
              </div>
            </div>

            <div className="bg-white rounded-lg p-4 border-2 border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Útil</p>
                  <p className="text-2xl font-bold text-green-600">{faq.helpfulCount}</p>
                </div>
                <ThumbsUp className="w-8 h-8 text-green-600" />
              </div>
            </div>

            <div className="bg-white rounded-lg p-4 border-2 border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Não útil</p>
                  <p className="text-2xl font-bold text-red-600">{faq.notHelpfulCount}</p>
                </div>
                <ThumbsDown className="w-8 h-8 text-red-600" />
              </div>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Pergunta */}
          <div className="bg-white rounded-xl border-2 border-gray-200 p-6">
            <label className="block mb-2">
              <div className="flex items-center gap-2 mb-2">
                <HelpCircle className="w-5 h-5 text-gray-700" />
                <span className="text-sm font-bold text-gray-900">
                  Pergunta *
                </span>
              </div>
              <input
                type="text"
                value={formData.question}
                onChange={(e) => setFormData({ ...formData, question: e.target.value })}
                placeholder="Ex: Como faço para baixar os materiais do curso?"
                className={`w-full px-4 py-3 border-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  errors.question ? 'border-red-500' : 'border-gray-300'
                }`}
              />
              {errors.question && (
                <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
                  <AlertCircle className="w-4 h-4" />
                  {errors.question}
                </p>
              )}
            </label>
          </div>

          {/* Resposta */}
          <div className="bg-white rounded-xl border-2 border-gray-200 p-6">
            <label className="block mb-2">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-gray-900">
                    Resposta (Markdown) *
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowPreview(!showPreview)}
                  className="flex items-center gap-2 px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  <Eye className="w-4 h-4" />
                  {showPreview ? 'Editor' : 'Preview'}
                </button>
              </div>

              {showPreview ? (
                <div className="w-full min-h-[300px] px-4 py-3 border-2 border-gray-300 rounded-lg bg-gray-50 prose prose-sm max-w-none">
                  {formData.answer ? renderMarkdownPreview(formData.answer) : (
                    <p className="text-gray-400 italic">A resposta aparecerá aqui...</p>
                  )}
                </div>
              ) : (
                <textarea
                  value={formData.answer}
                  onChange={(e) => setFormData({ ...formData, answer: e.target.value })}
                  placeholder="Digite a resposta em Markdown..."
                  rows={12}
                  className={`w-full px-4 py-3 border-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm ${
                    errors.answer ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
              )}
              {errors.answer && (
                <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
                  <AlertCircle className="w-4 h-4" />
                  {errors.answer}
                </p>
              )}
            </label>

            <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-sm text-blue-900">
                <strong>Dica de Markdown:</strong> Use # para títulos, ** para negrito,
                [texto](url) para links, - para listas
              </p>
            </div>
          </div>

          {/* Metadados */}
          <div className="bg-white rounded-xl border-2 border-gray-200 p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Metadados</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Categoria */}
              <label className="block">
                <div className="flex items-center gap-2 mb-2">
                  <Grid className="w-5 h-5 text-gray-700" />
                  <span className="text-sm font-bold text-gray-900">
                    Categoria *
                  </span>
                </div>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className={`w-full px-4 py-3 border-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    errors.category ? 'border-red-500' : 'border-gray-300'
                  }`}
                >
                  {categories.map(cat => (
                    <option key={cat.value} value={cat.value}>
                      {cat.label}
                    </option>
                  ))}
                </select>
              </label>

              {/* Ordem */}
              <label className="block">
                <div className="flex items-center gap-2 mb-2">
                  <ArrowUpDown className="w-5 h-5 text-gray-700" />
                  <span className="text-sm font-bold text-gray-900">
                    Ordem
                  </span>
                </div>
                <input
                  type="number"
                  value={formData.order}
                  onChange={(e) => setFormData({ ...formData, order: parseInt(e.target.value) || 0 })}
                  placeholder="0"
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="mt-1 text-xs text-gray-600">
                  Menor número = aparece primeiro
                </p>
              </label>
            </div>

            {/* Tags */}
            <label className="block mt-4">
              <div className="flex items-center gap-2 mb-2">
                <Tag className="w-5 h-5 text-gray-700" />
                <span className="text-sm font-bold text-gray-900">
                  Tags
                </span>
              </div>
              <input
                type="text"
                value={formData.tags}
                onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                placeholder="download, materiais, pdf (separadas por vírgula)"
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="mt-1 text-xs text-gray-600">
                Separe as tags por vírgula. Ex: download, materiais, pdf
              </p>
            </label>

            {/* Publicar */}
            <label className="flex items-center gap-3 mt-4 p-4 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors">
              <input
                type="checkbox"
                checked={formData.isPublished}
                onChange={(e) => setFormData({ ...formData, isPublished: e.target.checked })}
                className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
              />
              <div>
                <span className="text-sm font-bold text-gray-900 block">Publicar</span>
                <span className="text-xs text-gray-600">FAQ ficará visível no site público</span>
              </div>
            </label>
          </div>

          {/* Botões */}
          <div className="flex items-center justify-between gap-4 pt-6 border-t-2 border-gray-200">
            <button
              type="button"
              onClick={() => router.push('/admin/faq')}
              className="flex items-center gap-2 px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
            >
              <X className="w-5 h-5" />
              Cancelar
            </button>

            <button
              type="submit"
              disabled={isSaving}
              className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  Salvar Alterações
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </AdminLayout>
  );
}
