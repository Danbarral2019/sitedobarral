/**
 * Unified Jurisprudência Query Helper
 *
 * Une TribunalDecision (TCEs, STJ, STF) + Document TCU (acórdãos) no read path
 * da página /area-restrita/jurisprudencia. Veja o spec:
 * docs/superpowers/specs/2026-04-21-integracao-tcu-jurisprudencia-design.md
 */

import { Prisma } from '@prisma/client';

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

export interface JurisprudenciaFilters {
  tribunal?: string;
  ano?: number;
  tema?: string;
  artigo?: string;
  decisionType?: string;
  relator?: string;
  orgao?: string;
  dataFrom?: Date;
  dataTo?: Date;
  q?: string;
}

export function shouldIncludeTribunalDecisionBranch(
  filters: JurisprudenciaFilters
): boolean {
  if (filters.tribunal === 'TCU') return false;
  return true;
}

export function shouldIncludeDocumentTcuBranch(
  filters: JurisprudenciaFilters
): boolean {
  if (filters.tribunal && filters.tribunal !== 'TCU') return false;
  if (
    filters.decisionType &&
    filters.decisionType !== 'acordao'
  )
    return false;
  return true;
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

/**
 * WHERE de TribunalDecision.
 * - Sempre aplica `isRelevant=true AND approvalStatus IN (...)`
 * - Filtros dinâmicos são adicionados apenas quando presentes
 */
export function buildTribunalDecisionWhere(
  filters: JurisprudenciaFilters
): Prisma.Sql {
  const fragments: Prisma.Sql[] = [
    Prisma.sql`"isRelevant" = ${true}`,
    Prisma.sql`"approvalStatus" IN (${Prisma.join([
      'auto_approved',
      'manually_approved',
    ])})`,
  ];

  if (filters.tribunal) {
    fragments.push(Prisma.sql`"tribunalCode" = ${filters.tribunal}`);
  }
  if (typeof filters.ano === 'number') {
    fragments.push(Prisma.sql`year = ${filters.ano}`);
  }
  if (filters.tema) {
    fragments.push(
      Prisma.sql`themes ILIKE ${'%' + filters.tema + '%'}`
    );
  }
  if (filters.artigo) {
    fragments.push(
      Prisma.sql`"leiArticles" ILIKE ${'%' + filters.artigo + '%'}`
    );
  }
  if (filters.decisionType) {
    fragments.push(
      Prisma.sql`"decisionType" = ${filters.decisionType}`
    );
  }
  if (filters.relator) {
    fragments.push(
      Prisma.sql`relator ILIKE ${'%' + filters.relator + '%'}`
    );
  }
  if (filters.orgao) {
    fragments.push(
      Prisma.sql`"orgaoJulgador" ILIKE ${'%' + filters.orgao + '%'}`
    );
  }
  if (filters.dataFrom) {
    fragments.push(Prisma.sql`"dataJulgamento" >= ${filters.dataFrom}`);
  }
  if (filters.dataTo) {
    fragments.push(Prisma.sql`"dataJulgamento" <= ${filters.dataTo}`);
  }
  if (filters.q) {
    const term = '%' + filters.q + '%';
    fragments.push(
      Prisma.sql`(title ILIKE ${term} OR ementa ILIKE ${term})`
    );
  }

  return Prisma.join(fragments, ' AND ');
}

/**
 * WHERE de Document TCU.
 * - Sempre aplica `category='acordao' AND tcuNumeroAcordao IS NOT NULL`
 * - Filtros mapeiam para campos tcu* quando necessário
 */
export function buildDocumentTcuWhere(
  filters: JurisprudenciaFilters
): Prisma.Sql {
  const fragments: Prisma.Sql[] = [
    Prisma.sql`category = ${'acordao'}`,
    Prisma.sql`"tcuNumeroAcordao" IS NOT NULL`,
  ];

  if (typeof filters.ano === 'number') {
    fragments.push(
      Prisma.sql`("acordaoAno" = ${filters.ano} OR EXTRACT(YEAR FROM "tcuDataJulgamento")::int = ${filters.ano})`
    );
  }
  if (filters.tema) {
    const term = '%' + filters.tema + '%';
    fragments.push(
      Prisma.sql`(themes ILIKE ${term} OR "tcuArea" ILIKE ${term} OR "tcuTema" ILIKE ${term} OR "tcuSubtema" ILIKE ${term})`
    );
  }
  if (filters.artigo) {
    fragments.push(
      Prisma.sql`"leiArticles" ILIKE ${'%' + filters.artigo + '%'}`
    );
  }
  if (filters.relator) {
    const term = '%' + filters.relator + '%';
    fragments.push(
      Prisma.sql`("tcuRelator" ILIKE ${term} OR "tcuAutorTese" ILIKE ${term})`
    );
  }
  if (filters.orgao) {
    fragments.push(
      Prisma.sql`"tcuOrgaoJulgador" ILIKE ${'%' + filters.orgao + '%'}`
    );
  }
  if (filters.dataFrom) {
    fragments.push(
      Prisma.sql`"tcuDataJulgamento" >= ${filters.dataFrom}`
    );
  }
  if (filters.dataTo) {
    fragments.push(
      Prisma.sql`"tcuDataJulgamento" <= ${filters.dataTo}`
    );
  }
  if (filters.q) {
    const term = '%' + filters.q + '%';
    fragments.push(
      Prisma.sql`(title ILIKE ${term} OR "tcuEmentaCompleta" ILIKE ${term})`
    );
  }

  return Prisma.join(fragments, ' AND ');
}
