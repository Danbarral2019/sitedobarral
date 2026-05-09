'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Save,
  Eye,
  AlertTriangle,
  CheckCircle,
  FileText,
  ExternalLink,
  Copy,
  RefreshCw
} from 'lucide-react';
import type { LeiArticle } from '@/data/lei-14133-artigos';

export default function EditArtigoPage() {
  const params = useParams();
  const router = useRouter();
  const numero = params?.numero as string;

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Estado do formulário
  const [formData, setFormData] = useState<LeiArticle | null>(null);
  const [originalData, setOriginalData] = useState<LeiArticle | null>(null);

  // Buscar artigo do banco de dados ao montar componente
  useEffect(() => {
    if (!numero) {
      router.push('/admin/lei-14133');
      return;
    }

    async function fetchArticle() {
      setIsLoading(true);
      try {
        const response = await fetch('/api/lei-14133/artigos');
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.artigos && data.artigos[numero]) {
            const article = data.artigos[numero];
            setFormData(article);
            setOriginalData(article);
            return;
          }
        }
        throw new Error('API não retornou artigo');
      } catch (error) {
        console.error('Erro ao buscar artigo, carregando fallback estático:', error);
        // Fallback estático carregado dinamicamente apenas em caso de falha
        // (importar estaticamente pesava 329 KB no bundle do admin)
        const { LEI_14133_ARTIGOS } = await import('@/data/lei-14133-artigos');
        const fallbackArticle = LEI_14133_ARTIGOS[numero];
        if (fallbackArticle) {
          setFormData(fallbackArticle);
          setOriginalData(fallbackArticle);
        } else {
          router.push('/admin/lei-14133');
        }
      } finally {
        setIsLoading(false);
      }
    }

    fetchArticle();
  }, [numero, router]);

  if (!formData || isLoading) {
    return (
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <RefreshCw className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
            <p className="text-gray-600">Carregando artigo {numero} do banco de dados...</p>
          </div>
        </div>
    );
  }

  // Verificar se está truncado
  const ementa = formData.ementa || '';
  const suspicious = /\s(do|da|de|dos|das|no|na|nos|nas|ao|à|aos|às|com|por|para|pelo|pela|que|se|e|ou)\s*$/i.test(ementa);
  const isTruncated = suspicious || ementa.length < 100;

  // Verificar se há mudanças
  const hasChanges = JSON.stringify(formData) !== JSON.stringify(originalData);

  const handleSave = async () => {
    if (!formData.ementa.trim()) {
      setErrorMessage('O texto do artigo não pode estar vazio!');
      return;
    }

    setIsSaving(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const response = await fetch(`/api/admin/lei-14133/${numero}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        throw new Error('Erro ao salvar artigo');
      }

      await response.json();
      setSuccessMessage('Artigo salvo com sucesso! Recarregue a página para ver as mudanças aplicadas.');
      setOriginalData(formData);

      // Scroll to top to see success message
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
      console.error('Erro ao salvar:', error);
      setErrorMessage('Erro ao salvar o artigo. Tente novamente.');
    } finally {
      setIsSaving(false);
    }
  };

  const copyOfficialLink = () => {
    const link = `https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2021/lei/L14133.htm#art${numero}`;
    navigator.clipboard.writeText(link);
    alert('Link copiado para a área de transferência!');
  };

  return (
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/admin/lei-14133"
            className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar para Lista de Artigos
          </Link>

          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold mb-2">
                Editar Artigo {numero}
              </h1>
              <p className="text-gray-600">
                Lei 14.133/2021 - Nova Lei de Licitações e Contratos
              </p>
            </div>

            {isTruncated && (
              <div className="bg-red-100 border-2 border-red-300 rounded-lg px-4 py-2 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-700" />
                <span className="text-sm font-medium text-red-700">
                  Artigo Truncado
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Messages */}
        {successMessage && (
          <div className="mb-6 bg-green-100 border-2 border-green-400 rounded-lg p-4 flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-green-700 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-green-900">{successMessage}</p>
              <p className="text-xs text-green-700 mt-1">
                Nota: As alterações serão refletidas no site após recarregar a página ou fazer um novo deploy.
              </p>
            </div>
          </div>
        )}

        {errorMessage && (
          <div className="mb-6 bg-red-100 border-2 border-red-400 rounded-lg p-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-700 flex-shrink-0 mt-0.5" />
            <p className="text-sm font-medium text-red-900">{errorMessage}</p>
          </div>
        )}

        {/* Link Oficial */}
        <div className="mb-6 bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-blue-900 mb-1">📖 Fonte Oficial</p>
              <p className="text-xs text-blue-700">
                Consulte o texto oficial no Planalto para copiar o artigo completo
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={copyOfficialLink}
                className="inline-flex items-center gap-2 px-3 py-2 bg-white border border-blue-300 text-blue-700 rounded-lg hover:bg-blue-50 transition-colors text-sm"
              >
                <Copy className="w-4 h-4" />
                Copiar Link
              </button>
              <a
                href={`https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2021/lei/L14133.htm#art${numero}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
              >
                <ExternalLink className="w-4 h-4" />
                Abrir no Planalto
              </a>
            </div>
          </div>
        </div>

        {/* Tabs: Editar / Preview */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="border-b border-gray-200">
            <div className="flex">
              <button
                onClick={() => setShowPreview(false)}
                className={`flex-1 px-6 py-4 font-medium transition-colors ${
                  !showPreview
                    ? 'bg-white text-blue-600 border-b-2 border-blue-600'
                    : 'bg-gray-50 text-gray-600 hover:text-gray-900'
                }`}
              >
                <FileText className="w-5 h-5 inline mr-2" />
                Editar
              </button>
              <button
                onClick={() => setShowPreview(true)}
                className={`flex-1 px-6 py-4 font-medium transition-colors ${
                  showPreview
                    ? 'bg-white text-blue-600 border-b-2 border-blue-600'
                    : 'bg-gray-50 text-gray-600 hover:text-gray-900'
                }`}
              >
                <Eye className="w-5 h-5 inline mr-2" />
                Preview
              </button>
            </div>
          </div>

          <div className="p-6">
            {!showPreview ? (
              /* Editor */
              <div className="space-y-6">
                {/* Título */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Título (opcional)
                  </label>
                  <input
                    type="text"
                    value={formData.titulo || ''}
                    onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
                    placeholder="Ex: TÍTULO I - DISPOSIÇÕES PRELIMINARES"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                {/* Capítulo Completo */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Capítulo Completo (opcional)
                  </label>
                  <input
                    type="text"
                    value={formData.capituloCompleto || ''}
                    onChange={(e) => setFormData({ ...formData, capituloCompleto: e.target.value })}
                    placeholder="Ex: CAPÍTULO I - DO ÂMBITO DE APLICAÇÃO DESTA LEI"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                {/* Texto do Artigo (Ementa) */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Texto Completo do Artigo *
                  </label>
                  <p className="text-xs text-gray-500 mb-2">
                    Cole aqui o texto oficial completo do artigo (caput, incisos, alíneas e parágrafos).
                    Quebras de linha serão preservadas.
                  </p>
                  <textarea
                    value={formData.ementa}
                    onChange={(e) => setFormData({ ...formData, ementa: e.target.value })}
                    placeholder={`Art. ${numero}. [Cole o texto completo do artigo aqui...]`}
                    className="w-full h-96 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                    style={{ whiteSpace: 'pre-wrap' }}
                  />
                  <div className="flex items-center justify-between mt-2">
                    <p className="text-xs text-gray-500">
                      {formData.ementa.length.toLocaleString()} caracteres
                    </p>
                    {isTruncated && (
                      <span className="text-xs text-red-600 font-medium">
                        ⚠️ Texto parece estar incompleto
                      </span>
                    )}
                  </div>
                </div>

                {/* Capítulo (sigla) */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Capítulo (sigla)
                  </label>
                  <input
                    type="text"
                    value={formData.capitulo}
                    onChange={(e) => setFormData({ ...formData, capitulo: e.target.value })}
                    placeholder="Ex: TÍTULO I - CAPÍTULO I"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                {/* Seção */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Seção (opcional)
                  </label>
                  <input
                    type="text"
                    value={formData.secao || ''}
                    onChange={(e) => setFormData({ ...formData, secao: e.target.value })}
                    placeholder="Ex: Disposições Preliminares"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            ) : (
              /* Preview */
              <div>
                <div className="mb-6">
                  <h2 className="text-2xl font-bold mb-2">Artigo {numero}</h2>
                  {formData.titulo && (
                    <p className="text-lg font-bold text-gray-700 mb-2">{formData.titulo}</p>
                  )}
                  {formData.capituloCompleto && (
                    <p className="text-lg font-bold text-gray-700 mb-4">{formData.capituloCompleto}</p>
                  )}
                </div>

                <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
                  <p className="text-base leading-relaxed whitespace-pre-line font-serif">
                    {formData.ementa}
                  </p>
                </div>

                <div className="mt-6 flex flex-wrap gap-2">
                  <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
                    {formData.capitulo}
                  </span>
                  {formData.secao && (
                    <span className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm font-medium">
                      {formData.secao}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Ações */}
        <div className="mt-6 flex items-center justify-between bg-white rounded-lg shadow-md p-6">
          <div>
            {hasChanges ? (
              <p className="text-sm text-orange-600 font-medium">
                ⚠️ Você tem alterações não salvas
              </p>
            ) : (
              <p className="text-sm text-gray-500">
                Nenhuma alteração pendente
              </p>
            )}
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/admin/lei-14133"
              className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
            >
              Cancelar
            </Link>
            <button
              onClick={handleSave}
              disabled={isSaving || !hasChanges || !formData.ementa.trim()}
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              {isSaving ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Salvar Alterações
                </>
              )}
            </button>
          </div>
        </div>
      </div>
  );
}
