import {
  Download,
  ExternalLink,
  Newspaper,
} from 'lucide-react';
import type { DocumentData } from './index';

interface ActionButtonsProps {
  document: DocumentData;
  documentId: string;
  primaryUrl: string;
  hasDouUrl: boolean;
  handleDownload: () => void;
  handleView: () => void;
  onClose: () => void;
}

export default function ActionButtons({
  document,
  documentId,
  primaryUrl,
  hasDouUrl,
  handleDownload,
  handleView,
  onClose,
}: ActionButtonsProps) {
  return (
    <div className="flex flex-wrap gap-3 pt-4 border-t border-border-subtle">
      {document.type === 'link' && primaryUrl ? (
        <a
          href={primaryUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={handleView}
          className="flex-1 bg-brand-700 text-white px-6 py-3 rounded-[6px] font-bold hover:from-brand-700 hover:to-brand-800 transition-all flex items-center justify-center gap-2 min-w-[200px] border border-border-subtle"
        >
          <ExternalLink className="w-5 h-5" />
          Acessar Documento
        </a>
      ) : document.type === 'pdf' || document.type === 'doc' ? (
        <a
          href={`/api/documents/${documentId}/download`}
          onClick={handleDownload}
          className="flex-1 bg-brand-700 text-white px-6 py-3 rounded-[6px] font-bold hover:from-brand-700 hover:to-brand-800 transition-all flex items-center justify-center gap-2 min-w-[200px] border border-border-subtle"
        >
          <Download className="w-5 h-5" />
          Download do Arquivo
        </a>
      ) : null}

      {/* Secondary DOU link */}
      {hasDouUrl && (
        <a
          href={document.metaDou!.url!}
          target="_blank"
          rel="noopener noreferrer"
          onClick={handleView}
          className="px-5 py-3 bg-brand-100 text-brand-800 rounded-[6px] font-bold hover:bg-brand-200 transition-colors flex items-center gap-2"
        >
          <Newspaper className="w-4 h-4" />
          DOU
        </a>
      )}

      <button
        onClick={onClose}
        className="px-6 py-3 bg-surface-deep text-ink-secondary rounded-[6px] font-bold hover:bg-border-strong transition-colors"
      >
        Fechar
      </button>
    </div>
  );
}
