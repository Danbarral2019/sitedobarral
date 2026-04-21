/**
 * Unified Jurisprudência Query Helper
 *
 * Une TribunalDecision (TCEs, STJ, STF) + Document TCU (acórdãos) no read path
 * da página /area-restrita/jurisprudencia. Veja o spec:
 * docs/superpowers/specs/2026-04-21-integracao-tcu-jurisprudencia-design.md
 */

export interface UnifiedDecision {
  id: string;
  tribunalCode: string;
  tribunalName: string;
  decisionType: string;
  decisionNumber: string;
  title: string;
  ementa: string;
  fullText: string | null;
  summary: string | null;
  relator: string | null;
  orgaoJulgador: string | null;
  dataJulgamento: Date | null;
  dataPublicacao: Date | null;
  themes: string | null;
  leiArticles: string | null;
  url: string | null;
  pdfUrl: string | null;
  isRelevant: boolean;
  relevanceScore: number;
  approvalStatus: string;
  year: number | null;
  processNumber: string | null;
  fullIdentifier: string;
  sourceType: 'tribunal-decision' | 'document-tcu';
  createdAt: Date;
  updatedAt: Date;
}

/** Shape mínimo do `Document` necessário para o mapping. */
export interface DocumentTcuRaw {
  id: string;
  title: string;
  description: string | null;
  content: string | null;
  url: string | null;
  tcuNumeroAcordao: string | null;
  tcuEmentaCompleta: string | null;
  tcuTextoCompleto: string | null;
  tcuRelator: string | null;
  tcuAutorTese: string | null;
  tcuOrgaoJulgador: string | null;
  tcuDataJulgamento: Date | null;
  tcuLinkPDF: string | null;
  tcuArea: string | null;
  tcuTema: string | null;
  tcuSubtema: string | null;
  acordaoAno: number | null;
  themes: string | null;
  leiArticles: string | null;
  summary: string | null;
  douData: Date | null;
  uploadedAt: Date;
  updatedAt: Date;
}

function deriveThemesFromTcu(doc: DocumentTcuRaw): string | null {
  if (doc.themes) return doc.themes;
  const parts = [doc.tcuArea, doc.tcuTema, doc.tcuSubtema].filter(
    (p): p is string => !!p && p.trim().length > 0
  );
  return parts.length > 0 ? JSON.stringify(parts) : null;
}

function deriveYear(doc: DocumentTcuRaw): number | null {
  if (typeof doc.acordaoAno === 'number') return doc.acordaoAno;
  if (doc.tcuDataJulgamento) return doc.tcuDataJulgamento.getUTCFullYear();
  return null;
}

export function mapDocumentTcuToDecision(doc: DocumentTcuRaw): UnifiedDecision {
  const decisionNumber = doc.tcuNumeroAcordao ?? doc.title;
  const ementa =
    doc.tcuEmentaCompleta ?? doc.description ?? doc.content ?? '';
  const fullText = doc.tcuTextoCompleto ?? doc.content ?? null;
  const relator = doc.tcuRelator ?? doc.tcuAutorTese ?? null;

  return {
    id: doc.id,
    tribunalCode: 'TCU',
    tribunalName: 'Tribunal de Contas da União',
    decisionType: 'acordao',
    decisionNumber,
    title: doc.title,
    ementa,
    fullText,
    summary: doc.summary,
    relator,
    orgaoJulgador: doc.tcuOrgaoJulgador,
    dataJulgamento: doc.tcuDataJulgamento,
    dataPublicacao: doc.douData,
    themes: deriveThemesFromTcu(doc),
    leiArticles: doc.leiArticles,
    url: doc.url,
    pdfUrl: doc.tcuLinkPDF,
    isRelevant: true,
    relevanceScore: 0,
    approvalStatus: 'manually_approved',
    year: deriveYear(doc),
    processNumber: null,
    fullIdentifier: `TCU Acórdão ${decisionNumber}`,
    sourceType: 'document-tcu',
    createdAt: doc.uploadedAt,
    updatedAt: doc.updatedAt,
  };
}
