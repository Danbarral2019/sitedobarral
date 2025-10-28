'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import AdminLayout from '@/components/AdminLayout';
import { courses } from '@/data/courses';
import { ArrowLeft, Save, Trash2, Plus, X, ExternalLink } from 'lucide-react';
import LeiArticleSelector from '@/components/LeiArticleSelector';
import SummaryGenerator from '@/components/SummaryGenerator';

type DocumentCategory = 'apostila' | 'acordao' | 'parecer' | 'edital' | 'artigo' | 'orientacao-normativa' | 'enunciados' | 'outro';
type DocumentType = 'pdf' | 'doc' | 'link' | 'video';

interface Document {
  id: string;
  title: string;
  description: string | null;
  url: string;
  type: DocumentType;
  category: DocumentCategory;
  courseId: string | null;
  isPublic: boolean;
  isCommon: boolean;
  tags: string[];
  leiArticles: string[];
  alternativeUrls: string | null;
  size?: number;
  uploadedAt: string;
  // Feedback de IA/ML
  aiClassification?: string | null;
  feedbackRelevance?: string | null;
  feedbackReasoning?: string | null;
  feedbackGivenAt?: string | null;
  feedbackGivenBy?: string | null;
  aiSuggestedArticles?: string | null;
  // Resumo Automático
  summary?: string | null;
  summaryHighlights?: string | null;
  summaryGeneratedAt?: string | null;
  summaryEditedByAdmin?: boolean;
  // Enunciados
  entityType?: string | null;
  enunciadoNumber?: string | null;
}

interface AlternativeUrl {
  url: string;
  label: string;
  type: 'pdf' | 'link';
}

export default function EditDocumentPage() {
  const params = useParams();
  const router = useRouter();
  const documentId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [document, setDocument] = useState<Document | null>(null);

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [url, setUrl] = useState('');
  const [type, setType] = useState<DocumentType>('pdf');
  const [category, setCategory] = useState<DocumentCategory>('apostila');
  const [courseId, setCourseId] = useState<string>('');
  const [isPublic, setIsPublic] = useState(false);
  const [isCommon, setIsCommon] = useState(false);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [leiArticles, setLeiArticles] = useState<string[]>([]);

  // Alternative URLs/Files
  const [alternativeUrls, setAlternativeUrls] = useState<AlternativeUrl[]>([]);
  const [newAltUrl, setNewAltUrl] = useState('');
  const [newAltLabel, setNewAltLabel] = useState('');
  const [newAltType, setNewAltType] = useState<'pdf' | 'link'>('pdf');

  // Upload de novo arquivo
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Feedback de IA/ML (Fase 3D)
  const [feedbackRelevance, setFeedbackRelevance] = useState<string>('');
  const [feedbackReasoning, setFeedbackReasoning] = useState<string>('');
  const [aiClassification, setAiClassification] = useState<Record<string, unknown> | null>(null);
  const [aiSuggestedArticles, setAiSuggestedArticles] = useState<number[]>([]);

  // Resumo Automático (IA)
  const [summary, setSummary] = useState<string>('');

  // Enunciados
  const [entityType, setEntityType] = useState<string>('');
  const [enunciadoNumber, setEnunciadoNumber] = useState<string>('');

  // Carregar documento
  useEffect(() => {
    const loadDocument = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/admin/documents/${documentId}`);

        if (!response.ok) {
          throw new Error('Documento não encontrado');
        }

        const data: Document = await response.json();

        setDocument(data);
        setTitle(data.title);
        setDescription(data.description || '');
        setUrl(data.url);
        setType(data.type);
        setCategory(data.category);
        setCourseId(data.courseId || '');
        setIsPublic(data.isPublic);
        setIsCommon(data.isCommon);
        setTags(data.tags || []);
        setLeiArticles(data.leiArticles || []);

        // Parse alternativeUrls
        if (data.alternativeUrls) {
          try {
            const parsed = JSON.parse(data.alternativeUrls);
            setAlternativeUrls(Array.isArray(parsed) ? parsed : []);
          } catch {
            setAlternativeUrls([]);
          }
        }

        // Parse feedback fields (Fase 3D)
        setFeedbackRelevance(data.feedbackRelevance || '');
        setFeedbackReasoning(data.feedbackReasoning || '');

        if (data.aiClassification) {
          try {
            const parsed = JSON.parse(data.aiClassification);
            setAiClassification(parsed);
          } catch {
            setAiClassification(null);
          }
        }

        if (data.aiSuggestedArticles) {
          try {
            const parsed = JSON.parse(data.aiSuggestedArticles);
            setAiSuggestedArticles(Array.isArray(parsed) ? parsed : []);
          } catch {
            setAiSuggestedArticles([]);
          }
        }

        // Carrega resumo
        setSummary(data.summary || '');

        // Carrega campos de enunciados
        setEntityType(data.entityType || '');
        setEnunciadoNumber(data.enunciadoNumber || '');
      } catch (error) {
        console.error('Erro ao carregar documento:', error);
        alert('Erro ao carregar documento');
        router.push('/admin/documentos');
      } finally {
        setLoading(false);
      }
    };

    loadDocument();
  }, [documentId, router]);

  const handleSave = async () => {
    if (!title.trim()) {
      alert('Título é obrigatório');
      return;
    }

    if (!url.trim() && !selectedFile) {
      alert('URL ou arquivo é obrigatório');
      return;
    }

    try {
      setSaving(true);

      let finalUrl = url;

      // Upload de novo arquivo se selecionado
      if (selectedFile) {
        const uploadFormData = new FormData();
        uploadFormData.append('file', selectedFile);
        uploadFormData.append('courseId', courseId || 'comum');
        uploadFormData.append('title', title);
        uploadFormData.append('description', description);
        uploadFormData.append('category', category);
        uploadFormData.append('isPublic', isPublic.toString());
        uploadFormData.append('tags', JSON.stringify(tags));
        uploadFormData.append('leiArticles', JSON.stringify(leiArticles));

        const uploadResponse = await fetch('/api/admin/upload', {
          method: 'POST',
          body: uploadFormData,
        });

        if (!uploadResponse.ok) {
          throw new Error('Erro ao fazer upload do arquivo');
        }

        const uploadData = await uploadResponse.json();
        finalUrl = uploadData.url;
      }

      // Atualizar documento
      const updateResponse = await fetch(`/api/admin/documents/${documentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description,
          url: finalUrl,
          type,
          category,
          courseId: isCommon ? null : courseId,
          isPublic,
          isCommon,
          tags,
          leiArticles,
          alternativeUrls: alternativeUrls.length > 0 ? JSON.stringify(alternativeUrls) : null,
          // Feedback de IA/ML (Fase 3D)
          feedbackRelevance: feedbackRelevance || null,
          feedbackReasoning: feedbackReasoning || null,
          // Resumo Automático com IA
          summary: summary || null,
          summaryEditedByAdmin: document?.summary !== summary && !!summary,
          // Enunciados
          entityType: category === 'enunciados' ? (entityType || null) : null,
          enunciadoNumber: category === 'enunciados' ? (enunciadoNumber || null) : null,
        }),
      });

      if (!updateResponse.ok) {
        throw new Error('Erro ao atualizar documento');
      }

      alert('Documento atualizado com sucesso!');
      router.push('/admin/documentos');
    } catch (error) {
      console.error('Erro ao salvar:', error);
      alert('Erro ao salvar documento');
    } finally {
      setSaving(false);
    }
  };

  const handleAddTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim()]);
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(t => t !== tagToRemove));
  };

  const handleAddAlternativeUrl = () => {
    if (!newAltUrl.trim() || !newAltLabel.trim()) {
      alert('URL e rótulo são obrigatórios');
      return;
    }

    setAlternativeUrls([
      ...alternativeUrls,
      {
        url: newAltUrl.trim(),
        label: newAltLabel.trim(),
        type: newAltType,
      },
    ]);

    setNewAltUrl('');
    setNewAltLabel('');
    setNewAltType('pdf');
  };

  const handleRemoveAlternativeUrl = (index: number) => {
    setAlternativeUrls(alternativeUrls.filter((_, i) => i !== index));
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      // Atualizar tipo baseado na extensão
      if (file.name.endsWith('.pdf')) {
        setType('pdf');
      } else if (file.name.endsWith('.doc') || file.name.endsWith('.docx')) {
        setType('doc');
      }
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Carregando documento...</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  if (!document) {
    return (
      <AdminLayout>
        <div className="max-w-4xl mx-auto p-6">
          <p className="text-red-600">Documento não encontrado</p>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="max-w-4xl mx-auto p-6">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => router.push('/admin/documentos')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar para Documentos
          </button>
          <h1 className="text-3xl font-bold">Editar Documento</h1>
        </div>

        {/* Form */}
        <div className="bg-white rounded-lg shadow p-6 space-y-6">
          {/* Título */}
          <div>
            <label className="block text-sm font-medium mb-2">Título *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-2 border rounded focus:ring-2 focus:ring-blue-500"
              placeholder="Nome do documento"
            />
          </div>

          {/* Descrição */}
          <div>
            <label className="block text-sm font-medium mb-2">Descrição</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="w-full px-4 py-2 border rounded focus:ring-2 focus:ring-blue-500"
              placeholder="Descrição detalhada do documento"
            />
          </div>

          {/* URL Principal ou Upload */}
          <div>
            <label className="block text-sm font-medium mb-2">URL Principal ou Arquivo *</label>

            {/* Upload de novo arquivo */}
            <div className="mb-4">
              <input
                type="file"
                onChange={handleFileSelect}
                accept=".pdf,.doc,.docx"
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              />
              {selectedFile && (
                <p className="mt-2 text-sm text-green-600">
                  Novo arquivo selecionado: {selectedFile.name}
                </p>
              )}
            </div>

            {/* URL Manual */}
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="w-full px-4 py-2 border rounded focus:ring-2 focus:ring-blue-500"
              placeholder="https://exemplo.com/documento.pdf ou cole link"
            />
            <p className="text-xs text-gray-500 mt-1">
              URL atual: {document.url}
            </p>
          </div>

          {/* Tipo e Categoria */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Tipo</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as DocumentType)}
                className="w-full px-4 py-2 border rounded"
              >
                <option value="pdf">PDF</option>
                <option value="doc">DOC/DOCX</option>
                <option value="link">Link Externo</option>
                <option value="video">Vídeo</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Categoria</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as DocumentCategory)}
                className="w-full px-4 py-2 border rounded"
              >
                <option value="apostila">Apostila</option>
                <option value="acordao">Acórdão</option>
                <option value="parecer">Parecer</option>
                <option value="edital">Edital</option>
                <option value="artigo">Artigo</option>
                <option value="orientacao-normativa">Orientação Normativa</option>
                <option value="enunciados">Enunciados</option>
                <option value="outro">Outro</option>
              </select>
            </div>
          </div>

          {/* Campos específicos para Enunciados */}
          {category === 'enunciados' && (
            <div className="grid grid-cols-2 gap-4 p-4 bg-blue-50 border-2 border-blue-200 rounded-lg">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Entidade *
                </label>
                <select
                  value={entityType}
                  onChange={(e) => setEntityType(e.target.value)}
                  className="w-full px-4 py-2 border rounded"
                  required
                >
                  <option value="">Selecione a entidade</option>
                  <option value="IBDA">IBDA - Instituto Brasileiro de Direito Administrativo</option>
                  <option value="INCP">INCP - Instituto Nacional da Contratação Pública</option>
                  <option value="CJF">CJF - Conselho da Justiça Federal</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Número do Enunciado (Opcional)
                </label>
                <input
                  type="text"
                  value={enunciadoNumber}
                  onChange={(e) => setEnunciadoNumber(e.target.value)}
                  placeholder="Ex: 123, 123/2024, ou deixe em branco"
                  className="w-full px-4 py-2 border rounded"
                />
                <p className="text-xs text-gray-600 mt-1">
                  Formato flexível: pode ser apenas número, número/ano, ou texto livre
                </p>
              </div>
            </div>
          )}

          {/* Curso */}
          <div>
            <label className="block text-sm font-medium mb-2">Curso</label>
            <select
              value={courseId}
              onChange={(e) => setCourseId(e.target.value)}
              className="w-full px-4 py-2 border rounded"
              disabled={isCommon}
            >
              <option value="">Selecione um curso</option>
              {courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.title}
                </option>
              ))}
            </select>
          </div>

          {/* Checkboxes */}
          <div className="space-y-2">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={isPublic}
                onChange={(e) => setIsPublic(e.target.checked)}
                className="rounded"
              />
              <span>Público (visível sem login)</span>
            </label>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={isCommon}
                onChange={(e) => {
                  setIsCommon(e.target.checked);
                  if (e.target.checked) setCourseId('');
                }}
                className="rounded"
              />
              <span>Comum a todos os cursos</span>
            </label>
          </div>

          {/* Tags */}
          <div>
            <label className="block text-sm font-medium mb-2">Tags</label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                className="flex-1 px-4 py-2 border rounded"
                placeholder="Digite uma tag e pressione Enter"
              />
              <button
                onClick={handleAddTag}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {tags.map((tag, index) => (
                <span
                  key={index}
                  className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm"
                >
                  {tag}
                  <button
                    onClick={() => handleRemoveTag(tag)}
                    className="hover:text-blue-900"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          </div>

          {/* Lei Articles Selector */}
          <div>
            <label className="block text-sm font-medium mb-2">Artigos da Lei 14.133/2021</label>
            <LeiArticleSelector
              selectedArticles={leiArticles}
              onChange={setLeiArticles}
            />
          </div>

          {/* Gerador de Resumo Automático com IA */}
          <div className="border-t pt-6">
            <SummaryGenerator
              documentId={documentId}
              documentTitle={title}
              currentSummary={summary}
              onSummaryGenerated={(newSummary) => setSummary(newSummary)}
            />
          </div>

          {/* Links/Arquivos Alternativos */}
          <div>
            <label className="block text-sm font-medium mb-4">
              Links/Arquivos de Referência Adicionais
            </label>

            {/* Lista de URLs alternativas */}
            {alternativeUrls.length > 0 && (
              <div className="mb-4 space-y-2">
                {alternativeUrls.map((alt, index) => (
                  <div key={index} className="flex items-center gap-2 p-3 bg-gray-50 rounded">
                    <ExternalLink className="w-4 h-4 text-gray-400" />
                    <div className="flex-1">
                      <p className="font-medium text-sm">{alt.label}</p>
                      <p className="text-xs text-gray-500 truncate">{alt.url}</p>
                      <span className="text-xs bg-gray-200 px-2 py-0.5 rounded">
                        {alt.type === 'pdf' ? 'PDF' : 'Link'}
                      </span>
                    </div>
                    <button
                      onClick={() => handleRemoveAlternativeUrl(index)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Adicionar nova URL */}
            <div className="border rounded p-4 space-y-3">
              <input
                type="text"
                value={newAltLabel}
                onChange={(e) => setNewAltLabel(e.target.value)}
                className="w-full px-4 py-2 border rounded"
                placeholder="Rótulo (ex: Fundamentação Original, PDF Completo)"
              />
              <input
                type="url"
                value={newAltUrl}
                onChange={(e) => setNewAltUrl(e.target.value)}
                className="w-full px-4 py-2 border rounded"
                placeholder="URL do link/arquivo"
              />
              <div className="flex gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    checked={newAltType === 'pdf'}
                    onChange={() => setNewAltType('pdf')}
                  />
                  PDF
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    checked={newAltType === 'link'}
                    onChange={() => setNewAltType('link')}
                  />
                  Link
                </label>
              </div>
              <button
                onClick={handleAddAlternativeUrl}
                className="w-full px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Adicionar Referência
              </button>
            </div>
          </div>

          {/* Sistema de Feedback de IA/ML (Fase 3D) */}
          <div className="border-t pt-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <span className="text-2xl">🤖</span>
              Sistema de Feedback para IA/ML
            </h3>

            {/* Mostrar classificação da IA se existir */}
            {aiClassification && (
              <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h4 className="font-semibold text-blue-900 mb-2">Classificação Automática (IA):</h4>
                <div className="text-sm space-y-1">
                  <p><strong>Cursos sugeridos:</strong> {aiClassification.courseSlugs?.join(', ') || 'N/A'}</p>
                  <p><strong>Categoria:</strong> {aiClassification.category || 'N/A'}</p>
                  <p><strong>Confiança:</strong> {aiClassification.confidence}%</p>
                  {aiClassification.reasoning && (
                    <p className="mt-2 text-gray-700"><strong>Raciocínio:</strong> {aiClassification.reasoning}</p>
                  )}
                </div>
              </div>
            )}

            {/* Mostrar artigos sugeridos pela IA */}
            {aiSuggestedArticles && aiSuggestedArticles.length > 0 && (
              <div className="mb-4 p-4 bg-purple-50 border border-purple-200 rounded-lg">
                <h4 className="font-semibold text-purple-900 mb-2">Artigos Lei 14.133 Sugeridos pela IA:</h4>
                <div className="flex flex-wrap gap-2">
                  {aiSuggestedArticles.map((art) => (
                    <span
                      key={art}
                      className="px-3 py-1 bg-purple-200 text-purple-900 rounded-full text-sm font-medium"
                    >
                      Art. {art}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Formulário de Feedback */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Relevância do Documento para o Repositório
                </label>
                <select
                  value={feedbackRelevance}
                  onChange={(e) => setFeedbackRelevance(e.target.value)}
                  className="w-full px-4 py-2 border rounded focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Selecione uma opção</option>
                  <option value="relevant">✅ Relevante - Documento adequado ao repositório</option>
                  <option value="partially-relevant">⚠️ Parcialmente Relevante - Pode ser útil mas não é ideal</option>
                  <option value="irrelevant">❌ Irrelevante - Não deve estar no repositório</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Essa informação será usada para treinar a IA a identificar documentos relevantes automaticamente
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Explicação / Raciocínio (Por que é ou não relevante?)
                </label>
                <textarea
                  value={feedbackReasoning}
                  onChange={(e) => setFeedbackReasoning(e.target.value)}
                  rows={4}
                  className="w-full px-4 py-2 border rounded focus:ring-2 focus:ring-blue-500"
                  placeholder="Explique por que este documento é relevante ou irrelevante para o repositório. Exemplo: 'Este acórdão trata especificamente de dispensa de licitação prevista no art. 75, sendo altamente relevante para o curso de Contratação Direta' ou 'Este documento é sobre aposentadoria de servidor, tema não relacionado a licitações e contratos'"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Quanto mais detalhada sua explicação, melhor a IA aprenderá a classificar documentos futuros
                </p>
              </div>

              {document.feedbackGivenAt && (
                <div className="p-3 bg-green-50 border border-green-200 rounded text-sm">
                  <strong className="text-green-900">Feedback anterior dado em:</strong>{' '}
                  {new Date(document.feedbackGivenAt).toLocaleString('pt-BR')}
                  {document.feedbackGivenBy && ` por ${document.feedbackGivenBy}`}
                </div>
              )}
            </div>
          </div>

          {/* Botões de Ação */}
          <div className="flex gap-4 pt-6 border-t">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-400"
            >
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  Salvar Alterações
                </>
              )}
            </button>

            <button
              onClick={() => router.push('/admin/documentos')}
              className="px-6 py-3 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
