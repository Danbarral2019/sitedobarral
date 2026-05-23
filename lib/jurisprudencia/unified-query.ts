/**
 * Unified Jurisprudência Query Helper
 *
 * Une TribunalDecision (TCEs, STJ, STF) + Document TCU (acórdãos) no read path
 * da página /area-restrita/jurisprudencia. Veja o spec:
 * docs/superpowers/specs/2026-04-21-integracao-tcu-jurisprudencia-design.md
 */

import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

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
  /**
   * JSON cru com estrutura específica da fonte. Para Súmulas TST contém
   * { situacao, itens, irrs, resolucoes, ... } — usado pelo detail page para
   * renderizar itens romanos com `<s>`, timeline e badge de situação.
   * NULL para TCU.
   */
  sourceRawData: string | null;
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
  leiArticlesArr: string[];
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
  /**
   * Quando true, exclui resultados cujo campo `themes` contenha
   * `situacao:CANCELADA` ou `situacao:REVISTA`. Usado para esconder súmulas
   * inativas do TST por padrão. Aplica-se apenas a `TribunalDecision`.
   */
  excludeInactive?: boolean;
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
    leiArticles:
      doc.leiArticlesArr.length > 0 ? JSON.stringify(doc.leiArticlesArr) : null,
    url: doc.url,
    pdfUrl: doc.tcuLinkPDF,
    isRelevant: true,
    relevanceScore: 50,
    approvalStatus: 'manually_approved',
    year: deriveYear(doc),
    processNumber: null,
    fullIdentifier: `TCU Acórdão ${decisionNumber}`,
    sourceType: 'document-tcu',
    sourceRawData: null,
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
      Prisma.sql`"leiArticlesArr" @> ARRAY[${filters.artigo}]::text[]` // Onda 4.5.5b: GIN; ILIKE buggy
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
  if (filters.excludeInactive) {
    fragments.push(
      Prisma.sql`themes NOT ILIKE ${'%situacao:CANCELADA%'} AND themes NOT ILIKE ${'%situacao:REVISTA%'}`
    );
  }

  return Prisma.join(fragments, ' AND ');
}

/**
 * Categorias de `Document` que representam decisões do TCU. Cobrem:
 * - `acordao` — acórdãos TCU em geral
 * - `consulta_tcu` — respostas a consultas (emitidas como acórdão no TCU oficial)
 */
const TCU_DOCUMENT_CATEGORIES = ['acordao', 'consulta_tcu'] as const;

/**
 * WHERE de Document TCU.
 * - Sempre aplica `category IN (acordao, consulta_tcu) AND tcuNumeroAcordao IS NOT NULL`
 * - Filtros mapeiam para campos tcu* quando necessário
 */
export function buildDocumentTcuWhere(
  filters: JurisprudenciaFilters
): Prisma.Sql {
  const fragments: Prisma.Sql[] = [
    Prisma.sql`category IN (${Prisma.join(
      TCU_DOCUMENT_CATEGORIES as unknown as string[]
    )})`,
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
      Prisma.sql`"leiArticlesArr" @> ARRAY[${filters.artigo}]::text[]` // Onda 4.5.5b: GIN; ILIKE buggy
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

// ──────────────────────────────────────────────────────────────────────────
// Composição da query UNION ALL
// ──────────────────────────────────────────────────────────────────────────

/**
 * SELECT normalizado do ramo A (TribunalDecision) — alinha com UnifiedDecision.
 */
function tribunalDecisionSelect(where: Prisma.Sql): Prisma.Sql {
  return Prisma.sql`
    SELECT
      id,
      "tribunalCode",
      "tribunalName",
      "decisionType",
      "decisionNumber",
      title,
      ementa,
      "fullText",
      summary,
      relator,
      "orgaoJulgador",
      "dataJulgamento",
      "dataPublicacao",
      themes,
      to_jsonb("leiArticlesArr")::text AS "leiArticles",
      url,
      "pdfUrl",
      "isRelevant",
      "relevanceScore",
      "approvalStatus",
      year,
      "processNumber",
      "fullIdentifier",
      'tribunal-decision' AS "sourceType",
      "sourceRawData",
      "createdAt",
      "updatedAt"
    FROM "TribunalDecision"
    WHERE ${where}
  `;
}

/**
 * SELECT normalizado do ramo B (Document TCU) — mesmos campos do ramo A,
 * derivando a partir dos campos tcu*.
 */
function documentTcuSelect(where: Prisma.Sql): Prisma.Sql {
  return Prisma.sql`
    SELECT
      id,
      'TCU' AS "tribunalCode",
      'Tribunal de Contas da União' AS "tribunalName",
      'acordao' AS "decisionType",
      COALESCE("tcuNumeroAcordao", title) AS "decisionNumber",
      title,
      COALESCE("tcuEmentaCompleta", description, content, '') AS ementa,
      COALESCE("tcuTextoCompleto", content) AS "fullText",
      summary,
      COALESCE("tcuRelator", "tcuAutorTese") AS relator,
      "tcuOrgaoJulgador" AS "orgaoJulgador",
      "tcuDataJulgamento" AS "dataJulgamento",
      "douData" AS "dataPublicacao",
      CASE
        WHEN themes IS NOT NULL THEN themes
        WHEN "tcuArea" IS NOT NULL OR "tcuTema" IS NOT NULL OR "tcuSubtema" IS NOT NULL THEN
          to_jsonb(ARRAY_REMOVE(ARRAY["tcuArea", "tcuTema", "tcuSubtema"], NULL))::text
        ELSE NULL
      END AS themes,
      to_jsonb("leiArticlesArr")::text AS "leiArticles",
      url,
      "tcuLinkPDF" AS "pdfUrl",
      TRUE AS "isRelevant",
      50 AS "relevanceScore",
      'manually_approved' AS "approvalStatus",
      COALESCE("acordaoAno", EXTRACT(YEAR FROM "tcuDataJulgamento")::int) AS year,
      NULL::text AS "processNumber",
      'TCU Acórdão ' || COALESCE("tcuNumeroAcordao", title) AS "fullIdentifier",
      'document-tcu' AS "sourceType",
      NULL::text AS "sourceRawData",
      "uploadedAt" AS "createdAt",
      "updatedAt"
    FROM "Document"
    WHERE ${where}
  `;
}

/**
 * Monta o corpo do UNION ALL baseado no short-circuit.
 * Retorna `null` quando ambos os ramos são excluídos.
 */
function composeUnifiedBody(
  filters: JurisprudenciaFilters
): Prisma.Sql | null {
  const includeA = shouldIncludeTribunalDecisionBranch(filters);
  const includeB = shouldIncludeDocumentTcuBranch(filters);

  if (!includeA && !includeB) return null;

  if (includeA && includeB) {
    return Prisma.sql`
      (${tribunalDecisionSelect(buildTribunalDecisionWhere(filters))})
      UNION ALL
      (${documentTcuSelect(buildDocumentTcuWhere(filters))})
    `;
  }
  if (includeA) {
    return tribunalDecisionSelect(buildTribunalDecisionWhere(filters));
  }
  // includeB only
  return documentTcuSelect(buildDocumentTcuWhere(filters));
}

// ──────────────────────────────────────────────────────────────────────────
// Funções fetch públicas
// ──────────────────────────────────────────────────────────────────────────

export type SortOption = 'recent' | 'oldest' | 'numero' | 'relevance';

export interface PaginationOptions {
  page: number;
  pageSize: number;
  sort?: SortOption;
}

export interface UnifiedListResult {
  items: UnifiedDecision[];
  total: number;
}

function getOrderClause(sort: SortOption | undefined): Prisma.Sql {
  switch (sort) {
    case 'oldest':
      return Prisma.sql`ORDER BY "dataJulgamento" ASC NULLS LAST, id ASC`;
    case 'numero':
      return Prisma.sql`ORDER BY "decisionNumber" DESC NULLS LAST, id ASC`;
    case 'relevance':
      return Prisma.sql`ORDER BY "relevanceScore" DESC NULLS LAST, "dataJulgamento" DESC NULLS LAST`;
    case 'recent':
    default:
      return Prisma.sql`ORDER BY "dataJulgamento" DESC NULLS LAST, id ASC`;
  }
}

export async function fetchUnifiedList(
  filters: JurisprudenciaFilters,
  { page, pageSize, sort }: PaginationOptions
): Promise<UnifiedListResult> {
  const body = composeUnifiedBody(filters);
  if (!body) return { items: [], total: 0 };

  const offset = (page - 1) * pageSize;

  const itemsSql = Prisma.sql`
    SELECT * FROM (${body}) unified
    ${getOrderClause(sort)}
    LIMIT ${pageSize} OFFSET ${offset}
  `;
  const countSql = Prisma.sql`
    SELECT COUNT(*)::int AS total FROM (${body}) sub
  `;

  const [items, countRows] = await Promise.all([
    prisma.$queryRaw<UnifiedDecision[]>(itemsSql),
    prisma.$queryRaw<Array<{ total: number }>>(countSql),
  ]);

  return { items, total: countRows[0]?.total ?? 0 };
}

export async function fetchUnifiedTopK(
  filters: JurisprudenciaFilters,
  topK: number
): Promise<UnifiedDecision[]> {
  const body = composeUnifiedBody(filters);
  if (!body) return [];

  const sql = Prisma.sql`
    SELECT * FROM (${body}) unified
    ORDER BY "relevanceScore" DESC NULLS LAST, "dataJulgamento" DESC NULLS LAST
    LIMIT ${topK}
  `;

  return prisma.$queryRaw<UnifiedDecision[]>(sql);
}

export async function fetchUnifiedById(
  id: string
): Promise<UnifiedDecision | null> {
  // Tenta ramo A primeiro (filtros equivalentes ao default)
  const tribA = await prisma.$queryRaw<UnifiedDecision[]>(Prisma.sql`
    SELECT * FROM (${tribunalDecisionSelect(
      buildTribunalDecisionWhere({})
    )}) unified
    WHERE id = ${id}
    LIMIT 1
  `);
  if (tribA.length > 0) return tribA[0];

  const tribB = await prisma.$queryRaw<UnifiedDecision[]>(Prisma.sql`
    SELECT * FROM (${documentTcuSelect(
      buildDocumentTcuWhere({})
    )}) unified
    WHERE id = ${id}
    LIMIT 1
  `);
  if (tribB.length > 0) return tribB[0];

  return null;
}

export async function countUnifiedApproved(): Promise<number> {
  const body = composeUnifiedBody({});
  if (!body) return 0;
  const rows = await prisma.$queryRaw<Array<{ total: number }>>(Prisma.sql`
    SELECT COUNT(*)::int AS total FROM (${body}) sub
  `);
  return rows[0]?.total ?? 0;
}
