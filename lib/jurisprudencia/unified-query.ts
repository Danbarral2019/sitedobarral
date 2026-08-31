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

/**
 * Shape de listagem: igual a `UnifiedDecision` sem `fullText`.
 *
 * `fullText` é o inteiro teor — depois do backfill do TCU, ~76 KB em média
 * (máx. ~437 KB) por linha. A listagem (`fetchUnifiedList`/`fetchUnifiedTopK`)
 * nunca usa esse campo (a página de listagem só mostra a ementa truncada);
 * só a página de detalhe (`fetchUnifiedById`) precisa do inteiro teor. Buscar
 * `fullText` do Neon em toda paginação inflaria o payload por page view à
 * toa — daí o tipo separado, para o TypeScript pegar quem tentar usá-lo.
 */
export type UnifiedDecisionListItem = Omit<UnifiedDecision, 'fullText'>;

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

export interface TribunalDecisionWhereOptions {
  /**
   * Excluir do ramo A as decisões do TCU. Default `true`.
   *
   * O TCU vive nas duas tabelas: são 676 linhas em `TribunalDecision` e todas
   * as 676 também existem como `Document` (conferido número a número). Como
   * `composeUnifiedBody` faz `UNION ALL` sem dedup, sem esta exclusão cada
   * acórdão do TCU aparece duas vezes na listagem — o que estava acontecendo
   * em produção, 20 repetições nos 50 primeiros resultados.
   *
   * O TCU passa a vir só do ramo B, que é a fonte mais rica: ementa oficial
   * completa, inteiro teor, análise de relevância e página em /documento/[id].
   *
   * `false` só no caminho de busca por id — ver `fetchUnifiedById`.
   */
  excludeTcu?: boolean;
}

/**
 * WHERE de TribunalDecision.
 * - Sempre aplica `isRelevant=true AND approvalStatus IN (...)`
 * - Por padrão exclui o TCU, que pertence ao ramo B (ver `excludeTcu`)
 * - Filtros dinâmicos são adicionados apenas quando presentes
 */
export function buildTribunalDecisionWhere(
  filters: JurisprudenciaFilters,
  { excludeTcu = true }: TribunalDecisionWhereOptions = {}
): Prisma.Sql {
  const fragments: Prisma.Sql[] = [
    Prisma.sql`"isRelevant" = ${true}`,
    Prisma.sql`"approvalStatus" IN (${Prisma.join([
      'auto_approved',
      'manually_approved',
    ])})`,
  ];

  if (excludeTcu) {
    fragments.push(Prisma.sql`"tribunalCode" <> ${'TCU'}`);
  }

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
 *
 * `includeFullText` controla se a coluna pesada `fullText` é projetada. A
 * listagem passa `false` (ver `UnifiedDecisionListItem`); a página de
 * detalhe (`fetchUnifiedById`) passa `true`.
 */
function tribunalDecisionSelect(where: Prisma.Sql, includeFullText: boolean): Prisma.Sql {
  return Prisma.sql`
    SELECT
      id,
      "tribunalCode",
      "tribunalName",
      "decisionType",
      "decisionNumber",
      title,
      ementa,
      ${includeFullText ? Prisma.sql`"fullText"` : Prisma.sql`NULL::text AS "fullText"`},
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
 *
 * `includeFullText` (ver `tribunalDecisionSelect`): quando `false`, não
 * calcula `COALESCE("tcuTextoCompleto", content)` — o inteiro teor do TCU,
 * ~76 KB médios/437 KB máx. por acórdão após o backfill. `content` também é
 * pesado (texto bruto do Document), então nem ele deve ser lido à toa.
 */
function documentTcuSelect(where: Prisma.Sql, includeFullText: boolean): Prisma.Sql {
  return Prisma.sql`
    SELECT
      id,
      'TCU' AS "tribunalCode",
      'Tribunal de Contas da União' AS "tribunalName",
      'acordao' AS "decisionType",
      COALESCE("tcuNumeroAcordao", title) AS "decisionNumber",
      title,
      COALESCE("tcuEmentaCompleta", description, content, '') AS ementa,
      ${includeFullText ? Prisma.sql`COALESCE("tcuTextoCompleto", content) AS "fullText"` : Prisma.sql`NULL::text AS "fullText"`},
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
 *
 * `includeFullText` repassa para os dois SELECTs (ver `tribunalDecisionSelect`
 * / `documentTcuSelect`).
 */
function composeUnifiedBody(
  filters: JurisprudenciaFilters,
  includeFullText: boolean
): Prisma.Sql | null {
  const includeA = shouldIncludeTribunalDecisionBranch(filters);
  const includeB = shouldIncludeDocumentTcuBranch(filters);

  if (!includeA && !includeB) return null;

  if (includeA && includeB) {
    return Prisma.sql`
      (${tribunalDecisionSelect(buildTribunalDecisionWhere(filters), includeFullText)})
      UNION ALL
      (${documentTcuSelect(buildDocumentTcuWhere(filters), includeFullText)})
    `;
  }
  if (includeA) {
    return tribunalDecisionSelect(buildTribunalDecisionWhere(filters), includeFullText);
  }
  // includeB only
  return documentTcuSelect(buildDocumentTcuWhere(filters), includeFullText);
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
  items: UnifiedDecisionListItem[];
  total: number;
}

/**
 * Colunas projetadas na listagem/top-K — todos os campos de `UnifiedDecision`
 * MENOS `fullText` (inteiro teor, ver `UnifiedDecisionListItem`). Lista
 * explícita em vez de `SELECT *` para que o corte de `fullText` seja
 * garantido também no SELECT externo (o `composeUnifiedBody(..., false)` já
 * garante que a subquery nem calcula o valor).
 */
const LIST_ITEM_COLUMNS = Prisma.sql`
  id,
  "tribunalCode",
  "tribunalName",
  "decisionType",
  "decisionNumber",
  title,
  ementa,
  summary,
  relator,
  "orgaoJulgador",
  "dataJulgamento",
  "dataPublicacao",
  themes,
  "leiArticles",
  url,
  "pdfUrl",
  "isRelevant",
  "relevanceScore",
  "approvalStatus",
  year,
  "processNumber",
  "fullIdentifier",
  "sourceType",
  "sourceRawData",
  "createdAt",
  "updatedAt"
`;

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
  // false: listagem não usa o inteiro teor — ver `LIST_ITEM_COLUMNS`.
  const body = composeUnifiedBody(filters, false);
  if (!body) return { items: [], total: 0 };

  const offset = (page - 1) * pageSize;

  const itemsSql = Prisma.sql`
    SELECT ${LIST_ITEM_COLUMNS} FROM (${body}) unified
    ${getOrderClause(sort)}
    LIMIT ${pageSize} OFFSET ${offset}
  `;
  const countSql = Prisma.sql`
    SELECT COUNT(*)::int AS total FROM (${body}) sub
  `;

  const [items, countRows] = await Promise.all([
    prisma.$queryRaw<UnifiedDecisionListItem[]>(itemsSql),
    prisma.$queryRaw<Array<{ total: number }>>(countSql),
  ]);

  return { items, total: countRows[0]?.total ?? 0 };
}

export async function fetchUnifiedTopK(
  filters: JurisprudenciaFilters,
  topK: number
): Promise<UnifiedDecisionListItem[]> {
  // false: top-K alimenta cards/telemetria, não o inteiro teor — ver `LIST_ITEM_COLUMNS`.
  const body = composeUnifiedBody(filters, false);
  if (!body) return [];

  const sql = Prisma.sql`
    SELECT ${LIST_ITEM_COLUMNS} FROM (${body}) unified
    ORDER BY "relevanceScore" DESC NULLS LAST, "dataJulgamento" DESC NULLS LAST
    LIMIT ${topK}
  `;

  return prisma.$queryRaw<UnifiedDecisionListItem[]>(sql);
}

export async function fetchUnifiedById(
  id: string
): Promise<UnifiedDecision | null> {
  // true: página de detalhe precisa do inteiro teor.
  // Tenta ramo A primeiro (filtros equivalentes ao default).
  //
  // excludeTcu:false — a listagem esconde as 676 linhas TCU desta tabela por
  // serem duplicata, mas o sitemap já publicou /jurisprudencia/{id} para elas.
  // Herdar a exclusão aqui transformaria endereços indexados em 404.
  const tribA = await prisma.$queryRaw<UnifiedDecision[]>(Prisma.sql`
    SELECT * FROM (${tribunalDecisionSelect(
      buildTribunalDecisionWhere({}, { excludeTcu: false }),
      true
    )}) unified
    WHERE id = ${id}
    LIMIT 1
  `);
  if (tribA.length > 0) return tribA[0];

  const tribB = await prisma.$queryRaw<UnifiedDecision[]>(Prisma.sql`
    SELECT * FROM (${documentTcuSelect(
      buildDocumentTcuWhere({}),
      true
    )}) unified
    WHERE id = ${id}
    LIMIT 1
  `);
  if (tribB.length > 0) return tribB[0];

  return null;
}

export async function countUnifiedApproved(): Promise<number> {
  // false: só conta linhas, nunca lê o inteiro teor.
  const body = composeUnifiedBody({}, false);
  if (!body) return 0;
  const rows = await prisma.$queryRaw<Array<{ total: number }>>(Prisma.sql`
    SELECT COUNT(*)::int AS total FROM (${body}) sub
  `);
  return rows[0]?.total ?? 0;
}
