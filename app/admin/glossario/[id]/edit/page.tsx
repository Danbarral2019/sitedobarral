'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import AdminLayout from '@/components/AdminLayout';
import {
  Save, X, Eye, BookOpen, Grid, ArrowUpDown,
  AlertCircle, Scale, Link as LinkIcon, Loader2, BarChart3
} from 'lucide-react';

interface GlossaryTerm {
  id: string;
  term: string;
  slug: string;
  shortDef?: string;
  longDef: string;
  category: string;
  legalBasis?: string;
  leiArticles?: string;
  relatedTerms?: string;
  order: number;
  isPublished: boolean;
  tags: string[];
  views: number;
}

export default function EditGlossaryTermPage() {
  const router = useRouter();
  const params = useParams();
  const termId = params.id as string;

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [term, setTerm] = useState<GlossaryTerm | null>(null);

  const [formData, setFormData] = useState({
    term: '',
    slug: '',
    shortDef: '',
    longDef: '',
    category: 'conceitos-gerais',
    leiArticles: '',
    relatedTerms: '',
    order: 0,
    isPublished: false,
  });

  useEffect(() => {
    loadTerm();
  }, [termId]);

  const loadTerm = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/admin/glossary/${termId}`);
      if (response.ok) {
        const data = await response.json();
        setTerm(data.term);
        // Parse JSON arrays to comma-separated strings for form display
        const parseLeiArticles = (str?: string) => {
          if (!str) return '';
          try {
            const arr = JSON.parse(str);
            return Array.isArray(arr) ? arr.join(', ') : '';
          } catch {
            return '';
          }
        };

        const parseRelatedTerms = (str?: string) => {
          if (!str) return '';
          try {
            const arr = JSON.parse(str);
            return Array.isArray(arr) ? arr.join(', ') : '';
          } catch {
            return '';
          }
        };

        setFormData({
          term: data.term.term,
          slug: data.term.slug,
          shortDef: data.term.shortDef || '',
          longDef: data.term.longDef,
          category: data.term.category,
          leiArticles: parseLeiArticles(data.term.leiArticles),
          relatedTerms: parseRelatedTerms(data.term.relatedTerms),
          order: data.term.order,
          isPublished: data.term.isPublished,
        });
      } else {
        alert('Termo não encontrado');
        router.push('/admin/glossario');
      }
    } catch (error) {
      console.error('Erro ao carregar termo:', error);
      alert('Erro ao carregar termo');
      router.push('/admin/glossario');
    } finally {
      setIsLoading(false);
    }
  };

  const [errors, setErrors] = useState<Record<string, string>>({});

  const categories = [
    { value: 'licitacao', label: 'Licitação' },
    { value: 'contrato', label: 'Contrato' },
    { value: 'fiscalizacao', label: 'Fiscalização' },
    { value: 'planejamento', label: 'Planejamento' },
    { value: 'sancionamento', label: 'Sancionamento' },
    { value: 'conceitos-gerais', label: 'Conceitos Gerais' },
  ];

  const generateSlug = (text: string) => {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  };

  const handleTermChange = (value: string) => {
    setFormData({ ...formData, term: value });
    if (!formData.slug || formData.slug === generateSlug(formData.term)) {
      setFormData({ ...formData, term: value, slug: generateSlug(value) });
    }
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.term.trim()) {
      newErrors.term = 'Termo é obrigatório';
    }

    if (!formData.slug.trim()) {
      newErrors.slug = 'Slug é obrigatório';
    }

    if (!formData.longDef.trim()) {
      newErrors.longDef = 'Definição é obrigatória';
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
      // Convert comma-separated strings to JSON arrays
      const leiArticlesArray = formData.leiArticles
        ? JSON.stringify(formData.leiArticles.split(',').map(s => s.trim()).filter(Boolean))
        : undefined;

      const relatedTermsArray = formData.relatedTerms
        ? JSON.stringify(formData.relatedTerms.split(',').map(s => s.trim()).filter(Boolean))
        : undefined;

      const response = await fetch(`/api/admin/glossary/${termId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          term: formData.term,
          slug: formData.slug,
          shortDef: formData.shortDef || undefined,
          definition: formData.longDef, // API espera "definition", não "longDef"
          category: formData.category,
          isPublic: formData.isPublished, // API espera "isPublic", não "isPublished"
          leiArticles: leiArticlesArray,
          relatedTerms: relatedTermsArray
        }),
      });

      if (response.ok) {
        alert('Termo atualizado com sucesso!');
        router.push('/admin/glossario');
      } else {
        const data = await response.json();
        alert(`Erro ao atualizar termo: ${data.error || 'Erro desconhecido'}`);
      }
    } catch (error) {
      console.error('Erro ao atualizar termo:', error);
      alert('Erro ao atualizar termo');
    } finally {
      setIsSaving(false);
    }
  };

  const renderMarkdownPreview = (text: string) => {
    return text.split('\n').map((line, idx) => {
      if (line.startsWith('### ')) return <h3 key={idx} className="text-lg font-bold text-gray-900 mt-4 mb-2">{line.substring(4)}</h3>;
      if (line.startsWith('## ')) return <h2 key={idx} className="text-xl font-bold text-gray-900 mt-4 mb-2">{line.substring(3)}</h2>;
      if (line.startsWith('# ')) return <h1 key={idx} className="text-2xl font-bold text-gray-900 mt-4 mb-2">{line.substring(2)}</h1>;

      const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
      const parts = line.split(linkRegex);
      if (parts.length > 1) {
        return (
          <p key={idx} className="mb-2">
            {parts.map((part, i) => {
              if (i % 3 === 1) return <a key={i} href={parts[i + 1]} className="text-blue-600 underline">{part}</a>;
              else if (i % 3 === 0) return <span key={i}>{part}</span>;
              return null;
            })}
          </p>
        );
      }

      const processedLine = line.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
      if (line.startsWith('- ')) return <li key={idx} className="ml-4" dangerouslySetInnerHTML={{ __html: processedLine.substring(2) }} />;
      if (line.trim() === '') return <br key={idx} />;
      return <p key={idx} className="mb-2" dangerouslySetInnerHTML={{ __html: processedLine }} />;
    });
  };

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
        </div>
      </AdminLayout>
    );
  }

  if (!term) {
    return null;
  }

  return (
    <AdminLayout>
      <div className="p-6 md:p-8 max-w-5xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-gradient-to-br from-purple-600 to-indigo-600 rounded-xl flex items-center justify-center">
              <BookOpen className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Editar Termo do Glossário</h1>
              <p className="text-gray-600">ID: {term.id}</p>
            </div>
          </div>

          {/* Stats */}
          <div className="bg-white rounded-lg p-4 border-2 border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Visualizações</p>
                <p className="text-2xl font-bold text-indigo-600">{term.views}</p>
              </div>
              <BarChart3 className="w-8 h-8 text-indigo-600" />
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Termo e Slug */}
          <div className="bg-white rounded-xl border-2 border-gray-200 p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="block">
                <div className="flex items-center gap-2 mb-2">
                  <BookOpen className="w-5 h-5 text-gray-700" />
                  <span className="text-sm font-bold text-gray-900">Termo *</span>
                </div>
                <input
                  type="text"
                  value={formData.term}
                  onChange={(e) => handleTermChange(e.target.value)}
                  placeholder="Ex: Dispensa de Licitação"
                  className={`w-full px-4 py-3 border-2 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent ${
                    errors.term ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {errors.term && (
                  <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
                    <AlertCircle className="w-4 h-4" />
                    {errors.term}
                  </p>
                )}
              </label>

              <label className="block">
                <div className="flex items-center gap-2 mb-2">
                  <LinkIcon className="w-5 h-5 text-gray-700" />
                  <span className="text-sm font-bold text-gray-900">Slug (URL) *</span>
                </div>
                <input
                  type="text"
                  value={formData.slug}
                  onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                  placeholder="dispensa-de-licitacao"
                  className={`w-full px-4 py-3 border-2 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent font-mono text-sm ${
                    errors.slug ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {errors.slug && (
                  <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
                    <AlertCircle className="w-4 h-4" />
                    {errors.slug}
                  </p>
                )}
                <p className="mt-1 text-xs text-gray-600">
                  URL: /glossario/{formData.slug || 'slug-do-termo'}
                </p>
              </label>
            </div>
          </div>

          {/* Definição Curta */}
          <div className="bg-white rounded-xl border-2 border-gray-200 p-6">
            <label className="block">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm font-bold text-gray-900">Definição Curta (Opcional)</span>
              </div>
              <input
                type="text"
                value={formData.shortDef}
                onChange={(e) => setFormData({ ...formData, shortDef: e.target.value })}
                placeholder="Resumo de 1 linha do termo (aparece em listagens)"
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </label>
          </div>

          {/* Definição Completa */}
          <div className="bg-white rounded-xl border-2 border-gray-200 p-6">
            <label className="block mb-2">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-bold text-gray-900">Definição Completa (Markdown) *</span>
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
                  {formData.longDef ? renderMarkdownPreview(formData.longDef) : (
                    <p className="text-gray-400 italic">A definição aparecerá aqui...</p>
                  )}
                </div>
              ) : (
                <textarea
                  value={formData.longDef}
                  onChange={(e) => setFormData({ ...formData, longDef: e.target.value })}
                  placeholder="Digite a definição completa em Markdown..."
                  rows={14}
                  className={`w-full px-4 py-3 border-2 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent font-mono text-sm ${
                    errors.longDef ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
              )}
              {errors.longDef && (
                <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
                  <AlertCircle className="w-4 h-4" />
                  {errors.longDef}
                </p>
              )}
            </label>
          </div>

          {/* Metadados */}
          <div className="bg-white rounded-xl border-2 border-gray-200 p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Metadados</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="block">
                <div className="flex items-center gap-2 mb-2">
                  <Grid className="w-5 h-5 text-gray-700" />
                  <span className="text-sm font-bold text-gray-900">Categoria *</span>
                </div>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  {categories.map(cat => (
                    <option key={cat.value} value={cat.value}>{cat.label}</option>
                  ))}
                </select>
              </label>

              <label className="block">
                <div className="flex items-center gap-2 mb-2">
                  <ArrowUpDown className="w-5 h-5 text-gray-700" />
                  <span className="text-sm font-bold text-gray-900">Ordem</span>
                </div>
                <input
                  type="number"
                  value={formData.order}
                  onChange={(e) => setFormData({ ...formData, order: parseInt(e.target.value) || 0 })}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </label>
            </div>

            <label className="block mt-4">
              <div className="flex items-center gap-2 mb-2">
                <Scale className="w-5 h-5 text-blue-700" />
                <span className="text-sm font-bold text-gray-900">Artigos da Lei 14.133/2021</span>
              </div>
              <input
                type="text"
                value={formData.leiArticles}
                onChange={(e) => setFormData({ ...formData, leiArticles: e.target.value })}
                placeholder="Ex: 75, 76, 77 (números separados por vírgula)"
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
              <p className="mt-1 text-xs text-gray-600">
                Artigos relacionados que aparecerão como badges clicáveis
              </p>
            </label>

            <label className="block mt-4">
              <div className="flex items-center gap-2 mb-2">
                <BookOpen className="w-5 h-5 text-purple-700" />
                <span className="text-sm font-bold text-gray-900">Termos Correlatos</span>
              </div>
              <input
                type="text"
                value={formData.relatedTerms}
                onChange={(e) => setFormData({ ...formData, relatedTerms: e.target.value })}
                placeholder="Ex: pregao-eletronico, dispensa-licitacao (slugs separados por vírgula)"
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
              <p className="mt-1 text-xs text-gray-600">
                Slugs de outros termos do glossário que são relacionados
              </p>
            </label>

            <label className="flex items-center gap-3 mt-4 p-4 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors">
              <input
                type="checkbox"
                checked={formData.isPublished}
                onChange={(e) => setFormData({ ...formData, isPublished: e.target.checked })}
                className="w-5 h-5 text-purple-600 rounded focus:ring-2 focus:ring-purple-500"
              />
              <div>
                <span className="text-sm font-bold text-gray-900 block">Publicar imediatamente</span>
                <span className="text-xs text-gray-600">Termo ficará visível no glossário público</span>
              </div>
            </label>
          </div>

          {/* Botões */}
          <div className="flex items-center justify-between gap-4 pt-6 border-t-2 border-gray-200">
            <button
              type="button"
              onClick={() => router.push('/admin/glossario')}
              className="flex items-center gap-2 px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
            >
              <X className="w-5 h-5" />
              Cancelar
            </button>

            <button
              type="submit"
              disabled={isSaving}
              className="flex items-center gap-2 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
