import { NextRequest, NextResponse } from 'next/server';
import { withAdminApi } from '@/lib/api/handler';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/admin/pareceres/list?filter=irrelevantes|overrides|todos&page=1&pageSize=30
 *
 * Lista pareceres CONUNI pra revisão admin da classificação Gemini.
 *
 * filter:
 *   - irrelevantes: licitacoesContratos:false (sem override) — candidatos a falso negativo
 *   - relevantes:   licitacoesContratos:true sem override — pra revisar falsos positivos
 *   - overrides:    aqueles com override manual — pra desfazer se quiser
 *   - todos:        sem filtro de classificação
 */
export const GET = withAdminApi(async (request: NextRequest) => {
  const sp = request.nextUrl.searchParams;
    const filter = sp.get('filter') || 'irrelevantes';
    const page = Math.max(1, parseInt(sp.get('page') || '1', 10));
    const pageSize = Math.min(100, Math.max(10, parseInt(sp.get('pageSize') || '30', 10)));
    const q = (sp.get('q') || '').trim();

    type WhereClause = {
      category: { in: string[] };
      AND?: Array<Record<string, unknown>>;
      aiClassification?: Record<string, unknown>;
      OR?: Array<Record<string, unknown>>;
    };

    const where: WhereClause = {
      category: { in: ['parecer', 'parecer-vinculante', 'decor', 'nota-tecnica', 'despacho'] },
    };

    if (filter === 'irrelevantes') {
      where.AND = [
        { aiClassification: { contains: '"licitacoesContratos":false' } },
        { NOT: { aiClassification: { contains: 'licitacoesContratosManualBy' } } },
      ];
    } else if (filter === 'relevantes') {
      where.AND = [
        { aiClassification: { contains: '"licitacoesContratos":true' } },
        { NOT: { aiClassification: { contains: 'licitacoesContratosManualBy' } } },
      ];
    } else if (filter === 'overrides') {
      where.aiClassification = { contains: 'licitacoesContratosManualBy' };
    }

    if (q) {
      where.OR = [
        { title: { contains: q, mode: 'insensitive' as const } },
        { description: { contains: q, mode: 'insensitive' as const } },
      ];
    }

    const [docs, total] = await Promise.all([
      prisma.document.findMany({
        where,
        select: {
          id: true,
          title: true,
          description: true,
          url: true,
          category: true,
          aiClassification: true,
          uploadedAt: true,
        },
        orderBy: { uploadedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.document.count({ where }),
    ]);

    // Decodifica aiClassification pra resposta enxuta
    const items = docs.map(d => {
      const ai = d.aiClassification ? safeJson(d.aiClassification) : {};
      return {
        id: d.id,
        title: d.title,
        description: d.description?.slice(0, 240) ?? null,
        url: d.url,
        category: d.category,
        uploadedAt: d.uploadedAt.toISOString(),
        licitacoesContratos: ai.licitacoesContratos ?? null,
        licitacoesContratosAi: ai.licitacoesContratosAi ?? null,
        manualBy: ai.licitacoesContratosManualBy ?? null,
        manualAt: ai.licitacoesContratosManualAt ?? null,
        confidence: ai.classificationConfidence ?? null,
        reasoning: ai.classificationReasoning ?? null,
        cursosRelevantes: ai.cursosRelevantes ?? [],
        leiArticles: ai.leiArticles ?? [],
        subtemas: ai.subtemas ?? [],
        vigencia: ai.vigencia ?? null,
        orgao: ai.orgao ?? null,
      };
    });

    return NextResponse.json({
      items,
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    });
});

function safeJson(s: string): Record<string, unknown> & {
  licitacoesContratos?: boolean;
  licitacoesContratosAi?: boolean | null;
  licitacoesContratosManualBy?: string;
  licitacoesContratosManualAt?: string;
  classificationConfidence?: string;
  classificationReasoning?: string;
  cursosRelevantes?: string[];
  leiArticles?: string[];
  subtemas?: string[];
  vigencia?: string;
  orgao?: string;
} {
  try { return JSON.parse(s); } catch { return {}; }
}
