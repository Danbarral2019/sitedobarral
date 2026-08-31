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
      <div className="bg-surface-raised p-3.5 rounded-[6px] border border-border-subtle">
        <div className="flex items-center gap-2 text-ink-muted mb-1">
          <Tag className="w-3.5 h-3.5" />
          <span className="text-xs font-medium">Categoria</span>
        </div>
        <p className="font-bold text-ink-primary text-sm">{getCategoryLabel(document.category)}</p>
      </div>

      <div className="bg-surface-raised p-3.5 rounded-[6px] border border-border-subtle">
        <div className="flex items-center gap-2 text-ink-muted mb-1">
          <FileText className="w-3.5 h-3.5" />
          <span className="text-xs font-medium">Tipo</span>
        </div>
        <p className="font-bold text-ink-primary text-sm uppercase">{document.type}</p>
      </div>

      <div className="bg-surface-raised p-3.5 rounded-[6px] border border-border-subtle">
        <div className="flex items-center gap-2 text-ink-muted mb-1">
          <Calendar className="w-3.5 h-3.5" />
          <span className="text-xs font-medium">Cadastrado</span>
        </div>
        <p className="font-bold text-ink-primary text-sm">
          {new Date(document.uploadedAt).toLocaleDateString('pt-BR')}
        </p>
      </div>

      {/* Issuer Org */}
      {document.issuerOrg && (
        <div className="bg-surface-raised p-3.5 rounded-[6px] border border-border-subtle">
          <div className="flex items-center gap-2 text-ink-muted mb-1">
            <Building2 className="w-3.5 h-3.5" />
            <span className="text-xs font-medium">Órgão</span>
          </div>
          <p className="font-bold text-ink-primary text-sm">{document.issuerOrg}</p>
        </div>
      )}

      {/* Esfera */}
      {document.esfera && (
        <div className="bg-surface-raised p-3.5 rounded-[6px] border border-border-subtle">
          <div className="flex items-center gap-2 text-ink-muted mb-1">
            <Shield className="w-3.5 h-3.5" />
            <span className="text-xs font-medium">Esfera</span>
          </div>
          <p className="font-bold text-ink-primary text-sm capitalize">{document.esfera}</p>
        </div>
      )}

      {/* TCU specific metadata (from satellite table) */}
      {document.metaTcu?.relator && (
        <div className="bg-surface-raised p-3.5 rounded-[6px] border border-border-subtle">
          <div className="flex items-center gap-2 text-ink-muted mb-1">
            <Scale className="w-3.5 h-3.5" />
            <span className="text-xs font-medium">Relator</span>
          </div>
          <p className="font-bold text-ink-primary text-sm">{document.metaTcu.relator}</p>
        </div>
      )}

      {document.metaTcu?.orgaoJulgador && (
        <div className="bg-surface-raised p-3.5 rounded-[6px] border border-border-subtle">
          <div className="flex items-center gap-2 text-ink-muted mb-1">
            <Building2 className="w-3.5 h-3.5" />
            <span className="text-xs font-medium">Órgão Julgador</span>
          </div>
          <p className="font-bold text-ink-primary text-sm">{document.metaTcu.orgaoJulgador}</p>
        </div>
      )}

      {document.metaTcu?.dataJulgamento && (
        <div className="bg-surface-raised p-3.5 rounded-[6px] border border-border-subtle">
          <div className="flex items-center gap-2 text-ink-muted mb-1">
            <Calendar className="w-3.5 h-3.5" />
            <span className="text-xs font-medium">Julgamento</span>
          </div>
          <p className="font-bold text-ink-primary text-sm">
            {new Date(document.metaTcu.dataJulgamento).toLocaleDateString('pt-BR')}
          </p>
        </div>
      )}

      {/* TCU Area/Tema */}
      {document.metaTcu?.area && (
        <div className="bg-surface-raised p-3.5 rounded-[6px] border border-border-subtle col-span-2">
          <div className="flex items-center gap-2 text-ink-muted mb-1">
            <Hash className="w-3.5 h-3.5" />
            <span className="text-xs font-medium">Área / Tema</span>
          </div>
          <p className="font-bold text-ink-primary text-sm">
            {document.metaTcu.area}
            {document.metaTcu.tema && ` - ${document.metaTcu.tema}`}
          </p>
        </div>
      )}
    </div>
  );
}
