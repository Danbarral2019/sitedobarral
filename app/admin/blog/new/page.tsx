'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { Loader2, Save, ArrowLeft, Plus, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import AdminLayout from '@/components/AdminLayout';
import LeiArticleSelector from '@/components/LeiArticleSelector';

// Lazy load do editor Markdown (150KB+ economia)
const MarkdownEditor = dynamic(() => import('@/components/MarkdownEditor'), {
  loading: () => (
    <div className="flex justify-center items-center p-8 border-2 border-dashed border-gray-300 rounded-lg">
      <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
    </div>
  ),
  ssr: false
});

export default function NewBlogPostPage() {
  const router = useRouter();
  const { success, error: errorToast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    slug: '',
    excerpt: '',
    content: '',
    author: 'Prof. Daniel Barral',
    publishedAt: new Date().toISOString().split('T')[0],
    isPublished: false,
    autoPublishSocial: true,
  });
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [leiArticles, setLeiArticles] = useState<string[]>([]);

  const verifyAdmin = useCallback(async () => {
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
    } catch (error) {
      console.error('Erro ao verificar admin:', error);
      router.push('/validar-acesso');
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  useEffect(() => {
    verifyAdmin();
  }, [verifyAdmin]);

  const generateSlug = (title: string) => {
    return title
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  };

  const handleTitleChange = (title: string) => {
    setFormData(prev => ({
      ...prev,
      title,
      slug: generateSlug(title),
    }));
  };

  const handleAddTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim()]);
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      const response = await fetch('/api/admin/blog-posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          tags: tags.length > 0 ? tags : null,
          leiArticles: leiArticles.length > 0 ? leiArticles : null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao criar post');
      }

      success('Post criado!', 'O post foi criado com sucesso.');
      router.push('/admin/blog');
    } catch (error) {
      console.error('Erro ao criar post:', error);
      errorToast(
        'Erro ao criar post',
        error instanceof Error ? error.message : 'Tente novamente.'
      );
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-blue-600" />
      </main>
    );
  }

  return (
    <AdminLayout>
      <div className="p-8">
        <div className="max-w-5xl mx-auto">
          <div className="mb-8">
            <button
              onClick={() => router.push('/admin/blog')}
              className="flex items-center gap-2 text-gray-700 hover:text-blue-600 transition-colors mb-4 font-medium"
            >
              <ArrowLeft className="w-4 h-4" />
              Voltar para Blog
            </button>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Novo Post</h1>
            <p className="text-gray-600">Crie um novo post para o blog</p>
          </div>

          <div className="bg-white rounded-2xl shadow-lg p-8 border-2 border-gray-200">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-bold text-gray-900 mb-2">
                  Título *
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => handleTitleChange(e.target.value)}
                  required
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-600 text-gray-900"
                  placeholder="Digite o título do post"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-900 mb-2">
                  Slug * (gerado automaticamente)
                </label>
                <input
                  type="text"
                  value={formData.slug}
                  onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                  required
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-600 text-gray-900 font-mono text-sm"
                  placeholder="slug-do-post"
                />
                <p className="text-xs text-gray-600 mt-1">
                  URL: /blog/{formData.slug || 'slug-do-post'}
                </p>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-900 mb-2">
                  Resumo *
                </label>
                <textarea
                  value={formData.excerpt}
                  onChange={(e) => setFormData({ ...formData, excerpt: e.target.value })}
                  required
                  rows={3}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-600 text-gray-900"
                  placeholder="Breve descrição do post (aparece nas listagens)"
                />
              </div>

              <div className="col-span-full">
                <label className="block text-sm font-bold text-gray-900 mb-4">
                  Conteúdo * <span className="text-xs font-normal text-gray-500">(Suporta Markdown)</span>
                </label>
                <MarkdownEditor
                  value={formData.content}
                  onChange={(content) => setFormData({ ...formData, content })}
                  placeholder="Escreva o conteúdo completo do post em Markdown..."
                />
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-bold text-gray-900 mb-2">
                    Autor *
                  </label>
                  <input
                    type="text"
                    value={formData.author}
                    onChange={(e) => setFormData({ ...formData, author: e.target.value })}
                    required
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-600 text-gray-900"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-900 mb-2">
                    Data de Publicação *
                  </label>
                  <input
                    type="date"
                    value={formData.publishedAt}
                    onChange={(e) => setFormData({ ...formData, publishedAt: e.target.value })}
                    required
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-600 text-gray-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-900 mb-2">
                  Tags
                </label>
                <div className="flex gap-2 mb-3">
                  <input
                    type="text"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                    placeholder="Digite uma tag e pressione Enter"
                    className="flex-1 px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-600 text-gray-900"
                  />
                  <button
                    type="button"
                    onClick={handleAddTag}
                    className="px-4 py-2 bg-orange-600 text-white rounded-lg font-bold hover:bg-orange-700 transition-colors flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Adicionar
                  </button>
                </div>

                {tags.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {tags.map((tag) => (
                      <span
                        key={tag}
                        className="px-3 py-1 bg-orange-100 text-orange-800 rounded-full text-sm font-medium flex items-center gap-2"
                      >
                        {tag}
                        <button
                          type="button"
                          onClick={() => handleRemoveTag(tag)}
                          className="hover:text-orange-900"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Seletor de Artigos da Lei 14.133/2021 */}
              <div>
                <LeiArticleSelector
                  selectedArticles={leiArticles}
                  onChange={setLeiArticles}
                  maxArticles={10}
                  label="Artigos da Lei 14.133/2021 relacionados ao post"
                  showPopularArticles={true}
                />
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
                  <input
                    type="checkbox"
                    id="isPublished"
                    checked={formData.isPublished}
                    onChange={(e) => setFormData({ ...formData, isPublished: e.target.checked })}
                    className="w-5 h-5 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
                  />
                  <label htmlFor="isPublished" className="text-sm font-bold text-gray-900 cursor-pointer">
                    Publicar imediatamente
                  </label>
                </div>

                <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-lg border-2 border-blue-200">
                  <input
                    type="checkbox"
                    id="autoPublishSocial"
                    checked={formData.autoPublishSocial}
                    onChange={(e) => setFormData({ ...formData, autoPublishSocial: e.target.checked })}
                    className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <div className="flex-1">
                    <label htmlFor="autoPublishSocial" className="text-sm font-bold text-gray-900 cursor-pointer flex items-center gap-2">
                      📱 Publicar nas redes sociais
                    </label>
                    <p className="text-xs text-gray-600 mt-1">
                      Ao publicar, o post será automaticamente compartilhado no Instagram e LinkedIn
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex gap-4 pt-4 border-t border-gray-200">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex-1 bg-gradient-to-r from-orange-600 to-amber-600 text-white px-6 py-3 rounded-xl font-bold hover:from-orange-700 hover:to-amber-700 transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    <>
                      <Save className="w-5 h-5" />
                      Criar Post
                    </>
                  )}
                </button>
                <Link
                  href="/admin/blog"
                  className="px-6 py-3 border-2 border-gray-300 rounded-xl font-bold text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </Link>
              </div>
            </form>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
