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
    <div className="flex flex-wrap gap-3 pt-4 border-t border-gray-200">
      {document.type === 'link' && primaryUrl ? (
        <a
          href={primaryUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={handleView}
          className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-700 text-white px-6 py-3 rounded-xl font-bold hover:from-blue-700 hover:to-indigo-800 transition-all flex items-center justify-center gap-2 shadow-lg min-w-[200px]"
        >
          <ExternalLink className="w-5 h-5" />
          Acessar Documento
        </a>
      ) : document.type === 'pdf' || document.type === 'doc' ? (
        <a
          href={`/api/documents/${documentId}/download`}
          onClick={handleDownload}
          className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-700 text-white px-6 py-3 rounded-xl font-bold hover:from-blue-700 hover:to-indigo-800 transition-all flex items-center justify-center gap-2 shadow-lg min-w-[200px]"
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
  );
}
