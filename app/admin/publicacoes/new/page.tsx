'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Save, ArrowLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Breadcrumb } from '@/components/ui/breadcrumb';
import Link from 'next/link';

export default function NewPublicationPage() {
  const router = useRouter();
  const { success, error: errorToast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    type: 'livro',
    title: '',
    description: '',
    content: '',
    author: 'Prof. Daniel Barral',
    publishedAt: new Date().toISOString().split('T')[0],
    isPublished: false,
    // Campos para livros
    publisher: '',
    isbn: '',
    coverImage: '',
    // Campos para artigos
    externalUrl: '',
    journal: '',
    // Campos para notícias/eventos
    eventDate: '',
    location: '',
  });

  useEffect(() => {
    verifyAdmin();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const verifyAdmin = async () => {
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
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      const response = await fetch('/api/admin/publications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao criar publicação');
      }

      success('Publicação criada!', 'A publicação foi criada com sucesso.');
      router.push('/admin/publicacoes');
    } catch (error) {
      console.error('Erro ao criar publicação:', error);
      errorToast(
        'Erro ao criar publicação',
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
    <main className="py-12 bg-gradient-to-br from-blue-50 via-white to-purple-50 min-h-screen">
      <div className="container mx-auto px-4">
        <div className="max-w-4xl mx-auto">
          <Breadcrumb
            items={[
              { label: 'Admin', href: '/admin' },
              { label: 'Publicações', href: '/admin/publicacoes' },
              { label: 'Nova Publicação' }
            ]}
            className="mb-6"
          />

          <div className="mb-8">
            <div className="flex items-center justify-between">
              <h1 className="text-4xl font-bold text-gray-900">Nova Publicação</h1>
              <Link
                href="/admin/publicacoes"
                className="text-gray-600 hover:text-gray-900 flex items-center gap-2"
              >
                <ArrowLeft className="w-5 h-5" />
                Voltar
              </Link>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-lg p-8 border-2 border-gray-200">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Tipo */}
              <div>
                <label className="block text-sm font-bold text-gray-900 mb-2">
                  Tipo de Publicação *
                </label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  required
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-600 text-gray-900"
                >
                  <option value="livro">📚 Livro</option>
                  <option value="artigo">📄 Artigo Científico</option>
                  <option value="noticia">📰 Notícia/Evento</option>
                </select>
              </div>

              {/* Título */}
              <div>
                <label className="block text-sm font-bold text-gray-900 mb-2">
                  Título *
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  required
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-600 text-gray-900"
                  placeholder="Digite o título"
                />
              </div>

              {/* Descrição */}
              <div>
                <label className="block text-sm font-bold text-gray-900 mb-2">
                  Descrição/Resumo *
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  required
                  rows={3}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-600 text-gray-900"
                  placeholder="Breve descrição ou resumo"
                />
              </div>

              {/* Conteúdo (opcional para artigos externos) */}
              <div>
                <label className="block text-sm font-bold text-gray-900 mb-2">
                  Conteúdo Completo (opcional)
                </label>
                <textarea
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  rows={8}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-600 text-gray-900 font-mono text-sm"
                  placeholder="Conteúdo detalhado (opcional para artigos com link externo)"
                />
              </div>

              {/* Autor e Data */}
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
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-600 text-gray-900"
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
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-600 text-gray-900"
                  />
                </div>
              </div>

              {/* Campos específicos para LIVRO */}
              {formData.type === 'livro' && (
                <div className="p-6 bg-blue-50 rounded-xl border-2 border-blue-200">
                  <h3 className="text-lg font-bold text-gray-900 mb-4">Informações do Livro</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-bold text-gray-900 mb-2">
                        Editora
                      </label>
                      <input
                        type="text"
                        value={formData.publisher}
                        onChange={(e) => setFormData({ ...formData, publisher: e.target.value })}
                        className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-600 text-gray-900"
                        placeholder="Nome da editora"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-gray-900 mb-2">
                        ISBN
                      </label>
                      <input
                        type="text"
                        value={formData.isbn}
                        onChange={(e) => setFormData({ ...formData, isbn: e.target.value })}
                        className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-600 text-gray-900"
                        placeholder="978-XX-XXXXX-XX-X"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-gray-900 mb-2">
                        URL da Capa
                      </label>
                      <input
                        type="url"
                        value={formData.coverImage}
                        onChange={(e) => setFormData({ ...formData, coverImage: e.target.value })}
                        className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-600 text-gray-900"
                        placeholder="https://exemplo.com/capa.jpg"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Campos específicos para ARTIGO */}
              {formData.type === 'artigo' && (
                <div className="p-6 bg-purple-50 rounded-xl border-2 border-purple-200">
                  <h3 className="text-lg font-bold text-gray-900 mb-4">Informações do Artigo</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-bold text-gray-900 mb-2">
                        Revista/Periódico
                      </label>
                      <input
                        type="text"
                        value={formData.journal}
                        onChange={(e) => setFormData({ ...formData, journal: e.target.value })}
                        className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-600 text-gray-900"
                        placeholder="Nome da revista ou periódico"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-gray-900 mb-2">
                        Link Externo
                      </label>
                      <input
                        type="url"
                        value={formData.externalUrl}
                        onChange={(e) => setFormData({ ...formData, externalUrl: e.target.value })}
                        className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-600 text-gray-900"
                        placeholder="https://revista.com/artigo"
                      />
                      <p className="text-xs text-gray-600 mt-1">
                        Link para o artigo publicado externamente
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Campos específicos para NOTÍCIA/EVENTO */}
              {formData.type === 'noticia' && (
                <div className="p-6 bg-pink-50 rounded-xl border-2 border-pink-200">
                  <h3 className="text-lg font-bold text-gray-900 mb-4">Informações do Evento/Notícia</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-bold text-gray-900 mb-2">
                        Data do Evento
                      </label>
                      <input
                        type="date"
                        value={formData.eventDate}
                        onChange={(e) => setFormData({ ...formData, eventDate: e.target.value })}
                        className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-600 text-gray-900"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-gray-900 mb-2">
                        Local
                      </label>
                      <input
                        type="text"
                        value={formData.location}
                        onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                        className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-600 text-gray-900"
                        placeholder="Cidade, estado ou endereço"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-gray-900 mb-2">
                        Link Externo
                      </label>
                      <input
                        type="url"
                        value={formData.externalUrl}
                        onChange={(e) => setFormData({ ...formData, externalUrl: e.target.value })}
                        className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-600 text-gray-900"
                        placeholder="https://site.com/evento"
                      />
                      <p className="text-xs text-gray-600 mt-1">
                        Link para mais informações sobre o evento
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Publicar */}
              <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
                <input
                  type="checkbox"
                  id="isPublished"
                  checked={formData.isPublished}
                  onChange={(e) => setFormData({ ...formData, isPublished: e.target.checked })}
                  className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="isPublished" className="text-sm font-bold text-gray-900 cursor-pointer">
                  Publicar imediatamente
                </label>
              </div>

              {/* Botões */}
              <div className="flex gap-4 pt-4 border-t border-gray-200">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-xl font-bold hover:from-blue-700 hover:to-purple-700 transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    <>
                      <Save className="w-5 h-5" />
                      Criar Publicação
                    </>
                  )}
                </button>
                <Link
                  href="/admin/publicacoes"
                  className="px-6 py-3 border-2 border-gray-300 rounded-xl font-bold text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </Link>
              </div>
            </form>
          </div>
        </div>
      </div>
    </main>
  );
}
