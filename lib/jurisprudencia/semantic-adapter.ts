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
import type { JurisprudenciaFilters } from './unified-query';

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
 * Baseado em buildDocumentTcuWhere da PR anterior, mas SEM a condição base
 * (category IN (...)) que agora é responsabilidade do categoryIn do vector-search.
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
  // (informativos/manuais/enunciados não são "acordao" na taxonomia)
  if (
    filters.decisionType &&
    filters.decisionType !== 'acordao'
  ) {
    base.skipDocumentBranch = true;
    if (!base.includeTribunalDecisions) {
      // coerência: se estávamos em modo TCU-only e usuário pediu sumula, não há nada a retornar
      base.includeTribunalDecisions = false;
    }
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
