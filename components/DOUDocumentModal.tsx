'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { courses } from '@/data/courses';
import { TEMAS_LICITACOES } from '@/data/temas-licitacoes';
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
  document: DOUDocument;
  onApprove: (courseIds: string[], adminNotes?: string, importAs?: string, metadata?: { issuerOrg?: string; esfera?: string; themes?: string[] }) => Promise<void>;
  onReject: (reason?: string) => Promise<void>;
  isRejecting: boolean;
  isApproving: boolean;
}

export function DOUDocumentModal({
  isOpen,
  onClose,
  document,
  onApprove,
  onReject,
  isRejecting,
  isApproving,
}: DOUDocumentModalProps) {
  const [selectedCourses, setSelectedCourses] = useState<string[]>([]);
  const [adminNotes, setAdminNotes] = useState('');
  const [importAs, setImportAs] = useState<'ato_normativo' | 'boa_pratica'>('ato_normativo');
  const [issuerOrg, setIssuerOrg] = useState('');
  const [esfera, setEsfera] = useState<'federal' | 'estadual'>('federal');
  const [selectedThemes, setSelectedThemes] = useState<string[]>([]);
  const [showFullContent, setShowFullContent] = useState(false);

  // Auto-preencher issuerOrg do hierarchyStr quando o documento muda
  useEffect(() => {
    if (document.hierarchyStr) {
      setIssuerOrg(document.hierarchyStr.split('/')[0].trim());
    }
  }, [document.hierarchyStr]);

  const handleApprove = async () => {
    if (selectedCourses.length === 0) {
      alert('Selecione pelo menos um curso para vincular o documento');
      return;
    }
    // Sempre enviar metadados (todos os documentos DOU vão para a aba "Outros Atos Normativos")
    const metadata = {
      issuerOrg: issuerOrg.trim() || undefined,
      esfera,
      themes: selectedThemes.length > 0 ? selectedThemes : undefined,
    };

    // Delegar completamente para o pai - ele gerencia estado e erros
    await onApprove(selectedCourses, adminNotes.trim() || undefined, importAs, metadata);

    // Reset form local apenas (se o componente ainda estiver montado, ok; se não, sem problema)
    setSelectedCourses([]);
    setAdminNotes('');
    setImportAs('ato_normativo');
    setIssuerOrg('');
    setEsfera('federal');
    setSelectedThemes([]);
  };

  const handleReject = async () => {
    if (!confirm('Tem certeza que deseja rejeitar este documento?')) {
      return;
    }

    // Delegar completamente para o pai - ele gerencia estado e erros
    await onReject(adminNotes.trim() || undefined);

    // Reset form local
    setAdminNotes('');
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
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-[3px] text-xs font-medium bg-green-100 text-green-800">
            <CheckCircle className="w-3 h-3" />
            Auto-aprovado
          </span>
        );
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-[3px] text-xs font-medium bg-amber-accent-soft text-ink-primary">
            <AlertTriangle className="w-3 h-3" />
            Revisão
          </span>
        );
      case 'auto_rejected':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-[3px] text-xs font-medium bg-red-100 text-red-800">
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
            <span className="inline-flex items-center gap-1 px-2 py-1 bg-brand-100 text-brand-800 text-xs font-bold rounded uppercase">
              {document.section}
            </span>
            <span className="inline-flex items-center gap-1 text-xs text-ink-muted">
              <Calendar className="w-3 h-3" />
              {document.publishDate}
            </span>
            {getStatusBadge()}
          </DialogDescription>
        </DialogHeader>

        {/* Metadados */}
        <div className="grid grid-cols-2 gap-4 p-4 bg-surface-raised rounded-[6px] border">
          <div>
            <div className="flex items-center gap-2 text-sm text-ink-muted mb-1">
              <Tag className="w-4 h-4" />
              <span className="font-medium">Categoria</span>
            </div>
            <p className="text-sm font-medium">{document.category}</p>
          </div>
          <div>
            <div className="flex items-center gap-2 text-sm text-ink-muted mb-1">
              <TrendingUp className="w-4 h-4" />
              <span className="font-medium">Confiança</span>
            </div>
            <p className="text-sm font-medium">{document.confidence}%</p>
          </div>
          {document.hierarchyStr && (
            <div className="col-span-2">
              <div className="flex items-center gap-2 text-sm text-ink-muted mb-1">
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
            <div className="p-4 bg-brand-50 rounded-[6px] border border-brand-200">
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
                  className="text-xs text-brand-600 hover:underline"
                >
                  {showFullContent ? 'Ocultar' : 'Expandir'}
                </button>
              </div>
              {showFullContent && (
                <div className="p-4 bg-white rounded-[6px] border max-h-96 overflow-y-auto">
                  <p className="text-sm leading-relaxed whitespace-pre-line">
                    {document.fullContent}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Link para Fonte Oficial */}
          {document.url ? (
            <a
              href={document.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 bg-surface-deep text-ink-secondary rounded-[6px] hover:bg-surface-deep transition-colors text-sm font-medium"
            >
              <ExternalLink className="w-4 h-4" />
              Ver na Fonte Oficial (DOU)
            </a>
          ) : (
            <span className="inline-flex items-center gap-2 px-4 py-2 bg-surface-raised text-ink-muted rounded-[6px] text-sm">
              <ExternalLink className="w-4 h-4" />
              Link da fonte indisponivel
            </span>
          )}
        </div>

        {/* Formulário de Aprovação */}
        <div className="space-y-4 border-t pt-4">
          {/* Tipo de Importação */}
          <div>
            <label className="block text-sm font-bold mb-2">
              Importar como:
            </label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 p-3 border rounded-[6px] cursor-pointer hover:bg-brand-50 transition-colors has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50">
                <input
                  type="radio"
                  name="importAs"
                  value="ato_normativo"
                  checked={importAs === 'ato_normativo'}
                  onChange={() => setImportAs('ato_normativo')}
                />
                <div>
                  <span className="text-sm font-medium">Ato Normativo</span>
                  <p className="text-xs text-ink-muted">Base geral de legislacao</p>
                </div>
              </label>
              <label className="flex items-center gap-2 p-3 border rounded-[6px] cursor-pointer hover:bg-green-50 transition-colors has-[:checked]:border-green-500 has-[:checked]:bg-green-50">
                <input
                  type="radio"
                  name="importAs"
                  value="boa_pratica"
                  checked={importAs === 'boa_pratica'}
                  onChange={() => setImportAs('boa_pratica')}
                />
                <div>
                  <span className="text-sm font-medium">Boa Pratica</span>
                  <p className="text-xs text-ink-muted">Referencia/inspiracao de outros orgaos</p>
                </div>
              </label>
            </div>
          </div>

          <div className="space-y-4 p-4 bg-green-50 rounded-[6px] border border-green-200">
              <h4 className="text-sm font-bold text-green-800">Metadados do Documento</h4>

              <div>
                <label className="block text-sm font-medium text-ink-secondary mb-1">
                  Orgao de Origem
                </label>
                <input
                  type="text"
                  value={issuerOrg}
                  onChange={(e) => setIssuerOrg(e.target.value)}
                  placeholder="Ex: TCE-SP, CGE-MG, TCU..."
                  className="w-full px-3 py-2 border rounded-[6px] focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-ink-secondary mb-1">
                  Esfera
                </label>
                <div className="flex gap-3">
                  <label className="flex items-center gap-2">
                    <input type="radio" name="esfera" value="federal" checked={esfera === 'federal'} onChange={() => setEsfera('federal')} />
                    <span className="text-sm">Federal</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="radio" name="esfera" value="estadual" checked={esfera === 'estadual'} onChange={() => setEsfera('estadual')} />
                    <span className="text-sm">Estadual</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-ink-secondary mb-1">
                  Temas
                </label>
                <div className="flex flex-wrap gap-2">
                  {TEMAS_LICITACOES.map((tema) => (
                    <button
                      key={tema.value}
                      type="button"
                      onClick={() => setSelectedThemes(prev =>
                        prev.includes(tema.value) ? prev.filter(t => t !== tema.value) : [...prev, tema.value]
                      )}
                      className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                        selectedThemes.includes(tema.value)
                          ? 'bg-green-600 text-white border-green-600'
                          : 'bg-white text-ink-secondary border-border-subtle hover:border-green-400'
                      }`}
                    >
                      {tema.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

          <div>
            <label className="block text-sm font-bold mb-2">
              Vincular aos cursos: *
            </label>
            <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto p-2 bg-surface-raised rounded-[6px] border">
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
            <p className="text-xs text-ink-muted mt-1">
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
              className="w-full px-3 py-2 border rounded-[6px] focus:ring-2 focus:ring-brand-500 focus:border-transparent text-sm"
              rows={3}
            />
          </div>
        </div>

        {/* Footer com Ações */}
        <DialogFooter className="flex gap-2">
          <button
            onClick={handleReject}
            disabled={isRejecting || isApproving}
            className="px-6 py-2 border border-red-300 text-red-700 rounded-[6px] hover:bg-red-50 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <XCircle className="w-4 h-4" />
            {isRejecting ? 'Rejeitando...' : 'Rejeitar'}
          </button>
          <button
            onClick={handleApprove}
            disabled={isApproving || isRejecting || selectedCourses.length === 0}
            className="px-6 py-2 bg-green-600 text-white rounded-[6px] hover:bg-green-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <CheckCircle className="w-4 h-4" />
            {isApproving ? 'Aprovando...' : 'Aprovar e Incorporar'}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
