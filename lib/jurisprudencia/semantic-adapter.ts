/**
 * Semantic Adapter para a IA da Jurisprudência
 *
 * Traduz os filtros UI (JurisprudenciaFilters) em opções do vector-search
 * e adapta os resultados para o payload esperado pelo front-end.
 *
 * Ver spec: docs/superpowers/specs/2026-04-22-ia-jurisprudencia-semantic-search-design.md
 */

import { Prisma } from '@prisma/client';
import type { SearchOptions } from '@/lib/embeddings/vector-search';
import type { SearchResult } from '@/lib/embeddings/vector-search';
import type { JurisprudenciaFilters } from './unified-query';
import { prisma } from '@/lib/prisma';

const TCU_DOCUMENT_CATEGORIES = [
  'acordao',
  'consulta_tcu',
  'informativo',
  'manual-tcu',
] as const;

const ALL_CATEGORIES_WITH_ENUNCIADOS = [
  ...TCU_DOCUMENT_CATEGORIES,
  'enunciados',
] as const;

/**
 * Constrói extraWhere para o ramo DOCUMENT (categorias TCU principalmente).
 * Baseado em buildDocumentTcuWhere da PR anterior, mas SEM a condição base:
 * - `category IN (...)` agora é responsabilidade do `categoryIn` do vector-search
 * - `"tcuNumeroAcordao" IS NOT NULL` não se aplica pois o ramo também retorna
 *   informativos, manuais e enunciados (categorias sem número de acórdão TCU).
 */
function buildDocumentExtraWhere(
  filters: JurisprudenciaFilters
): Prisma.Sql | undefined {
  const fragments: Prisma.Sql[] = [];

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
    fragments.push(Prisma.sql`"tcuDataJulgamento" >= ${filters.dataFrom}`);
  }
  if (filters.dataTo) {
    fragments.push(Prisma.sql`"tcuDataJulgamento" <= ${filters.dataTo}`);
  }
  if (filters.q) {
    const term = '%' + filters.q + '%';
    fragments.push(
      Prisma.sql`(title ILIKE ${term} OR "tcuEmentaCompleta" ILIKE ${term})`
    );
  }

  if (fragments.length === 0) return undefined;
  return Prisma.join(fragments, ' AND ');
}

/**
 * Constrói extraWhere para o ramo TribunalDecision.
 * Versão sem a condição base (já aplicada no WHERE base do vector-search).
 */
function buildTribunalDecisionExtraWhere(
  filters: JurisprudenciaFilters
): Prisma.Sql | undefined {
  const fragments: Prisma.Sql[] = [];

  if (typeof filters.ano === 'number') {
    fragments.push(Prisma.sql`year = ${filters.ano}`);
  }
  if (filters.tema) {
    fragments.push(Prisma.sql`themes ILIKE ${'%' + filters.tema + '%'}`);
  }
  if (filters.artigo) {
    fragments.push(
      Prisma.sql`"leiArticles" ILIKE ${'%' + filters.artigo + '%'}`
    );
  }
  if (filters.decisionType) {
    fragments.push(Prisma.sql`"decisionType" = ${filters.decisionType}`);
  }
  if (filters.relator) {
    fragments.push(Prisma.sql`relator ILIKE ${'%' + filters.relator + '%'}`);
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

  if (fragments.length === 0) return undefined;
  return Prisma.join(fragments, ' AND ');
}

export function mapFiltersToSemanticOptions(
  filters: JurisprudenciaFilters
): SearchOptions {
  const base: SearchOptions = {
    skipLegislativeActBranch: true, // atos legislativos nunca entram na IA de jurisprudência
  };

  // Filtro tribunal — decisão principal
  if (filters.tribunal === 'TCU') {
    base.categoryIn = [...TCU_DOCUMENT_CATEGORIES];
    base.skipDocumentBranch = false;
    base.includeTribunalDecisions = false;
  } else if (filters.tribunal) {
    // TCE-SP, STJ, STF, etc: só TribunalDecisionChunk filtrado
    base.skipDocumentBranch = true;
    base.includeTribunalDecisions = true;
    base.tribunalCodeFilter = filters.tribunal;
  } else {
    // Sem filtro: tudo (incluindo enunciados)
    base.categoryIn = [...ALL_CATEGORIES_WITH_ENUNCIADOS];
    base.skipDocumentBranch = false;
    base.includeTribunalDecisions = true;
  }

  // decisionType: se não for 'acordao' ou vazio, pula ramo Document
  // (informativos/manuais/enunciados não são "acordao" na taxonomia).
  // Nota: quando tribunal=TCU + decisionType!=acordao, ambos os ramos ficam
  // inativos e a rota devolve conjunto vazio — comportamento esperado.
  if (
    filters.decisionType &&
    filters.decisionType !== 'acordao'
  ) {
    base.skipDocumentBranch = true;
  }

  const docWhere = !base.skipDocumentBranch
    ? buildDocumentExtraWhere(filters)
    : undefined;
  const tdWhere = base.includeTribunalDecisions
    ? buildTribunalDecisionExtraWhere(filters)
    : undefined;

  if (docWhere || tdWhere) {
    base.extraWhere = {
      ...(docWhere && { document: docWhere }),
      ...(tdWhere && { tribunalDecision: tdWhere }),
    };
  }

  return base;
}

// ──────────────────────────────────────────────────────────────────────────
// Enriquecimento de resultados
// ──────────────────────────────────────────────────────────────────────────

export interface EnrichedDocument {
  id: string;
  title: string;
  category: string;
  tcuNumeroAcordao: string | null;
  tcuEmentaCompleta: string | null;
  description: string | null;
  content: string | null;
  tcuRelator: string | null;
  tcuAutorTese: string | null;
  tcuOrgaoJulgador: string | null;
  tcuDataJulgamento: Date | null;
  tcuLinkPDF: string | null;
  summary: string | null;
  themes: string | null;
  leiArticles: string | null;
  url: string | null;
  douData: Date | null;
  uploadedAt: Date;
  updatedAt: Date;
  entityType: string | null;
  enunciadoNumber: string | null;
}

export interface EnrichedTribunalDecision {
  id: string;
  tribunalCode: string;
  tribunalName: string;
  decisionType: string;
  decisionNumber: string;
  title: string;
  ementa: string;
  summary: string | null;
  relator: string | null;
  orgaoJulgador: string | null;
  dataJulgamento: Date | null;
  themes: string | null;
  leiArticles: string | null;
  url: string | null;
}

export interface EnrichedSource {
  documentId: string;
  similarity: number;
  chunkContent: string;
  source:
    | { kind: 'document'; data: EnrichedDocument; category: string }
    | { kind: 'tribunal-decision'; data: EnrichedTribunalDecision };
}

export async function enrichSources(
  results: SearchResult[]
): Promise<EnrichedSource[]> {
  const docIds = results
    .filter(r => r.sourceType === 'document')
    .map(r => r.documentId);
  const tdIds = results
    .filter(r => r.sourceType === 'tribunal-decision')
    .map(r => r.documentId);

  const [docs, tds] = await Promise.all([
    docIds.length > 0
      ? prisma.document.findMany({
          where: { id: { in: docIds } },
          select: {
            id: true,
            title: true,
            category: true,
            tcuNumeroAcordao: true,
            tcuEmentaCompleta: true,
            description: true,
            content: true,
            tcuRelator: true,
            tcuAutorTese: true,
            tcuOrgaoJulgador: true,
            tcuDataJulgamento: true,
            tcuLinkPDF: true,
            summary: true,
            themes: true,
            leiArticles: true,
            url: true,
            douData: true,
            uploadedAt: true,
            updatedAt: true,
            entityType: true,
            enunciadoNumber: true,
          },
        })
      : Promise.resolve([] as EnrichedDocument[]),
    tdIds.length > 0
      ? prisma.tribunalDecision.findMany({
          where: { id: { in: tdIds } },
          select: {
            id: true,
            tribunalCode: true,
            tribunalName: true,
            decisionType: true,
            decisionNumber: true,
            title: true,
            ementa: true,
            summary: true,
            relator: true,
            orgaoJulgador: true,
            dataJulgamento: true,
            themes: true,
            leiArticles: true,
            url: true,
          },
        })
      : Promise.resolve([] as EnrichedTribunalDecision[]),
  ]);

  const docById = new Map(docs.map(d => [d.id, d]));
  const tdById = new Map(tds.map(t => [t.id, t]));

  const enriched: EnrichedSource[] = [];
  for (const r of results) {
    if (r.sourceType === 'document') {
      const doc = docById.get(r.documentId);
      if (!doc) continue; // órfão — skip silencioso
      enriched.push({
        documentId: r.documentId,
        similarity: r.similarity,
        chunkContent: r.chunkContent,
        source: { kind: 'document', data: doc, category: doc.category },
      });
    } else if (r.sourceType === 'tribunal-decision') {
      const td = tdById.get(r.documentId);
      if (!td) continue;
      enriched.push({
        documentId: r.documentId,
        similarity: r.similarity,
        chunkContent: r.chunkContent,
        source: { kind: 'tribunal-decision', data: td },
      });
    }
    // legislative-act não chega aqui porque skipLegislativeActBranch=true na rota IA
  }

  return enriched;
}

// ──────────────────────────────────────────────────────────────────────────
// Payload uniforme para o front-end
// ──────────────────────────────────────────────────────────────────────────

export interface JurisprudenciaSource {
  id: string;
  tribunalCode: string;
  tribunalName: string;
  decisionType: string;
  decisionNumber: string;
  title: string;
  relator: string | null;
  orgaoJulgador: string | null;
  dataJulgamento: Date | null;
  url: string | null;
  sourceType: string; // 'tribunal-decision' | 'document-tcu-acordao' | 'document-tcu-informativo' | ...
  similarity: number;
}

const ENTITY_TRIBUNAL_NAMES: Record<string, string> = {
  IBDA: 'Instituto Brasileiro de Direito Administrativo',
  INCP: 'Instituto Nacional da Contratação Pública',
  CJF: 'Conselho da Justiça Federal',
};

function deriveInformativoNumber(title: string): string {
  // Tenta casar "Informativo LC nº 42", "Informativo CGU 123", etc.
  const match = title.match(/Informativo[\s\w]*?(nº\s*\d+|\d+)/i);
  return match ? match[0] : title;
}

export function adaptToSourcesPayload(
  enriched: EnrichedSource[]
): JurisprudenciaSource[] {
  return enriched.map(e => {
    if (e.source.kind === 'tribunal-decision') {
      const td = e.source.data;
      return {
        id: td.id,
        tribunalCode: td.tribunalCode,
        tribunalName: td.tribunalName,
        decisionType: td.decisionType,
        decisionNumber: td.decisionNumber,
        title: td.title,
        relator: td.relator,
        orgaoJulgador: td.orgaoJulgador,
        dataJulgamento: td.dataJulgamento,
        url: td.url,
        sourceType: 'tribunal-decision',
        similarity: e.similarity,
      };
    }

    // Document — switch por categoria
    const doc = e.source.data;
    switch (e.source.category) {
      case 'acordao':
      case 'consulta_tcu':
        return {
          id: doc.id,
          tribunalCode: 'TCU',
          tribunalName: 'Tribunal de Contas da União',
          decisionType: 'acordao',
          decisionNumber: doc.tcuNumeroAcordao ?? doc.title,
          title: doc.title,
          relator: doc.tcuRelator ?? doc.tcuAutorTese,
          orgaoJulgador: doc.tcuOrgaoJulgador,
          dataJulgamento: doc.tcuDataJulgamento,
          url: doc.url,
          sourceType: `document-tcu-${e.source.category === 'consulta_tcu' ? 'consulta' : 'acordao'}`,
          similarity: e.similarity,
        };
      case 'informativo':
        return {
          id: doc.id,
          tribunalCode: 'TCU',
          tribunalName: 'Tribunal de Contas da União',
          decisionType: 'informativo',
          decisionNumber: deriveInformativoNumber(doc.title),
          title: doc.title,
          relator: null,
          orgaoJulgador: null,
          dataJulgamento: doc.douData ?? doc.uploadedAt,
          url: doc.url,
          sourceType: 'document-tcu-informativo',
          similarity: e.similarity,
        };
      case 'manual-tcu':
        return {
          id: doc.id,
          tribunalCode: 'TCU',
          tribunalName: 'Tribunal de Contas da União',
          decisionType: 'manual',
          decisionNumber: doc.title,
          title: doc.title,
          relator: null,
          orgaoJulgador: null,
          dataJulgamento: doc.uploadedAt,
          url: doc.url,
          sourceType: 'document-tcu-manual',
          similarity: e.similarity,
        };
      case 'enunciados': {
        const code = doc.entityType ?? 'IBDA';
        return {
          id: doc.id,
          tribunalCode: code,
          tribunalName: ENTITY_TRIBUNAL_NAMES[code] ?? code,
          decisionType: 'enunciado',
          decisionNumber: doc.enunciadoNumber ?? doc.title,
          title: doc.title,
          relator: null,
          orgaoJulgador: null,
          dataJulgamento: doc.uploadedAt,
          url: doc.url,
          sourceType: 'document-tcu-enunciado',
          similarity: e.similarity,
        };
      }
      default:
        // Fallback genérico — não deveria acontecer, mas shape sempre válido
        return {
          id: doc.id,
          tribunalCode: 'TCU',
          tribunalName: 'Tribunal de Contas da União',
          decisionType: e.source.category,
          decisionNumber: doc.title,
          title: doc.title,
          relator: null,
          orgaoJulgador: null,
          dataJulgamento: doc.uploadedAt,
          url: doc.url,
          sourceType: `document-${e.source.category}`,
          similarity: e.similarity,
        };
    }
  });
}

/**
 * Fallback chain para ementa, usado na construção do prompt Gemini.
 * Document TCU acórdão tem tcuEmentaCompleta; informativo usa description; etc.
 */
export function resolveEmenta(e: EnrichedSource): string {
  if (e.source.kind === 'tribunal-decision') {
    return e.source.data.ementa ?? '';
  }
  const doc = e.source.data;
  return (
    doc.tcuEmentaCompleta ??
    doc.description ??
    doc.content ??
    ''
  );
}
