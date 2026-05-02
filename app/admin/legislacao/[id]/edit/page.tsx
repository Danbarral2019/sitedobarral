'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import MarkdownContent from '@/components/MarkdownContent';
import {
  Save, X, Scale, Calendar, Building, FileText,
  Link as LinkIcon, Bold, List, Heading2, Eye,
  RefreshCw, CheckCircle, XCircle, Clock
} from 'lucide-react';
import { TEMAS_LICITACOES } from '@/data/temas-licitacoes';

const TYPE_OPTIONS = [
  { value: 'decreto', label: 'Decreto' },
  { value: 'portaria', label: 'Portaria' },
  { value: 'in', label: 'Instrução Normativa (IN)' },
  { value: 'lei', label: 'Lei' },
  { value: 'medida-provisoria', label: 'Medida Provisória' },
  { value: 'ordem-servico', label: 'Ordem de Serviço' }
];

const ISSUER_OPTIONS = [
  { value: 'Presidência', label: 'Presidência da República' },
  { value: 'SEGES', label: 'SEGES (Secretaria de Gestão e Inovação)' },
  { value: 'MGI', label: 'MGI (Ministério da Gestão e Inovação)' },
  { value: 'AGU', label: 'AGU (Advocacia-Geral da União)' },
  { value: 'TCU', label: 'TCU (Tribunal de Contas da União)' }
];

export default function EditLegislativeActPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showPreview, setShowPreview] = useState(false);

  // Estado para atualização de conteúdo
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateResult, setUpdateResult] = useState<{
    success: boolean;
    message: string;
    changed?: boolean;
    changeSummary?: string;
  } | null>(null);
  const [scrapeStatus, setScrapeStatus] = useState<{
    lastScrapedAt?: string;
    status?: string;
    error?: string;
  } | null>(null);

  const [formData, setFormData] = useState({
    type: 'decreto',
    number: '',
    year: '',
    title: '',
    ementa: '',
    summary: '',
    issuer: 'Presidência',
    publishDate: '',
    effectiveDate: '',
    leiArticles: '',
    officialUrl: '',
    pdfUrl: '',
    content: '',
    esfera: 'federal' as string,
    themes: [] as string[],
    importance: '' as string, // '', 'baixa', 'media', 'alta', 'critica'
  });

  const fetchAct = useCallback(async () => {
    try {
      const response = await fetch(`/api/admin/legislative-acts/${id}`);
      if (!response.ok) throw new Error('Erro ao carregar ato');

      const data = await response.json();
      const act = data.act;

      // Processar leiArticles (de JSON para CSV)
      let leiArticlesStr = '';
      if (act.leiArticles) {
        try {
          const articles = JSON.parse(act.leiArticles);
          leiArticlesStr = articles.join(', ');
        } catch {
          leiArticlesStr = '';
        }
      }

      // Processar datas (de ISO para YYYY-MM-DD)
      const formatDate = (isoStr: string) => {
        if (!isoStr) return '';
        return isoStr.split('T')[0];
      };

      setFormData({
        type: act.type,
        number: act.number,
        year: act.year.toString(),
        title: act.title,
        ementa: act.ementa,
        summary: act.summary || '',
        issuer: act.issuer,
        publishDate: formatDate(act.publishDate),
        effectiveDate: act.effectiveDate ? formatDate(act.effectiveDate) : '',
        leiArticles: leiArticlesStr,
        officialUrl: act.officialUrl || '',
        pdfUrl: act.pdfUrl || '',
        content: act.content || '',
        esfera: act.esfera || 'federal',
        themes: act.themes ? JSON.parse(act.themes) : [],
        importance: act.importance || '',
      });
    } catch (error) {
      console.error('Erro ao carregar ato:', error);
      alert('Erro ao carregar ato normativo');
      router.push('/admin/legislacao');
    } finally {
      setIsFetching(false);
    }
  }, [id, router]);

  // Buscar status de scraping
  const fetchScrapeStatus = useCallback(async () => {
    try {
      const response = await fetch(`/api/admin/legislative-acts/${id}/update-content`);
      if (response.ok) {
        const data = await response.json();
        setScrapeStatus(data.scraping);
      }
    } catch (error) {
      console.error('Erro ao buscar status:', error);
    }
  }, [id]);

  useEffect(() => {
    fetchAct();
    fetchScrapeStatus();
  }, [fetchAct, fetchScrapeStatus]);

  // Atualizar conteúdo da URL oficial
  const handleUpdateContent = async () => {
    if (!formData.officialUrl) {
      setUpdateResult({
        success: false,
        message: 'Preencha a URL Oficial antes de verificar atualizações',
      });
      return;
    }

    setIsUpdating(true);
    setUpdateResult(null);

    try {
      const response = await fetch(`/api/admin/legislative-acts/${id}/update-content`, {
        method: 'POST',
      });

      const data = await response.json();

      if (response.ok) {
        setUpdateResult({
          success: true,
          message: data.message,
          changed: data.changed,
          changeSummary: data.data?.changeSummary,
        });

        // Se houve mudança, atualizar o campo de conteúdo
        if (data.changed && data.data?.contentLength) {
          // Recarregar os dados do ato para pegar o novo conteúdo
          fetchAct();
        }

        // Atualizar status de scraping
        fetchScrapeStatus();
      } else {
        setUpdateResult({
          success: false,
          message: data.error || 'Erro ao verificar atualizações',
        });
      }
    } catch (error) {
      setUpdateResult({
        success: false,
        message: error instanceof Error ? error.message : 'Erro de conexão',
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.type) newErrors.type = 'Tipo é obrigatório';
    if (!formData.number) newErrors.number = 'Número é obrigatório';
    if (!formData.year) newErrors.year = 'Ano é obrigatório';
    if (!formData.title) newErrors.title = 'Título é obrigatório';
    if (!formData.ementa) newErrors.ementa = 'Ementa é obrigatória';
    if (!formData.issuer) newErrors.issuer = 'Órgão emissor é obrigatório';
    if (!formData.publishDate) newErrors.publishDate = 'Data de publicação é obrigatória';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) {
      alert('Por favor, corrija os erros no formulário');
      return;
    }

    setIsLoading(true);

    try {
      // Processar artigos da Lei 14.133 (converter string CSV para array)
      let leiArticlesArray = null;
      if (formData.leiArticles.trim()) {
        leiArticlesArray = formData.leiArticles
          .split(',')
          .map(s => s.trim())
          .filter(Boolean);
      }

      const response = await fetch(`/api/admin/legislative-acts/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: formData.type,
          number: formData.number,
          year: parseInt(formData.year),
          title: formData.title,
          ementa: formData.ementa,
          summary: formData.summary || undefined,
          issuer: formData.issuer,
          publishDate: formData.publishDate,
          effectiveDate: formData.effectiveDate || undefined,
          leiArticles: leiArticlesArray,
          officialUrl: formData.officialUrl || undefined,
          pdfUrl: formData.pdfUrl || undefined,
          content: formData.content || undefined,
          esfera: formData.esfera,
          themes: formData.themes.length > 0 ? formData.themes : undefined,
          importance: formData.importance || null,
        })
      });

      if (response.ok) {
        alert('Ato normativo atualizado com sucesso!');
        router.push('/admin/legislacao');
      } else {
        const data = await response.json();
        alert(`Erro ao atualizar ato: ${data.error || 'Erro desconhecido'}`);
      }
    } catch (error) {
      console.error('Erro ao atualizar ato:', error);
      alert('Erro ao atualizar ato normativo');
    } finally {
      setIsLoading(false);
    }
  };

  if (isFetching) {
    return (
        <div className="p-6 md:p-8 max-w-5xl mx-auto text-center py-12">
          <div className="inline-block w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="mt-4 text-gray-600">Carregando ato normativo...</p>
        </div>
    );
  }

  return (
      <div className="p-6 md:p-8 max-w-5xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center">
              <Scale className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Editar Ato Normativo</h1>
              <p className="text-gray-600">Modificar dados do ato</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Identificação */}
          <div className="bg-white rounded-xl border-2 border-gray-200 p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Identificação do Ato</h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <label className="block">
                <span className="text-sm font-bold text-gray-900 mb-2 block">Tipo *</span>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  className={`w-full px-4 py-3 border-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    errors.type ? 'border-red-500' : 'border-gray-300'
                  }`}
                >
                  {TYPE_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="text-sm font-bold text-gray-900 mb-2 block">Número *</span>
                <input
                  type="text"
                  value={formData.number}
                  onChange={(e) => setFormData({ ...formData, number: e.target.value })}
                  className={`w-full px-4 py-3 border-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    errors.number ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
              </label>

              <label className="block">
                <span className="text-sm font-bold text-gray-900 mb-2 block">Ano *</span>
                <input
                  type="number"
                  value={formData.year}
                  onChange={(e) => setFormData({ ...formData, year: e.target.value })}
                  className={`w-full px-4 py-3 border-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    errors.year ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
              </label>
            </div>
          </div>

          {/* Conteúdo */}
          <div className="bg-white rounded-xl border-2 border-gray-200 p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Conteúdo</h3>

            <label className="block mb-4">
              <span className="text-sm font-bold text-gray-900 mb-2 block">Título *</span>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className={`w-full px-4 py-3 border-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  errors.title ? 'border-red-500' : 'border-gray-300'
                }`}
              />
            </label>

            <label className="block mb-4">
              <span className="text-sm font-bold text-gray-900 mb-2 block">Ementa *</span>
              <textarea
                value={formData.ementa}
                onChange={(e) => setFormData({ ...formData, ementa: e.target.value })}
                rows={3}
                className={`w-full px-4 py-3 border-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  errors.ementa ? 'border-red-500' : 'border-gray-300'
                }`}
              />
            </label>

            {/* Resumo Didático com Markdown */}
            <div className="block">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-bold text-gray-900">Resumo Didático (suporta Markdown)</span>
                <button
                  type="button"
                  onClick={() => setShowPreview(!showPreview)}
                  className={`flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg transition-colors ${
                    showPreview
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  <Eye className="w-4 h-4" />
                  {showPreview ? 'Ocultar Preview' : 'Ver Preview'}
                </button>
              </div>

              {/* Toolbar de formatação */}
              <div className="flex items-center gap-1 mb-2 p-2 bg-gray-100 rounded-t-lg border-2 border-b-0 border-gray-300">
                <button
                  type="button"
                  onClick={() => {
                    const textarea = document.getElementById('summary-textarea') as HTMLTextAreaElement;
                    const start = textarea.selectionStart;
                    const end = textarea.selectionEnd;
                    const text = formData.summary;
                    const selectedText = text.substring(start, end);
                    const newText = text.substring(0, start) + '**' + selectedText + '**' + text.substring(end);
                    setFormData({ ...formData, summary: newText });
                    setTimeout(() => {
                      textarea.focus();
                      textarea.setSelectionRange(start + 2, end + 2);
                    }, 0);
                  }}
                  className="p-2 hover:bg-gray-200 rounded transition-colors"
                  title="Negrito (selecione o texto primeiro)"
                >
                  <Bold className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const textarea = document.getElementById('summary-textarea') as HTMLTextAreaElement;
                    const start = textarea.selectionStart;
                    const text = formData.summary;
                    const lineStart = text.lastIndexOf('\n', start - 1) + 1;
                    const newText = text.substring(0, lineStart) + '- ' + text.substring(lineStart);
                    setFormData({ ...formData, summary: newText });
                    setTimeout(() => textarea.focus(), 0);
                  }}
                  className="p-2 hover:bg-gray-200 rounded transition-colors"
                  title="Adicionar item de lista"
                >
                  <List className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const textarea = document.getElementById('summary-textarea') as HTMLTextAreaElement;
                    const start = textarea.selectionStart;
                    const text = formData.summary;
                    const lineStart = text.lastIndexOf('\n', start - 1) + 1;
                    const newText = text.substring(0, lineStart) + '## ' + text.substring(lineStart);
                    setFormData({ ...formData, summary: newText });
                    setTimeout(() => textarea.focus(), 0);
                  }}
                  className="p-2 hover:bg-gray-200 rounded transition-colors"
                  title="Adicionar título"
                >
                  <Heading2 className="w-4 h-4" />
                </button>
                <span className="ml-2 text-xs text-gray-500">
                  Use **texto** para negrito, - para listas, ## para títulos
                </span>
              </div>

              <div className={`grid gap-4 ${showPreview ? 'grid-cols-2' : 'grid-cols-1'}`}>
                {/* Editor */}
                <textarea
                  id="summary-textarea"
                  value={formData.summary}
                  onChange={(e) => setFormData({ ...formData, summary: e.target.value })}
                  rows={8}
                  placeholder="Digite o resumo didático usando Markdown...&#10;&#10;Exemplo:&#10;## Pontos Principais&#10;- Item 1&#10;- Item 2&#10;&#10;**Texto em negrito** para destaque."
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-b-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                />

                {/* Preview */}
                {showPreview && (
                  <div className="border-2 border-gray-300 rounded-lg p-4 bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 overflow-auto max-h-64">
                    {formData.summary ? (
                      <MarkdownContent content={formData.summary} />
                    ) : (
                      <p className="text-gray-400 italic">O preview aparecerá aqui...</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Metadados */}
          <div className="bg-white rounded-xl border-2 border-gray-200 p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Metadados</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <label className="block">
                <span className="text-sm font-bold text-gray-900 mb-2 flex items-center gap-2">
                  <Building className="w-5 h-5" />
                  Órgão Emissor *
                </span>
                <select
                  value={formData.issuer}
                  onChange={(e) => setFormData({ ...formData, issuer: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {ISSUER_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="text-sm font-bold text-gray-900 mb-2 flex items-center gap-2">
                  <Scale className="w-5 h-5" />
                  Artigos da Lei 14.133/2021
                </span>
                <input
                  type="text"
                  value={formData.leiArticles}
                  onChange={(e) => setFormData({ ...formData, leiArticles: e.target.value })}
                  placeholder="Ex: 75, 76, 77"
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <span className="text-sm font-bold text-gray-900 mb-2 block">Esfera</span>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 p-3 border-2 rounded-lg cursor-pointer hover:bg-blue-50 transition-colors has-[:checked]:border-blue-500 has-[:checked]:bg-blue-50">
                    <input type="radio" name="esfera" value="federal" checked={formData.esfera === 'federal'} onChange={() => setFormData({ ...formData, esfera: 'federal' })} />
                    <span className="text-sm font-medium">Federal</span>
                  </label>
                  <label className="flex items-center gap-2 p-3 border-2 rounded-lg cursor-pointer hover:bg-blue-50 transition-colors has-[:checked]:border-blue-500 has-[:checked]:bg-blue-50">
                    <input type="radio" name="esfera" value="estadual" checked={formData.esfera === 'estadual'} onChange={() => setFormData({ ...formData, esfera: 'estadual' })} />
                    <span className="text-sm font-medium">Estadual</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="text-sm font-bold text-gray-900 mb-2 block" htmlFor="importance-select">
                  Destaque editorial
                  <span className="ml-2 font-normal text-xs text-gray-500">
                    (priorização nos cards &quot;Regulamentação em destaque&quot; da Lei 14.133)
                  </span>
                </label>
                <select
                  id="importance-select"
                  value={formData.importance}
                  onChange={(e) => setFormData({ ...formData, importance: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                >
                  <option value="">Sem marcação (usa heurística automática)</option>
                  <option value="critica">🔴 Crítica — sempre no topo</option>
                  <option value="alta">⭐ Alta — destacar</option>
                  <option value="media">Média — leve boost</option>
                  <option value="baixa">Baixa — manter no fim</option>
                </select>
              </div>
            </div>

            <div className="mb-4">
              <span className="text-sm font-bold text-gray-900 mb-2 block">Temas</span>
              <div className="flex flex-wrap gap-2">
                {TEMAS_LICITACOES.map((tema) => (
                  <button
                    key={tema.value}
                    type="button"
                    onClick={() => setFormData(prev => ({
                      ...prev,
                      themes: prev.themes.includes(tema.value)
                        ? prev.themes.filter(t => t !== tema.value)
                        : [...prev.themes, tema.value]
                    }))}
                    className={`px-3 py-1.5 text-xs rounded-full border-2 transition-colors ${
                      formData.themes.includes(tema.value)
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400'
                    }`}
                  >
                    {tema.label}
                  </button>
                ))}
              </div>
              <p className="mt-1 text-xs text-gray-600">Clique para selecionar/desselecionar temas</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="block">
                <span className="text-sm font-bold text-gray-900 mb-2 flex items-center gap-2">
                  <Calendar className="w-5 h-5" />
                  Data de Publicação *
                </span>
                <input
                  type="date"
                  value={formData.publishDate}
                  onChange={(e) => setFormData({ ...formData, publishDate: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </label>

              <label className="block">
                <span className="text-sm font-bold text-gray-900 mb-2 flex items-center gap-2">
                  <Calendar className="w-5 h-5" />
                  Data de Vigência
                </span>
                <input
                  type="date"
                  value={formData.effectiveDate}
                  onChange={(e) => setFormData({ ...formData, effectiveDate: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </label>
            </div>
          </div>

          {/* Links */}
          <div className="bg-white rounded-xl border-2 border-gray-200 p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Links e Recursos</h3>

            <label className="block mb-4">
              <span className="text-sm font-bold text-gray-900 mb-2 flex items-center gap-2">
                <LinkIcon className="w-5 h-5" />
                URL Oficial
              </span>
              <input
                type="url"
                value={formData.officialUrl}
                onChange={(e) => setFormData({ ...formData, officialUrl: e.target.value })}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </label>

            <label className="block mb-4">
              <span className="text-sm font-bold text-gray-900 mb-2 flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Link do PDF
              </span>
              <input
                type="url"
                value={formData.pdfUrl}
                onChange={(e) => setFormData({ ...formData, pdfUrl: e.target.value })}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </label>

            <label className="block">
              <span className="text-sm font-bold text-gray-900 mb-2 block">Texto Completo</span>
              <textarea
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                rows={6}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
              />
            </label>
          </div>

          {/* Atualização de Conteúdo */}
          <div className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-xl border-2 border-purple-200 p-6">
            <h3 className="text-lg font-bold text-purple-900 mb-4 flex items-center gap-2">
              <RefreshCw className="w-5 h-5" />
              Atualização Automática de Conteúdo
            </h3>

            <p className="text-sm text-purple-800 mb-4">
              Verifique e atualize automaticamente o texto legal a partir da URL oficial.
              O sistema detecta alterações comparando com a versão anterior.
            </p>

            {/* Status de Scraping */}
            {scrapeStatus && (
              <div className="mb-4 p-3 bg-white/80 rounded-lg border border-purple-200">
                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-gray-500" />
                    <span className="text-gray-600">Última verificação:</span>
                    <span className="font-medium">
                      {scrapeStatus.lastScrapedAt
                        ? new Date(scrapeStatus.lastScrapedAt).toLocaleString('pt-BR')
                        : 'Nunca verificado'}
                    </span>
                  </div>
                  {scrapeStatus.status && (
                    <div className="flex items-center gap-2">
                      {scrapeStatus.status === 'success' && (
                        <span className="px-2 py-0.5 bg-green-100 text-green-800 rounded text-xs font-medium">
                          Atualizado
                        </span>
                      )}
                      {scrapeStatus.status === 'unchanged' && (
                        <span className="px-2 py-0.5 bg-gray-100 text-gray-800 rounded text-xs font-medium">
                          Sem alterações
                        </span>
                      )}
                      {scrapeStatus.status === 'failed' && (
                        <span className="px-2 py-0.5 bg-red-100 text-red-800 rounded text-xs font-medium">
                          Falhou
                        </span>
                      )}
                    </div>
                  )}
                </div>
                {scrapeStatus.error && (
                  <p className="mt-2 text-xs text-red-600">{scrapeStatus.error}</p>
                )}
              </div>
            )}

            {/* Resultado da Atualização */}
            {updateResult && (
              <div className={`mb-4 p-4 rounded-lg border ${
                updateResult.success
                  ? updateResult.changed
                    ? 'bg-green-50 border-green-200'
                    : 'bg-blue-50 border-blue-200'
                  : 'bg-red-50 border-red-200'
              }`}>
                <div className="flex items-start gap-3">
                  {updateResult.success ? (
                    updateResult.changed ? (
                      <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                    ) : (
                      <CheckCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    )
                  ) : (
                    <XCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  )}
                  <div>
                    <p className={`font-medium ${
                      updateResult.success
                        ? updateResult.changed ? 'text-green-800' : 'text-blue-800'
                        : 'text-red-800'
                    }`}>
                      {updateResult.message}
                    </p>
                    {updateResult.changeSummary && (
                      <p className="text-sm text-green-700 mt-1">{updateResult.changeSummary}</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Botão de Atualização */}
            <button
              type="button"
              onClick={handleUpdateContent}
              disabled={isUpdating || !formData.officialUrl}
              className={`flex items-center gap-2 px-5 py-3 rounded-lg font-semibold transition-all ${
                formData.officialUrl
                  ? 'bg-purple-600 text-white hover:bg-purple-700 disabled:bg-purple-400'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              {isUpdating ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  Verificando...
                </>
              ) : (
                <>
                  <RefreshCw className="w-5 h-5" />
                  Verificar Atualizações
                </>
              )}
            </button>

            {!formData.officialUrl && (
              <p className="mt-2 text-xs text-gray-500">
                Preencha a URL Oficial acima para habilitar a verificação automática.
              </p>
            )}
          </div>

          {/* Botões */}
          <div className="flex items-center justify-between gap-4 pt-6 border-t-2 border-gray-200">
            <button
              type="button"
              onClick={() => router.push('/admin/legislacao')}
              className="flex items-center gap-2 px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
            >
              <X className="w-5 h-5" />
              Cancelar
            </button>

            <button
              type="submit"
              disabled={isLoading}
              className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
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
  );
}
