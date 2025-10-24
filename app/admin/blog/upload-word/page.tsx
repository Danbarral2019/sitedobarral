'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Save, Eye, FileDown } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import AdminLayout from '@/components/AdminLayout';
import WordUploader from '@/components/WordUploader';

interface UploadedData {
  title: string;
  author: string;
  date: string;
  tags: string[];
  excerpt: string;
  content: string;
  footnotes: string;
  references: string;
  images: Array<{ name: string; base64: string }>;
}

export default function UploadWordPage() {
  const router = useRouter();
  const { success, error: errorToast } = useToast();

  const [uploadedData, setUploadedData] = useState<UploadedData | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  // Dados editáveis (cópia do uploadedData)
  const [editedTitle, setEditedTitle] = useState('');
  const [editedAuthor, setEditedAuthor] = useState('');
  const [editedTags, setEditedTags] = useState<string[]>([]);
  const [editedExcerpt, setEditedExcerpt] = useState('');
  const [editedContent, setEditedContent] = useState('');
  const [editedFootnotes, setEditedFootnotes] = useState('');
  const [editedReferences, setEditedReferences] = useState('');

  const handleUploadComplete = useCallback((data: UploadedData) => {
    setUploadedData(data);
    setEditedTitle(data.title);
    setEditedAuthor(data.author);
    setEditedTags(data.tags);
    setEditedExcerpt(data.excerpt);
    setEditedContent(data.content);
    setEditedFootnotes(data.footnotes);
    setEditedReferences(data.references);
    setShowPreview(true);
  }, []);

  const generateSlug = (title: string): string => {
    return title
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  };

  const handleSave = async () => {
    if (!editedTitle || !editedContent) {
      errorToast('Campos obrigatórios', 'Título e conteúdo são obrigatórios');
      return;
    }

    setIsSaving(true);

    try {
      const slug = generateSlug(editedTitle);

      // Montar conteúdo completo com notas e referências
      let fullContent = editedContent;

      if (editedFootnotes) {
        fullContent += '\n\n---\n\n## Notas de Rodapé\n\n' + editedFootnotes;
      }

      if (editedReferences) {
        fullContent += '\n\n---\n\n## Referências Bibliográficas\n\n' + editedReferences;
      }

      const response = await fetch('/api/admin/blog-posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editedTitle,
          slug: slug,
          author: editedAuthor,
          excerpt: editedExcerpt,
          content: fullContent,
          tags: editedTags,
          isPublished: false, // Salvar como rascunho
          publishedAt: new Date().toISOString(),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao salvar post');
      }

      const { post } = await response.json();
      success('Post salvo!', 'O artigo foi salvo como rascunho');

      // Redirecionar para edição
      router.push(`/admin/blog/${post.id}/edit`);

    } catch (error) {
      console.error('Erro ao salvar post:', error);
      errorToast(
        'Erro ao salvar',
        error instanceof Error ? error.message : 'Tente novamente'
      );
    } finally {
      setIsSaving(false);
    }
  };

  const downloadTemplate = () => {
    // Link para download do template
    window.open('/api/admin/blog-posts/download-template', '_blank');
  };

  return (
    <AdminLayout>
      <div className="p-8">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <Link
              href="/admin/blog"
              className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium mb-4"
            >
              <ArrowLeft className="w-4 h-4" />
              Voltar para Posts
            </Link>
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 mb-2">📄 Upload de Artigo (Word)</h1>
                <p className="text-gray-600">
                  Envie seu artigo em formato Word e revise antes de publicar
                </p>
              </div>
              <button
                onClick={downloadTemplate}
                className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg font-bold hover:bg-gray-700 transition-colors"
              >
                <FileDown className="w-5 h-5" />
                Baixar Template
              </button>
            </div>
          </div>

          {/* Upload Area */}
          {!uploadedData && (
            <div className="bg-white p-8 rounded-xl border-2 border-gray-200">
              <WordUploader onUploadComplete={handleUploadComplete} />
            </div>
          )}

          {/* Preview e Edição */}
          {uploadedData && (
            <div className="space-y-6">
              {/* Botões de Ação */}
              <div className="bg-white p-6 rounded-xl border-2 border-gray-200">
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => setShowPreview(!showPreview)}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-lg font-bold hover:bg-blue-200 transition-colors"
                  >
                    <Eye className="w-5 h-5" />
                    {showPreview ? 'Modo Edição' : 'Ver Preview'}
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Save className="w-5 h-5" />
                    {isSaving ? 'Salvando...' : 'Salvar como Rascunho'}
                  </button>
                </div>
              </div>

              {showPreview ? (
                /* PREVIEW MODE */
                <div className="bg-white p-8 rounded-xl border-2 border-gray-200">
                  <article className="prose prose-lg max-w-none">
                    <h1>{editedTitle}</h1>
                    <div className="text-sm text-gray-600 mb-6">
                      <p><strong>Autor:</strong> {editedAuthor}</p>
                      <p><strong>Tags:</strong> {editedTags.join(', ')}</p>
                    </div>

                    <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-6">
                      <p className="text-gray-700 italic">{editedExcerpt}</p>
                    </div>

                    <div
                      className="markdown-content"
                      dangerouslySetInnerHTML={{ __html: renderMarkdown(editedContent) }}
                    />

                    {editedFootnotes && (
                      <div className="mt-12 pt-6 border-t-2 border-gray-300">
                        <h2 className="text-xl font-bold mb-4">Notas de Rodapé</h2>
                        <div
                          className="text-sm"
                          dangerouslySetInnerHTML={{ __html: renderMarkdown(editedFootnotes) }}
                        />
                      </div>
                    )}

                    {editedReferences && (
                      <div className="mt-8 pt-6 border-t-2 border-gray-300">
                        <h2 className="text-xl font-bold mb-4">Referências Bibliográficas</h2>
                        <div
                          className="text-sm"
                          dangerouslySetInnerHTML={{ __html: renderMarkdown(editedReferences) }}
                        />
                      </div>
                    )}
                  </article>
                </div>
              ) : (
                /* EDIT MODE */
                <div className="space-y-6">
                  {/* Título */}
                  <div className="bg-white p-6 rounded-xl border-2 border-gray-200">
                    <label className="block text-sm font-bold text-gray-900 mb-2">
                      Título *
                    </label>
                    <input
                      type="text"
                      value={editedTitle}
                      onChange={(e) => setEditedTitle(e.target.value)}
                      className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-600"
                      placeholder="Título do artigo"
                    />
                  </div>

                  {/* Autor */}
                  <div className="bg-white p-6 rounded-xl border-2 border-gray-200">
                    <label className="block text-sm font-bold text-gray-900 mb-2">
                      Autor
                    </label>
                    <input
                      type="text"
                      value={editedAuthor}
                      onChange={(e) => setEditedAuthor(e.target.value)}
                      className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-600"
                      placeholder="Nome do autor"
                    />
                  </div>

                  {/* Tags */}
                  <div className="bg-white p-6 rounded-xl border-2 border-gray-200">
                    <label className="block text-sm font-bold text-gray-900 mb-2">
                      Tags (separadas por vírgula)
                    </label>
                    <input
                      type="text"
                      value={editedTags.join(', ')}
                      onChange={(e) => setEditedTags(e.target.value.split(',').map(t => t.trim()))}
                      className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-600"
                      placeholder="Licitações, Direito Administrativo, etc."
                    />
                  </div>

                  {/* Resumo */}
                  <div className="bg-white p-6 rounded-xl border-2 border-gray-200">
                    <label className="block text-sm font-bold text-gray-900 mb-2">
                      Resumo (Excerpt)
                    </label>
                    <textarea
                      value={editedExcerpt}
                      onChange={(e) => setEditedExcerpt(e.target.value)}
                      rows={3}
                      className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-600"
                      placeholder="Breve resumo do artigo"
                    />
                  </div>

                  {/* Conteúdo */}
                  <div className="bg-white p-6 rounded-xl border-2 border-gray-200">
                    <label className="block text-sm font-bold text-gray-900 mb-2">
                      Conteúdo (Markdown) *
                    </label>
                    <textarea
                      value={editedContent}
                      onChange={(e) => setEditedContent(e.target.value)}
                      rows={20}
                      className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-600 font-mono text-sm"
                      placeholder="Conteúdo do artigo em Markdown"
                    />
                  </div>

                  {/* Notas de Rodapé */}
                  <div className="bg-white p-6 rounded-xl border-2 border-gray-200">
                    <label className="block text-sm font-bold text-gray-900 mb-2">
                      Notas de Rodapé
                    </label>
                    <textarea
                      value={editedFootnotes}
                      onChange={(e) => setEditedFootnotes(e.target.value)}
                      rows={8}
                      className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-600 font-mono text-sm"
                      placeholder="Notas de rodapé (opcional)"
                    />
                  </div>

                  {/* Referências */}
                  <div className="bg-white p-6 rounded-xl border-2 border-gray-200">
                    <label className="block text-sm font-bold text-gray-900 mb-2">
                      Referências Bibliográficas
                    </label>
                    <textarea
                      value={editedReferences}
                      onChange={(e) => setEditedReferences(e.target.value)}
                      rows={10}
                      className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-600 font-mono text-sm"
                      placeholder="Referências bibliográficas no formato ABNT"
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}

/**
 * Renderiza Markdown básico para HTML
 */
function renderMarkdown(markdown: string): string {
  let html = markdown;

  // Headings
  html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
  html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
  html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');

  // Bold
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

  // Italic
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');

  // Links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

  // Line breaks
  html = html.replace(/\n/g, '<br>');

  // Footnotes [^1]
  html = html.replace(/\[\^(\d+)\]/g, '<sup><a href="#fn$1" id="ref$1">$1</a></sup>');

  return html;
}
