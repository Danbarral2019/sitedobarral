'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Eye, EyeOff, Edit2, Trash2, Search, ChevronDown, ChevronUp,
  CheckSquare, Square, FileText, Scale, BookOpen, AlertTriangle,
  CheckCircle, AlertCircle, Calendar, Building2, Hash, Tag, Layers,
  ExternalLink
} from 'lucide-react';
import { courses } from '@/data/courses';
import { getLeiArticles } from '@/lib/lei-articles';

// Types
export interface DocumentData {
  id: string;
  title: string;
  description?: string;
  type: 'pdf' | 'doc' | 'link' | 'video';
  url: string;
  category: string;
  courseId: string | null;
  isPublic: boolean;
  isCommon?: boolean;
  leiArticles?: string | string[];
  tags?: string | string[];
  size?: number;
  uploadedAt: string | Date;
  reviewed?: boolean;
  reviewedAt?: string;
  entityType?: string;
  enunciadoNumber?: string;
  onNumber?: number;
  onYear?: number;
}

interface DocumentCardProps {
  document: DocumentData;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onPreview: (doc: DocumentData) => void;
  onDelete: (id: string) => void;
}

// Helper: Parse JSON array safely (handles string, array, null, undefined)
function safeParseArray(value: string | string[] | null | undefined): string[] {
  if (!value) return [];
  // Already an array
  if (Array.isArray(value)) return value;
  // String - try JSON parse
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    // Try CSV format
    if (value.includes(',')) {
      return value.split(',').map(s => s.trim()).filter(Boolean);
    }
    return value ? [value] : [];
  }
}

// Category display config
const CATEGORY_CONFIG: Record<string, { label: string; color: string; icon: React.ComponentType<{ className?: string }> }> = {
  'apostila': { label: 'Apostila', color: 'bg-blue-100 text-blue-800', icon: BookOpen },
  'acordao': { label: 'Acórdão', color: 'bg-amber-100 text-amber-800', icon: Scale },
  'parecer': { label: 'Parecer', color: 'bg-green-100 text-green-800', icon: FileText },
  'orientacao-normativa': { label: 'ON AGU', color: 'bg-purple-100 text-purple-800', icon: Building2 },
  'enunciados': { label: 'Enunciado', color: 'bg-indigo-100 text-indigo-800', icon: Hash },
  'sumula': { label: 'Sumula', color: 'bg-pink-100 text-pink-800', icon: Scale },
  'edital': { label: 'Edital', color: 'bg-cyan-100 text-cyan-800', icon: FileText },
  'artigo': { label: 'Artigo', color: 'bg-teal-100 text-teal-800', icon: FileText },
  'outro': { label: 'Outro', color: 'bg-gray-100 text-gray-800', icon: FileText },
};

// Completion status logic
type CompletionStatus = 'complete' | 'warning' | 'critical';

function getCompletionStatus(doc: DocumentData): { status: CompletionStatus; issues: string[] } {
  const issues: string[] = [];

  // Critical: missing required fields
  if (!doc.title) issues.push('Sem titulo');
  if (!doc.category) issues.push('Sem categoria');

  // Category-specific checks
  if (doc.category === 'orientacao-normativa') {
    if (!doc.onNumber) issues.push('Sem numero ON');
    if (!doc.onYear) issues.push('Sem ano ON');
  }

  if (doc.category === 'enunciados' || doc.category === 'sumula') {
    if (!doc.entityType) issues.push('Sem entidade');
  }

  // Warning: missing optional but recommended fields
  const tags = safeParseArray(doc.tags);
  const articles = getLeiArticles(doc);

  if (tags.length === 0 && articles.length === 0) {
    issues.push('Sem tags ou artigos');
  }

  if (!doc.description) {
    issues.push('Sem descricao');
  }

  // Determine status
  const hasCritical = !doc.title || !doc.category ||
    (doc.category === 'orientacao-normativa' && (!doc.onNumber || !doc.onYear)) ||
    ((doc.category === 'enunciados' || doc.category === 'sumula') && !doc.entityType);

  if (hasCritical) return { status: 'critical', issues };
  if (issues.length > 0) return { status: 'warning', issues };
  return { status: 'complete', issues: [] };
}

const STATUS_CONFIG: Record<CompletionStatus, { color: string; bgColor: string; icon: React.ComponentType<{ className?: string }> }> = {
  complete: { color: 'text-green-600', bgColor: 'bg-green-50 border-green-200', icon: CheckCircle },
  warning: { color: 'text-yellow-600', bgColor: 'bg-yellow-50 border-yellow-200', icon: AlertCircle },
  critical: { color: 'text-red-600', bgColor: 'bg-red-50 border-red-200', icon: AlertTriangle },
};

export function DocumentCard({ document, isSelected, onSelect, onPreview, onDelete }: DocumentCardProps) {
  const router = useRouter();
  const [isExpanded, setIsExpanded] = useState(false);

  const course = document.courseId ? courses.find(c => c.id === document.courseId) : null;
  const categoryConfig = CATEGORY_CONFIG[document.category] || CATEGORY_CONFIG['outro'];
  const CategoryIcon = categoryConfig.icon;
  const completion = getCompletionStatus(document);
  const StatusIcon = STATUS_CONFIG[completion.status].icon;

  const tags = safeParseArray(document.tags);
  const leiArticles = getLeiArticles(document);

  return (
    <div
      className={`rounded-xl border-2 transition-all overflow-hidden ${
        isSelected
          ? 'border-blue-500 bg-blue-50/50'
          : completion.status === 'critical'
            ? 'border-red-200 bg-red-50/30'
            : completion.status === 'warning'
              ? 'border-yellow-200 bg-yellow-50/30'
              : 'border-gray-200 bg-white hover:border-gray-300'
      }`}
    >
      {/* Card Header - Always visible */}
      <div className="p-4">
        <div className="flex items-start gap-3">
          {/* Checkbox */}
          <button
            onClick={() => onSelect(document.id)}
            className="mt-1 flex-shrink-0"
          >
            {isSelected ? (
              <CheckSquare className="w-5 h-5 text-blue-600" />
            ) : (
              <Square className="w-5 h-5 text-gray-400 hover:text-gray-600" />
            )}
          </button>

          {/* Completion Status Indicator */}
          <div className={`mt-1 flex-shrink-0 ${STATUS_CONFIG[completion.status].color}`}>
            <StatusIcon className="w-5 h-5" />
          </div>

          {/* Main Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              {/* Category Badge */}
              <span className={`px-2 py-0.5 rounded-full text-xs font-bold flex items-center gap-1 ${categoryConfig.color}`}>
                <CategoryIcon className="w-3 h-3" />
                {categoryConfig.label}
              </span>

              {/* ON Number (if applicable) */}
              {document.category === 'orientacao-normativa' && document.onNumber && (
                <span className="px-2 py-0.5 bg-purple-200 text-purple-900 rounded-full text-xs font-bold">
                  ON {document.onNumber}/{document.onYear}
                </span>
              )}

              {/* Entity Badge (for enunciados) */}
              {(document.category === 'enunciados' || document.category === 'sumula') && document.entityType && (
                <span className={`px-2 py-0.5 text-xs font-bold rounded-full ${
                  document.entityType === 'IBDA' ? 'bg-purple-100 text-purple-800' :
                  document.entityType === 'INCP' ? 'bg-indigo-100 text-indigo-800' :
                  document.entityType === 'CJF' ? 'bg-cyan-100 text-cyan-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {document.entityType}
                </span>
              )}

              {/* Visibility Badge */}
              {document.isPublic ? (
                <span className="px-2 py-0.5 bg-green-100 text-green-800 text-xs font-bold rounded-full flex items-center gap-1">
                  <Eye className="w-3 h-3" />
                  Publico
                </span>
              ) : (
                <span className="px-2 py-0.5 bg-orange-100 text-orange-800 text-xs font-bold rounded-full flex items-center gap-1">
                  <EyeOff className="w-3 h-3" />
                  Restrito
                </span>
              )}

              {/* Common Badge */}
              {document.isCommon && (
                <span className="px-2 py-0.5 bg-gradient-to-r from-blue-100 to-purple-100 text-purple-800 text-xs font-bold rounded-full flex items-center gap-1">
                  <Layers className="w-3 h-3" />
                  Todos os Cursos
                </span>
              )}

              {/* Review Status */}
              {document.reviewed ? (
                <span className="px-2 py-0.5 bg-blue-100 text-blue-800 text-xs font-bold rounded-full">
                  Revisado
                </span>
              ) : (
                <span className="px-2 py-0.5 bg-yellow-100 text-yellow-800 text-xs font-bold rounded-full animate-pulse">
                  Novo
                </span>
              )}
            </div>

            {/* Title */}
            <h3 className="font-bold text-gray-900 line-clamp-1">{document.title}</h3>

            {/* Course */}
            <p className="text-sm text-gray-600 mt-0.5">
              {document.isCommon ? 'Disponivel em todos os cursos' : course?.title || 'Sem curso'}
            </p>

            {/* Date */}
            <div className="flex items-center gap-1 text-xs text-gray-500 mt-1">
              <Calendar className="w-3 h-3" />
              {new Date(document.uploadedAt).toLocaleDateString('pt-BR')}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={() => onPreview(document)}
              className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 p-2 rounded-lg transition-colors"
              title="Visualizar"
            >
              <Search className="w-5 h-5" />
            </button>
            <button
              onClick={() => router.push(`/admin/documentos/${document.id}/edit`)}
              className="text-green-600 hover:text-green-700 hover:bg-green-50 p-2 rounded-lg transition-colors"
              title="Editar"
            >
              <Edit2 className="w-5 h-5" />
            </button>
            <button
              onClick={() => onDelete(document.id)}
              className="text-red-600 hover:text-red-700 hover:bg-red-50 p-2 rounded-lg transition-colors"
              title="Excluir"
            >
              <Trash2 className="w-5 h-5" />
            </button>
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-gray-500 hover:text-gray-700 hover:bg-gray-100 p-2 rounded-lg transition-colors ml-1"
              title={isExpanded ? 'Recolher' : 'Expandir'}
            >
              {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Expanded Details */}
      {isExpanded && (
        <div className={`border-t-2 p-4 ${STATUS_CONFIG[completion.status].bgColor}`}>
          {/* Completion Issues Alert */}
          {completion.issues.length > 0 && (
            <div className={`mb-4 p-3 rounded-lg border ${
              completion.status === 'critical' ? 'bg-red-100 border-red-300' : 'bg-yellow-100 border-yellow-300'
            }`}>
              <div className="flex items-center gap-2 mb-1">
                <StatusIcon className={`w-4 h-4 ${STATUS_CONFIG[completion.status].color}`} />
                <span className={`text-sm font-bold ${STATUS_CONFIG[completion.status].color}`}>
                  {completion.status === 'critical' ? 'Campos obrigatorios faltando' : 'Campos recomendados'}
                </span>
              </div>
              <ul className="text-xs text-gray-700 ml-6 list-disc">
                {completion.issues.map((issue, i) => (
                  <li key={i}>{issue}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Type-specific Details */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {/* Common Fields */}
            <div>
              <span className="text-xs text-gray-500 uppercase font-semibold">Tipo Arquivo</span>
              <p className="text-sm font-medium text-gray-900">{document.type.toUpperCase()}</p>
            </div>

            <div>
              <span className="text-xs text-gray-500 uppercase font-semibold">Tamanho</span>
              <p className="text-sm font-medium text-gray-900">
                {document.size ? `${(document.size / 1024 / 1024).toFixed(2)} MB` : 'N/A'}
              </p>
            </div>

            {/* Category-specific fields */}
            {document.category === 'orientacao-normativa' && (
              <>
                <div>
                  <span className="text-xs text-gray-500 uppercase font-semibold">Numero ON</span>
                  <p className="text-sm font-medium text-gray-900">
                    {document.onNumber && document.onYear
                      ? `ON ${document.onNumber}/${document.onYear}`
                      : <span className="text-red-500">Nao informado</span>
                    }
                  </p>
                </div>
              </>
            )}

            {(document.category === 'enunciados' || document.category === 'sumula') && (
              <>
                <div>
                  <span className="text-xs text-gray-500 uppercase font-semibold">Entidade</span>
                  <p className="text-sm font-medium text-gray-900">
                    {document.entityType || <span className="text-red-500">Nao informada</span>}
                  </p>
                </div>
                {document.enunciadoNumber && (
                  <div>
                    <span className="text-xs text-gray-500 uppercase font-semibold">Numero</span>
                    <p className="text-sm font-medium text-gray-900">{document.enunciadoNumber}</p>
                  </div>
                )}
              </>
            )}

            {/* Description */}
            {document.description && (
              <div className="col-span-2 md:col-span-3">
                <span className="text-xs text-gray-500 uppercase font-semibold">Descricao</span>
                <p className="text-sm text-gray-700 mt-1">{document.description}</p>
              </div>
            )}

            {/* Tags */}
            {tags.length > 0 && (
              <div className="col-span-2 md:col-span-3">
                <span className="text-xs text-gray-500 uppercase font-semibold flex items-center gap-1">
                  <Tag className="w-3 h-3" />
                  Tags
                </span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {tags.map((tag, i) => (
                    <span key={i} className="px-2 py-0.5 bg-gray-200 text-gray-800 text-xs rounded-full">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Lei Articles */}
            {leiArticles.length > 0 && (
              <div className="col-span-2 md:col-span-3">
                <span className="text-xs text-gray-500 uppercase font-semibold flex items-center gap-1">
                  <Scale className="w-3 h-3" />
                  Artigos Lei 14.133/2021
                </span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {leiArticles.map((art, i) => (
                    <span key={i} className="px-2 py-0.5 bg-blue-200 text-blue-800 text-xs rounded-full font-medium">
                      Art. {art}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* URL */}
            {document.url && (
              <div className="col-span-2 md:col-span-3">
                <span className="text-xs text-gray-500 uppercase font-semibold">URL</span>
                <a
                  href={document.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1 mt-1 truncate"
                >
                  <ExternalLink className="w-3 h-3 flex-shrink-0" />
                  <span className="truncate">{document.url}</span>
                </a>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default DocumentCard;
