import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { safeParseArray } from '@/lib/utils';

/**
 * GET /api/lei-14133/article-docs/[numero]
 *
 * Retorna documentos vinculados a um artigo da Lei 14.133, separados em:
 * - highlights: top 5 com maior score (regulamentação central + maior conexão real)
 * - byCategory: todos agrupados por categoria de exibição
 *
 * Score combina:
 * (a) hierarquia normativa (Lei > Decreto > IN > Portaria)
 * (b) Document.notesImportance (override admin: critica > alta > media)
 * (c) especificidade: docs com poucos leiArticles linkados pesam mais
 * (d) tier do LegislativeAct (hierarchyLevel) + esfera federal
 */

interface EnrichedDoc {
  id: string;
  title: string;
  type: 'document' | 'legislativeAct';
  category: string | null;
  isPublic: boolean;
  url?: string;
  summary?: string | null;
  ementa?: string | null;
  notesImportance?: string | null;
  hierarchyLevel?: number | null;
  esfera?: string | null;
  fullNumber?: string | null;
  issuer?: string | null;
  leiArticlesCount: number;
  score: number;
  highlightReason: string;
}

const CATEGORY_DISPLAY: Record<string, string> = {
  lei: 'Leis',
  'medida-provisoria': 'Leis',
  decreto: 'Decretos',
  portaria: 'Portarias',
  in: 'Instruções Normativas',
  'orientacao-normativa': 'Orientações Normativas - AGU',
  'parecer-vinculante': 'Precedentes da AGU',
  decor: 'Precedentes da AGU',
  acordao: 'Jurisprudência dos Tribunais de Contas',
  enunciados: 'Enunciados',
};

const DISPLAY_ORDER = [
  'Leis',
  'Decretos',
  'Portarias',
  'Instruções Normativas',
  'Orientações Normativas - AGU',
  'Precedentes da AGU',
  'Jurisprudência dos Tribunais de Contas',
  'Enunciados',
  'Outros Documentos',
];

const DOCUMENT_CATEGORY_SCORE: Record<string, number> = {
  lei: 150,
  'medida-provisoria': 130,
  decreto: 110,
  in: 90,
  portaria: 70,
  'orientacao-normativa': 80,
  'parecer-vinculante': 55,
  decor: 50,
  acordao: 35,
  enunciados: 45,
};

function importanceBoost(importance: string | null | undefined): number {
  if (importance === 'critica') return 1000;
  if (importance === 'alta') return 500;
  if (importance === 'media') return 100;
  return 0;
}

function legislativeTierScore(hierarchyLevel: number | null | undefined, esfera: string | null | undefined): number {
  if (!hierarchyLevel) return 0;
  // hierarchyLevel: 1=Lei, 2=Decreto, 3=Portaria, 4=IN, 5=OS
  const base = (6 - hierarchyLevel) * 30; // Lei=150, Decreto=120, Portaria=90, IN=60, OS=30
  const federalBonus = esfera === 'federal' ? 25 : 0;
  return base + federalBonus;
}

function specificityBoost(leiArticlesCount: number): number {
  if (leiArticlesCount === 1) return 60;
  if (leiArticlesCount <= 3) return 35;
  if (leiArticlesCount <= 8) return 15;
  if (leiArticlesCount <= 20) return 5;
  return 0;
}

function buildHighlightReason(doc: EnrichedDoc): string {
  const reasons: string[] = [];
  if (doc.notesImportance === 'critica' || doc.notesImportance === 'alta') {
    reasons.push('Marcado como destaque pelo professor');
  }
  if (doc.type === 'legislativeAct' && doc.hierarchyLevel && doc.hierarchyLevel <= 2) {
    reasons.push(doc.hierarchyLevel === 1 ? 'Norma de hierarquia máxima (lei)' : 'Decreto regulamentador');
  }
  if (doc.leiArticlesCount === 1) {
    reasons.push('Trata exclusivamente deste artigo');
  } else if (doc.leiArticlesCount <= 3) {
    reasons.push('Foco direto neste artigo');
  }
  if (doc.category === 'orientacao-normativa') {
    reasons.push('Orientação Normativa da AGU');
  }
  return reasons.length > 0 ? reasons.join(' · ') : 'Vinculado ao artigo';
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ numero: string }> }
) {
  try {
    const { numero } = await params;
    const numeroStr = String(numero);

    if (!numeroStr || !/^\d+(-[A-Z])?$/.test(numeroStr)) {
      return NextResponse.json({ error: 'Número de artigo inválido' }, { status: 400 });
    }

    const authResult = await verifyAuth(request);
    const isAuthenticated = authResult.valid;

    // Busca todos os Documents que linkam este artigo
    const documents = await prisma.document.findMany({
      where: {
        leiArticles: { not: null },
        ...(!isAuthenticated && { isPublic: true }),
      },
      select: {
        id: true,
        title: true,
        category: true,
        isPublic: true,
        url: true,
        summary: true,
        description: true,
        notesImportance: true,
        leiArticles: true,
      },
    });

    // Busca todos os LegislativeActs que linkam este artigo (sempre públicos)
    const acts = await prisma.legislativeAct.findMany({
      where: { leiArticles: { not: null } },
      select: {
        id: true,
        fullNumber: true,
        title: true,
        ementa: true,
        summary: true,
        type: true,
        hierarchyLevel: true,
        esfera: true,
        issuer: true,
        officialUrl: true,
        leiArticles: true,
      },
    });

    const enriched: EnrichedDoc[] = [];

    for (const doc of documents) {
      const articles = safeParseArray(doc.leiArticles);
      if (!articles.map(String).includes(numeroStr)) continue;

      const baseScore = DOCUMENT_CATEGORY_SCORE[doc.category || ''] ?? 10;
      const score =
        importanceBoost(doc.notesImportance) +
        baseScore +
        specificityBoost(articles.length);

      const item: EnrichedDoc = {
        id: doc.id,
        title: doc.title,
        type: 'document',
        category: doc.category,
        isPublic: doc.isPublic,
        url: doc.url,
        summary: doc.summary || doc.description,
        notesImportance: doc.notesImportance,
        leiArticlesCount: articles.length,
        score,
        highlightReason: '',
      };
      item.highlightReason = buildHighlightReason(item);
      enriched.push(item);
    }

    for (const act of acts) {
      const articles = safeParseArray(act.leiArticles);
      if (!articles.map(String).includes(numeroStr)) continue;

      const score =
        legislativeTierScore(act.hierarchyLevel, act.esfera) +
        specificityBoost(articles.length);

      const item: EnrichedDoc = {
        id: act.id,
        title: `${act.fullNumber} — ${act.title}`,
        type: 'legislativeAct',
        category: act.type,
        isPublic: true,
        url: act.officialUrl || undefined,
        summary: act.summary || act.ementa,
        ementa: act.ementa,
        hierarchyLevel: act.hierarchyLevel,
        esfera: act.esfera,
        fullNumber: act.fullNumber,
        issuer: act.issuer,
        leiArticlesCount: articles.length,
        score,
        highlightReason: '',
      };
      item.highlightReason = buildHighlightReason(item);
      enriched.push(item);
    }

    enriched.sort((a, b) => b.score - a.score);

    const HIGHLIGHTS_COUNT = 5;
    const highlights = enriched.slice(0, HIGHLIGHTS_COUNT);

    // Agrupa todos por categoria de exibição (highlights e demais)
    const byCategory: Record<string, EnrichedDoc[]> = {};
    for (const doc of enriched) {
      const display = CATEGORY_DISPLAY[doc.category || ''] || 'Outros Documentos';
      if (!byCategory[display]) byCategory[display] = [];
      byCategory[display].push(doc);
    }

    const sortedCategoryNames = Object.keys(byCategory).sort((a, b) => {
      const ia = DISPLAY_ORDER.indexOf(a);
      const ib = DISPLAY_ORDER.indexOf(b);
      return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
    });

    const orderedByCategory: Record<string, EnrichedDoc[]> = {};
    for (const name of sortedCategoryNames) {
      orderedByCategory[name] = byCategory[name];
    }

    return NextResponse.json({
      articleNumber: numeroStr,
      total: enriched.length,
      highlights,
      byCategory: orderedByCategory,
    });
  } catch (error) {
    console.error('[article-docs] Erro:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar documentos do artigo' },
      { status: 500 }
    );
  }
}
