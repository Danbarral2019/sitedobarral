import {
  Newspaper,
  Globe,
  ExternalLink,
  AlertCircle,
} from 'lucide-react';
import type { DocumentData } from './index';

interface DouPublicationBoxProps {
  document: DocumentData;
  urlIsSapiens: boolean;
  handleView: () => void;
}

export default function DouPublicationBox({ document, urlIsSapiens, handleView }: DouPublicationBoxProps) {
  return (
    <>
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
    </>
  );
}
