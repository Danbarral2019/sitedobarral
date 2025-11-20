'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { courses } from '@/data/courses';
import {
  ExternalLink,
  CheckCircle,
  XCircle,
  FileText,
  Calendar,
  Tag,
  Building,
  TrendingUp,
  AlertTriangle,
} from 'lucide-react';

export interface DOUDocument {
  id?: string; // Para documentos salvos no DB
  title: string;
  abstract: string;
  fullContent?: string;
  url: string;
  section: string;
  publishDate: string;
  category: string;
  confidence: number;
  hierarchyStr: string;
  approvalStatus: string;
}

interface DOUDocumentModalProps {
  isOpen: boolean;
  onClose: () => void;
  document: DOUDocument | null;
  onApprove: (courseIds: string[], adminNotes?: string) => Promise<void>;
  onReject: (reason?: string) => Promise<void>;
}

export function DOUDocumentModal({
  isOpen,
  onClose,
  document,
  onApprove,
  onReject,
}: DOUDocumentModalProps) {
  const [selectedCourses, setSelectedCourses] = useState<string[]>([]);
  const [adminNotes, setAdminNotes] = useState('');
  const [isApproving, setIsApproving] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [showFullContent, setShowFullContent] = useState(false);

  // Guard: Não renderizar se documento for inválido
  if (!document || !isOpen) {
    return null;
  }

  const handleApprove = async () => {
    if (selectedCourses.length === 0) {
      alert('Selecione pelo menos um curso para vincular o documento');
      return;
    }

    setIsApproving(true);
    try {
      await onApprove(selectedCourses, adminNotes.trim() || undefined);
      // Reset form
      setSelectedCourses([]);
      setAdminNotes('');
    } catch (error) {
      console.error('Erro ao aprovar:', error);
    } finally {
      setIsApproving(false);
    }
  };

  const handleReject = async () => {
    if (!confirm('Tem certeza que deseja rejeitar este documento?')) {
      return;
    }

    setIsRejecting(true);
    try {
      await onReject(adminNotes.trim() || undefined);
      setAdminNotes('');
    } catch (error) {
      console.error('Erro ao rejeitar:', error);
    } finally {
      setIsRejecting(false);
    }
  };

  const toggleCourse = (courseId: string) => {
    setSelectedCourses((prev) =>
      prev.includes(courseId)
        ? prev.filter((id) => id !== courseId)
        : [...prev, courseId]
    );
  };

  const getStatusBadge = () => {
    switch (document.approvalStatus) {
      case 'auto_approved':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
            <CheckCircle className="w-3 h-3" />
            Auto-aprovado
          </span>
        );
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
            <AlertTriangle className="w-3 h-3" />
            Revisão
          </span>
        );
      case 'auto_rejected':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
            <XCircle className="w-3 h-3" />
            Rejeitado
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold pr-8">
            {document.title}
          </DialogTitle>
          <DialogDescription className="flex items-center gap-2 flex-wrap mt-2">
            <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 text-xs font-bold rounded uppercase">
              {document.section}
            </span>
            <span className="inline-flex items-center gap-1 text-xs text-gray-600">
              <Calendar className="w-3 h-3" />
              {document.publishDate}
            </span>
            {getStatusBadge()}
          </DialogDescription>
        </DialogHeader>

        {/* Metadados */}
        <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg border">
          <div>
            <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
              <Tag className="w-4 h-4" />
              <span className="font-medium">Categoria</span>
            </div>
            <p className="text-sm font-medium">{document.category}</p>
          </div>
          <div>
            <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
              <TrendingUp className="w-4 h-4" />
              <span className="font-medium">Confiança</span>
            </div>
            <p className="text-sm font-medium">{document.confidence}%</p>
          </div>
          {document.hierarchyStr && (
            <div className="col-span-2">
              <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                <Building className="w-4 h-4" />
                <span className="font-medium">Órgão</span>
              </div>
              <p className="text-sm">{document.hierarchyStr}</p>
            </div>
          )}
        </div>

        {/* Conteúdo */}
        <div className="space-y-4">
          {/* Resumo */}
          <div>
            <h3 className="font-bold text-sm mb-2 flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Resumo
            </h3>
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-sm leading-relaxed whitespace-pre-line">
                {document.abstract}
              </p>
            </div>
          </div>

          {/* Texto Completo */}
          {document.fullContent && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-bold text-sm flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Texto Completo
                </h3>
                <button
                  onClick={() => setShowFullContent(!showFullContent)}
                  className="text-xs text-blue-600 hover:underline"
                >
                  {showFullContent ? 'Ocultar' : 'Expandir'}
                </button>
              </div>
              {showFullContent && (
                <div className="p-4 bg-white rounded-lg border max-h-96 overflow-y-auto">
                  <p className="text-sm leading-relaxed whitespace-pre-line">
                    {document.fullContent}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Link para Fonte Oficial */}
          <a
            href={document.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
          >
            <ExternalLink className="w-4 h-4" />
            Ver na Fonte Oficial (DOU)
          </a>
        </div>

        {/* Formulário de Aprovação */}
        <div className="space-y-4 border-t pt-4">
          <div>
            <label className="block text-sm font-bold mb-2">
              Vincular aos cursos: *
            </label>
            <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto p-2 bg-gray-50 rounded-lg border">
              {courses.map((course) => (
                <label
                  key={course.id}
                  className="flex items-start gap-2 p-2 hover:bg-white rounded cursor-pointer transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={selectedCourses.includes(course.id)}
                    onChange={() => toggleCourse(course.id)}
                    className="mt-1"
                  />
                  <span className="text-sm flex-1">{course.title}</span>
                </label>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {selectedCourses.length} curso(s) selecionado(s)
            </p>
          </div>

          <div>
            <label className="block text-sm font-bold mb-2">
              Observações do Admin (opcional)
            </label>
            <textarea
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
              placeholder="Adicione observações sobre este documento..."
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              rows={3}
            />
          </div>
        </div>

        {/* Footer com Ações */}
        <DialogFooter className="flex gap-2">
          <button
            onClick={handleReject}
            disabled={isRejecting || isApproving}
            className="px-6 py-2 border border-red-300 text-red-700 rounded-lg hover:bg-red-50 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <XCircle className="w-4 h-4" />
            {isRejecting ? 'Rejeitando...' : 'Rejeitar'}
          </button>
          <button
            onClick={handleApprove}
            disabled={isApproving || isRejecting || selectedCourses.length === 0}
            className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <CheckCircle className="w-4 h-4" />
            {isApproving ? 'Aprovando...' : 'Aprovar e Incorporar'}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
