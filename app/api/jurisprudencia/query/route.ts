import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api-middleware';
import { prisma } from '@/lib/prisma';
import { queryGeminiText } from '@/lib/gemini/cached-client';
import { handleApiError } from '@/lib/errors/error-handler';
import { apiLogger } from '@/lib/logger';
import { z } from 'zod';

export const runtime = 'nodejs';

const filtersSchema = z
  .object({
    tribunal: z.string().optional(),
    year: z.number().int().optional(),
    theme: z.string().optional(),
    leiArticle: z.string().optional(),
    decisionType: z.string().optional(),
    relator: z.string().optional(),
    orgao: z.string().optional(),
    dataFrom: z.string().optional(),
    dataTo: z.string().optional(),
    q: z.string().optional(),
  })
  .optional();

const bodySchema = z.object({
  query: z.string().min(3).max(500),
  filters: filtersSchema,
  topK: z.number().int().min(1).max(20).optional(),
});

const MAX_EMENTA_CHARS = 1200;
const DEFAULT_TOP_K = 8;

type JurisFilters = z.infer<typeof filtersSchema>;

function buildWhere(filters: JurisFilters, queryText: string) {
  const where: Record<string, unknown> = {
    isRelevant: true,
    approvalStatus: { in: ['auto_approved', 'manually_approved'] },
  };

  if (filters?.tribunal) where.tribunalCode = filters.tribunal;
  if (filters?.year) where.year = filters.year;
  if (filters?.theme)
    where.themes = { contains: filters.theme, mode: 'insensitive' };
  if (filters?.leiArticle)
    where.leiArticles = { contains: filters.leiArticle, mode: 'insensitive' };
  if (filters?.decisionType) where.decisionType = filters.decisionType;
  if (filters?.relator)
    where.relator = { contains: filters.relator, mode: 'insensitive' };
  if (filters?.orgao)
    where.orgaoJulgador = { contains: filters.orgao, mode: 'insensitive' };

  if (filters?.dataFrom || filters?.dataTo) {
    const dateFilter: Record<string, Date> = {};
    if (filters.dataFrom) dateFilter.gte = new Date(filters.dataFrom);
    if (filters.dataTo) dateFilter.lte = new Date(filters.dataTo);
    where.dataJulgamento = dateFilter;
  }

  const textTerm = filters?.q?.trim() || queryText.trim();
  if (textTerm) {
    where.OR = [
      { title: { contains: textTerm, mode: 'insensitive' } },
      { ementa: { contains: textTerm, mode: 'insensitive' } },
      { summary: { contains: textTerm, mode: 'insensitive' } },
    ];
  }

  return where;
}

function truncate(value: string | null | undefined, limit: number): string {
  if (!value) return '';
  return value.length > limit ? value.slice(0, limit) + '...' : value;
}

function buildPrompt(question: string, decisions: Array<{
  tribunalCode: string;
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
}>) {
  const header = `Você é um assistente jurídico especializado em licitações, contratos públicos e Lei 14.133/2021. Responda à pergunta do aluno exclusivamente com base nos trechos de decisões de tribunais fornecidos abaixo. Cite as decisões pelo identificador (ex.: [TCE-SP Acórdão 1234/2024]). Se os trechos não forem suficientes, diga isso com clareza e sugira ajustar os filtros.`;

  const blocks = decisions.map((d, idx) => {
    const id = `${d.tribunalCode} ${d.decisionType} ${d.decisionNumber}`;
    const dateStr = d.dataJulgamento
      ? new Date(d.dataJulgamento).toLocaleDateString('pt-BR')
      : 'data não informada';
    return `[${idx + 1}] ${id} — ${dateStr}
Título: ${d.title}
Órgão: ${d.orgaoJulgador || 'n/d'} | Relator: ${d.relator || 'n/d'}
Temas: ${d.themes || 'n/d'} | Artigos Lei 14.133: ${d.leiArticles || 'n/d'}
Ementa: ${truncate(d.ementa, MAX_EMENTA_CHARS)}
Resumo IA: ${truncate(d.summary, 600)}`;
  }).join('\n\n---\n\n');

  return `${header}

PERGUNTA DO ALUNO:
${question}

DECISÕES CONSULTADAS:
${blocks}

Sua resposta (em português, estruturada, com citações no formato [Tribunal Tipo Número]):`;
}

export const POST = withAuth(async (request: NextRequest, context?: Record<string, unknown>) => {
  try {
    const user = context?.user as { userId: string };

    const json = await request.json();
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Requisição inválida', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        {
          error:
            'Serviço de IA não está configurado neste ambiente. A pesquisa com IA requer a variável GEMINI_API_KEY — peça ao administrador para provisioná-la.',
        },
        { status: 503 },
      );
    }

    const { query, filters, topK } = parsed.data;
    const limit = topK ?? DEFAULT_TOP_K;

    const where = buildWhere(filters, query);

    const decisions = await prisma.tribunalDecision.findMany({
      where,
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
        relevanceScore: true,
      },
      orderBy: [
        { relevanceScore: 'desc' },
        { dataJulgamento: { sort: 'desc', nulls: 'last' } },
      ],
      take: limit,
    });

    if (decisions.length === 0) {
      return NextResponse.json({
        answer:
          'Não encontrei decisões que casem com a sua pergunta e os filtros atuais. Tente afrouxar os filtros (por exemplo, remover o tribunal ou o ano) ou reformular a pergunta.',
        sources: [],
        consulted: 0,
      });
    }

    const prompt = buildPrompt(query, decisions);

    const result = await queryGeminiText(prompt, {
      model: 'gemini-2.0-flash',
      temperature: 0.3,
      maxOutputTokens: 1500,
      useCache: true,
      systemInstruction:
        'Você é um assistente jurídico técnico e conciso. Fundamente tudo nas decisões citadas; nunca invente números de acórdão ou relatores.',
    });

    apiLogger.info(
      { userId: user.userId, consulted: decisions.length, cached: result.cached, latencyMs: result.latency },
      'jurisprudencia/query answered'
    );

    return NextResponse.json({
      answer: result.response,
      sources: decisions.map(d => ({
        id: d.id,
        tribunalCode: d.tribunalCode,
        tribunalName: d.tribunalName,
        decisionType: d.decisionType,
        decisionNumber: d.decisionNumber,
        title: d.title,
        relator: d.relator,
        orgaoJulgador: d.orgaoJulgador,
        dataJulgamento: d.dataJulgamento,
        url: d.url,
      })),
      consulted: decisions.length,
      cached: result.cached,
    });
  } catch (error) {
    return handleApiError(error);
  }
});
