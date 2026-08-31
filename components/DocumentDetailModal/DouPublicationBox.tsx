import {
  Newspaper,
  Globe,
  ExternalLink,
} from 'lucide-react';
import type { DocumentData } from './index';

interface DouPublicationBoxProps {
  document: DocumentData;
  handleView: () => void;
}

export default function DouPublicationBox({ document, handleView }: DouPublicationBoxProps) {
  if (!document.metaDou?.data && !document.metaDou?.url) return null;

  return (
    <div className="bg-brand-50 border border-brand-200 rounded-[6px] p-4 flex items-start gap-3">
      <div className="p-2 bg-brand-100 rounded-[6px] flex-shrink-0">
        <Newspaper className="w-4 h-4 text-brand-700" />
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="text-sm font-bold text-brand-900 mb-1">Publicacao no DOU</h4>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-brand-800">
          {document.metaDou.data && (
            <span>
              Data: <strong>{new Date(document.metaDou.data).toLocaleDateString('pt-BR')}</strong>
            </span>
          )}
          {document.metaDou.secao && (
            <span>
              Secao: <strong>{document.metaDou.secao}</strong>
            </span>
          )}
          {document.metaDou.pagina && (
            <span>
              Pagina: <strong>{document.metaDou.pagina}</strong>
            </span>
          )}
          {document.metaDou.edicao && (
            <span>
              Edicao: <strong>{document.metaDou.edicao}</strong>
            </span>
          )}
        </div>
        {document.metaDou.url && (
          <a
            href={document.metaDou.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={handleView}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 hover:text-brand-900 mt-2 transition-colors"
          >
            <Globe className="w-3.5 h-3.5" />
            Ver no Diario Oficial
            <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>
    </div>
  );
}
