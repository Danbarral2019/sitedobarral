import {
  Tag,
  FileText,
  Calendar,
  Building2,
  Shield,
  Scale,
  Hash,
} from 'lucide-react';
import { getCategoryLabel } from './utils';
import type { DocumentData } from './index';

interface MetadataGridProps {
  document: DocumentData;
}

export default function MetadataGrid({ document }: MetadataGridProps) {
  return (
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
  );
}
