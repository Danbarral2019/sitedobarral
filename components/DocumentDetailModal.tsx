'use client';

import { useState, useEffect } from 'react';
import {
  X,
  Download,
  ExternalLink,
  FileText,
  Video,
  Calendar,
  Tag,
  Scale,
  Target,
  Lightbulb,
  BookOpen,
  AlertCircle,
  Heart,
  Loader2,
  ChevronRight,
  Newspaper,
  Building2,
  Hash,
  Globe,
  Shield,
} from 'lucide-react';
import Link from 'next/link';
import { safeParseArray } from '@/lib/utils';

interface DocumentDetailModalProps {
  documentId: string;
  onClose: () => void;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
}

interface DocumentData {
  id: string;
  title: string;
  description: string | null;
  category: string;
  type: 'pdf' | 'doc' | 'link' | 'video';
  url: string;
  uploadedAt: string;
  tags: string | null;
  leiArticles: string | null;
  courseId: string | null;

  // Educational fields (from wizard)
  summary: string | null;
  keyPoints: string | null;
  practicalUse: string | null;
  publicNotes: string | null;
  importance: string | null;

  // AGU-specific fields
  onNumber: number | null;
  onYear: number | null;
  acordaoNumero: number | null;
  acordaoAno: number | null;
  entityType: string | null;
  enunciadoNumber: string | null;
  issuerOrg: string | null;
  esfera: string | null;

  // DOU fields
  douUrl: string | null;
  douData: string | null;
  douSecao: string | null;
  douPagina: string | null;
  douEdicao: string | null;

  // Alternative URLs
  alternativeUrls: string | null;

  // Importance
  notesImportance: string | null;

  // TCU fields
  tcuNumeroAcordao: string | null;
  tcuArea: string | null;
  tcuTema: string | null;
  tcuRelator: string | null;
  tcuOrgaoJulgador: string | null;
  tcuDataJulgamento: string | null;
}

// Detect if a URL points to AGU's Sapiens (internal system)
function isSapiensUrl(url: string): boolean {
  if (!url) return false;
  const lower = url.toLowerCase();
  return (
    lower.includes('sapiens.agu.gov.br') ||
    lower.includes('supersapiens.agu.gov.br') ||
    (lower.includes('sapiens') && lower.includes('agu'))
  );
}

// Get a user-friendly category label
function getCategoryLabel(category: string): string {
  const labels: Record<string, string> = {
    'parecer': 'Parecer',
    'parecer-vinculante': 'Parecer Vinculante',
    'decor': 'DECOR/AGU',
    'orientacao-normativa': 'Orientacao Normativa',
    'enunciados': 'Enunciado',
    'acordao': 'Acordao TCU',
    'sumula': 'Sumula',
    'apostila': 'Apostila',
    'conteudo-programatico': 'Conteudo Programatico',
    'material-complementar': 'Material Complementar',
    'bibliografia': 'Bibliografia',
    'manual_tcu': 'Manual do TCU',
    'boa_pratica': 'Boa Pratica',
    'outro': 'Outro',
  };
  return labels[category] || category.charAt(0).toUpperCase() + category.slice(1);
}

// Get importance badge color
function getImportanceBadge(importance: string | null) {
  if (!importance) return null;
  const config: Record<string, { bg: string; text: string; label: string }> = {
    critica: { bg: 'bg-red-100', text: 'text-red-700', label: 'Importancia Critica' },
    alta: { bg: 'bg-orange-100', text: 'text-orange-700', label: 'Alta Importancia' },
    media: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Media Importancia' },
    baixa: { bg: 'bg-gray-100', text: 'text-gray-600', label: 'Referencia' },
  };
  return config[importance] || null;
}

export default function DocumentDetailModal({
  documentId,
  onClose,
  isFavorite = false,
  onToggleFavorite,
}: DocumentDetailModalProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [document, setDocument] = useState<DocumentData | null>(null);

  // Fetch document data
  useEffect(() => {
    const fetchDocument = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(`/api/documents/${documentId}`);

        if (!response.ok) {
          throw new Error('Documento nao encontrado');
        }

        const data = await response.json();
        setDocument(data);
      } catch (err) {
        console.error('[Document Modal] Erro ao carregar:', err);
        setError(err instanceof Error ? err.message : 'Erro ao carregar documento');
      } finally {
        setLoading(false);
      }
    };

    fetchDocument();
  }, [documentId]);

  // Parse arrays
  const parseTags = (tags: string | null): string[] => {
    return safeParseArray(tags);
  };

  const parseLeiArticles = (leiArticles: string | null): string[] => {
    return safeParseArray(leiArticles);
  };

  const parseKeyPoints = (keyPoints: string | null): string[] => {
    if (!keyPoints) return [];
    return keyPoints.split('\n').filter(point => point.trim().length > 0);
  };

  // Download handler
  const handleDownload = () => {
    fetch('/api/access-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'download',
        documentId: document?.id,
        courseId: document?.courseId,
      }),
    }).catch(console.error);
  };

  const handleView = () => {
    fetch('/api/access-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'view',
        documentId: document?.id,
        courseId: document?.courseId,
      }),
    }).catch(console.error);
  };

  // Close on backdrop click
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // Close on Escape key
  useEffect(() => {
    if (typeof window === 'undefined' || !window.document) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.document.addEventListener('keydown', handleEscape);
    return () => window.document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  // Loading state
  if (loading) {
    return (
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={handleBackdropClick}
      >
        <div className="bg-white rounded-2xl shadow-2xl p-12 text-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Carregando documento...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !document) {
    return (
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={handleBackdropClick}
      >
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md">
          <div className="text-center">
            <AlertCircle className="w-12 h-12 text-red-600 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-red-900 mb-2">Erro ao Carregar</h2>
            <p className="text-red-700 mb-4">{error || 'Documento nao encontrado'}</p>
            <button
              onClick={onClose}
              className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              Fechar
            </button>
          </div>
        </div>
      </div>
    );
  }

  const tags = parseTags(document.tags);
  const leiArticles = parseLeiArticles(document.leiArticles);
  const keyPoints = parseKeyPoints(document.keyPoints);
  const importanceBadge = getImportanceBadge(document.notesImportance);

  // Determine the best URL to use
  const urlIsSapiens = isSapiensUrl(document.url);
  const primaryUrl = urlIsSapiens && document.douUrl ? document.douUrl : document.url;
  const hasDouUrl = !!document.douUrl && document.douUrl !== document.url;

  // Build document identifier string (ON n/ano, Acordao n/ano, etc.)
  const documentIdentifier = (() => {
    if (document.onNumber && document.onYear) {
      return `ON AGU n. ${document.onNumber}/${document.onYear}`;
    }
    if (document.acordaoNumero && document.acordaoAno) {
      return `Acordao n. ${document.acordaoNumero}/${document.acordaoAno}`;
    }
    if (document.tcuNumeroAcordao) {
      return document.tcuNumeroAcordao;
    }
    if (document.enunciadoNumber && document.entityType) {
      return `Enunciado ${document.entityType} n. ${document.enunciadoNumber}`;
    }
    return null;
  })();

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={handleBackdropClick}
    >
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-indigo-700 text-white p-6 rounded-t-2xl z-10">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-4 flex-1">
              <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center flex-shrink-0">
                {document.type === 'video' ? (
                  <Video className="w-6 h-6" />
                ) : (
                  <FileText className="w-6 h-6" />
                )}
              </div>
              <div className="flex-1">
                <h2 className="text-2xl font-bold mb-1">{document.title}</h2>

                {/* Document identifier and importance */}
                <div className="flex flex-wrap items-center gap-2 mt-1">
                  {documentIdentifier && (
                    <span className="text-xs font-semibold bg-white/20 px-2.5 py-1 rounded-full">
                      {documentIdentifier}
                    </span>
                  )}
                  {importanceBadge && (
                    <span className="text-xs font-semibold bg-white/25 px-2.5 py-1 rounded-full">
                      {importanceBadge.label}
                    </span>
                  )}
                </div>

                {/* Breadcrumbs - Lei 14.133 */}
                {leiArticles.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2 text-sm text-blue-100 mt-2">
                    <Scale className="w-4 h-4" />
                    <span>Lei 14.133/2021</span>
                    {leiArticles.slice(0, 3).map((artNum) => (
                      <div key={artNum} className="flex items-center gap-2">
                        <ChevronRight className="w-3 h-3" />
                        <Link
                          href={`/area-restrita/artigo/${artNum}`}
                          onClick={onClose}
                          className="hover:text-white underline transition-colors"
                        >
                          Art. {artNum}
                        </Link>
                      </div>
                    ))}
                    {leiArticles.length > 3 && (
                      <span className="text-blue-200">+{leiArticles.length - 3} mais</span>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Header Actions */}
            <div className="flex items-center gap-2 ml-2">
              {onToggleFavorite && (
                <button
                  onClick={onToggleFavorite}
                  className={`p-2 rounded-lg transition-colors ${
                    isFavorite
                      ? 'bg-red-500 hover:bg-red-600'
                      : 'bg-white/20 hover:bg-white/30'
                  }`}
                  aria-label={isFavorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
                >
                  <Heart className={`w-5 h-5 ${isFavorite ? 'fill-current' : ''}`} />
                </button>
              )}
              <button
                onClick={onClose}
                className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                aria-label="Fechar"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Metadata Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            <div className="bg-gray-50 p-3.5 rounded-lg border border-gray-200">
              <div className="flex items-center gap-2 text-gray-500 mb-1">
                <Tag className="w-3.5 h-3.5" />
                <span className="text-xs font-medium">Categoria</span>
              </div>
              <p className="font-bold text-gray-900 text-sm">{getCategoryLabel(document.category)}</p>
            </div>

            <div className="bg-gray-50 p-3.5 rounded-lg border border-gray-200">
              <div className="flex items-center gap-2 text-gray-500 mb-1">
                <FileText className="w-3.5 h-3.5" />
                <span className="text-xs font-medium">Tipo</span>
              </div>
              <p className="font-bold text-gray-900 text-sm uppercase">{document.type}</p>
            </div>

            <div className="bg-gray-50 p-3.5 rounded-lg border border-gray-200">
              <div className="flex items-center gap-2 text-gray-500 mb-1">
                <Calendar className="w-3.5 h-3.5" />
                <span className="text-xs font-medium">Cadastrado</span>
              </div>
              <p className="font-bold text-gray-900 text-sm">
                {new Date(document.uploadedAt).toLocaleDateString('pt-BR')}
              </p>
            </div>

            {/* Issuer Org */}
            {document.issuerOrg && (
              <div className="bg-gray-50 p-3.5 rounded-lg border border-gray-200">
                <div className="flex items-center gap-2 text-gray-500 mb-1">
                  <Building2 className="w-3.5 h-3.5" />
                  <span className="text-xs font-medium">Orgao</span>
                </div>
                <p className="font-bold text-gray-900 text-sm">{document.issuerOrg}</p>
              </div>
            )}

            {/* Esfera */}
            {document.esfera && (
              <div className="bg-gray-50 p-3.5 rounded-lg border border-gray-200">
                <div className="flex items-center gap-2 text-gray-500 mb-1">
                  <Shield className="w-3.5 h-3.5" />
                  <span className="text-xs font-medium">Esfera</span>
                </div>
                <p className="font-bold text-gray-900 text-sm capitalize">{document.esfera}</p>
              </div>
            )}

            {/* TCU specific metadata */}
            {document.tcuRelator && (
              <div className="bg-gray-50 p-3.5 rounded-lg border border-gray-200">
                <div className="flex items-center gap-2 text-gray-500 mb-1">
                  <Scale className="w-3.5 h-3.5" />
                  <span className="text-xs font-medium">Relator</span>
                </div>
                <p className="font-bold text-gray-900 text-sm">{document.tcuRelator}</p>
              </div>
            )}

            {document.tcuOrgaoJulgador && (
              <div className="bg-gray-50 p-3.5 rounded-lg border border-gray-200">
                <div className="flex items-center gap-2 text-gray-500 mb-1">
                  <Building2 className="w-3.5 h-3.5" />
                  <span className="text-xs font-medium">Orgao Julgador</span>
                </div>
                <p className="font-bold text-gray-900 text-sm">{document.tcuOrgaoJulgador}</p>
              </div>
            )}

            {document.tcuDataJulgamento && (
              <div className="bg-gray-50 p-3.5 rounded-lg border border-gray-200">
                <div className="flex items-center gap-2 text-gray-500 mb-1">
                  <Calendar className="w-3.5 h-3.5" />
                  <span className="text-xs font-medium">Julgamento</span>
                </div>
                <p className="font-bold text-gray-900 text-sm">
                  {new Date(document.tcuDataJulgamento).toLocaleDateString('pt-BR')}
                </p>
              </div>
            )}

            {/* TCU Area/Tema */}
            {document.tcuArea && (
              <div className="bg-gray-50 p-3.5 rounded-lg border border-gray-200 col-span-2">
                <div className="flex items-center gap-2 text-gray-500 mb-1">
                  <Hash className="w-3.5 h-3.5" />
                  <span className="text-xs font-medium">Area / Tema</span>
                </div>
                <p className="font-bold text-gray-900 text-sm">
                  {document.tcuArea}
                  {document.tcuTema && ` - ${document.tcuTema}`}
                </p>
              </div>
            )}
          </div>

          {/* DOU Publication Info */}
          {(document.douData || document.douUrl) && (
            <div className="bg-sky-50 border border-sky-200 rounded-xl p-4 flex items-start gap-3">
              <div className="p-2 bg-sky-100 rounded-lg flex-shrink-0">
                <Newspaper className="w-4 h-4 text-sky-700" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-bold text-sky-900 mb-1">Publicacao no DOU</h4>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-sky-800">
                  {document.douData && (
                    <span>
                      Data: <strong>{new Date(document.douData).toLocaleDateString('pt-BR')}</strong>
                    </span>
                  )}
                  {document.douSecao && (
                    <span>
                      Secao: <strong>{document.douSecao}</strong>
                    </span>
                  )}
                  {document.douPagina && (
                    <span>
                      Pagina: <strong>{document.douPagina}</strong>
                    </span>
                  )}
                  {document.douEdicao && (
                    <span>
                      Edicao: <strong>{document.douEdicao}</strong>
                    </span>
                  )}
                </div>
                {document.douUrl && (
                  <a
                    href={document.douUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={handleView}
                    className="inline-flex items-center gap-1.5 text-sm font-semibold text-sky-700 hover:text-sky-900 mt-2 transition-colors"
                  >
                    <Globe className="w-3.5 h-3.5" />
                    Ver no Diario Oficial
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Sapiens URL Warning */}
          {urlIsSapiens && !document.douUrl && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-amber-900">Link interno da AGU</p>
                <p className="text-xs text-amber-700 mt-0.5">
                  O link deste documento aponta para o sistema Sapiens da AGU, que requer acesso interno.
                  Estamos trabalhando para disponibilizar o link publico.
                </p>
              </div>
            </div>
          )}

          {/* AI Summary - Gradient Box */}
          {document.summary && (
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="p-2 bg-blue-600 rounded-lg">
                  <BookOpen className="w-5 h-5 text-white" />
                </div>
                <h3 className="text-lg font-bold text-blue-900">Resumo</h3>
              </div>
              <p className="text-gray-800 leading-relaxed whitespace-pre-wrap">{document.summary}</p>
            </div>
          )}

          {/* Key Points - Target Icon */}
          {keyPoints.length > 0 && (
            <div className="bg-purple-50 border-2 border-purple-200 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="p-2 bg-purple-600 rounded-lg">
                  <Target className="w-5 h-5 text-white" />
                </div>
                <h3 className="text-lg font-bold text-purple-900">Pontos-Chave</h3>
              </div>
              <ul className="space-y-2">
                {keyPoints.map((point, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-6 h-6 bg-purple-600 text-white rounded-full flex items-center justify-center text-xs font-bold mt-0.5">
                      {index + 1}
                    </div>
                    <p className="text-gray-800 flex-1">{point}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Practical Use - Green Background */}
          {document.practicalUse && (
            <div className="bg-green-50 border-2 border-green-200 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="p-2 bg-green-600 rounded-lg">
                  <Lightbulb className="w-5 h-5 text-white" />
                </div>
                <h3 className="text-lg font-bold text-green-900">Aplicacao Pratica</h3>
              </div>
              <p className="text-gray-800 leading-relaxed whitespace-pre-wrap">{document.practicalUse}</p>
            </div>
          )}

          {/* Professor Notes - Amber Background + Italic */}
          {document.publicNotes && (
            <div className="bg-amber-50 border-2 border-amber-200 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="p-2 bg-amber-600 rounded-lg">
                  <BookOpen className="w-5 h-5 text-white" />
                </div>
                <h3 className="text-lg font-bold text-amber-900">Observacoes do Prof. Barral</h3>
              </div>
              <p className="text-gray-800 leading-relaxed italic whitespace-pre-wrap">{document.publicNotes}</p>
            </div>
          )}

          {/* Description (fallback if no summary) */}
          {document.description && !document.summary && (
            <div>
              <h3 className="text-lg font-bold text-gray-900 mb-3">Descricao</h3>
              <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r-lg">
                <p className="text-gray-800 leading-relaxed">{document.description}</p>
              </div>
            </div>
          )}

          {/* Tags */}
          {tags.length > 0 && (
            <div>
              <h3 className="text-lg font-bold text-gray-900 mb-3">Tags</h3>
              <div className="flex flex-wrap gap-2">
                {tags.map((tag, index) => (
                  <span
                    key={index}
                    className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm font-medium"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Linked Lei Articles */}
          {leiArticles.length > 0 && (
            <div>
              <h3 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
                <Scale className="w-5 h-5 text-blue-600" />
                Artigos da Lei 14.133 Relacionados
              </h3>
              <div className="flex flex-wrap gap-2">
                {leiArticles.map((artNum) => (
                  <Link
                    key={artNum}
                    href={`/area-restrita/artigo/${artNum}`}
                    onClick={onClose}
                    className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors flex items-center gap-1"
                  >
                    Art. {artNum}
                    <ChevronRight className="w-4 h-4" />
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-wrap gap-3 pt-4 border-t border-gray-200">
            {document.type === 'link' ? (
              <a
                href={primaryUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={handleView}
                className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-700 text-white px-6 py-3 rounded-xl font-bold hover:from-blue-700 hover:to-indigo-800 transition-all flex items-center justify-center gap-2 shadow-lg min-w-[200px]"
              >
                <ExternalLink className="w-5 h-5" />
                {urlIsSapiens && document.douUrl ? 'Ver no DOU' : 'Acessar Documento'}
              </a>
            ) : (
              <a
                href={`/api/documents/${documentId}/download`}
                onClick={handleDownload}
                className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-700 text-white px-6 py-3 rounded-xl font-bold hover:from-blue-700 hover:to-indigo-800 transition-all flex items-center justify-center gap-2 shadow-lg min-w-[200px]"
              >
                <Download className="w-5 h-5" />
                Download do Arquivo
              </a>
            )}

            {/* Secondary DOU link when primary is not DOU */}
            {hasDouUrl && !urlIsSapiens && (
              <a
                href={document.douUrl!}
                target="_blank"
                rel="noopener noreferrer"
                onClick={handleView}
                className="px-5 py-3 bg-sky-100 text-sky-800 rounded-xl font-bold hover:bg-sky-200 transition-colors flex items-center gap-2"
              >
                <Newspaper className="w-4 h-4" />
                DOU
              </a>
            )}

            <button
              onClick={onClose}
              className="px-6 py-3 bg-gray-200 text-gray-800 rounded-xl font-bold hover:bg-gray-300 transition-colors"
            >
              Fechar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
