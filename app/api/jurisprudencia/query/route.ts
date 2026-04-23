import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api-middleware';
import {
  fetchUnifiedTopK,
  countUnifiedApproved,
  type JurisprudenciaFilters,
  type UnifiedDecision,
} from '@/lib/jurisprudencia/unified-query';
import { queryGeminiText } from '@/lib/gemini/cached-client';
import { handleApiError } from '@/lib/errors/error-handler';
import { apiLogger } from '@/lib/logger';
import { z } from 'zod';

export const runtime = 'nodejs';
export const maxDuration = 60;

const TRIBUNAL_CODES = [
  'TCU',
  'TCE-SP',
  'TCE-PR',
  'TCE-MG',
  'TCE-RS',
  'TCE-SC',
  'TCE-RJ',
  'TCE-PE',
  'STJ',
  'STF',
] as const;

const DECISION_TYPES = [
  'acordao',
  'decisao',
  'parecer_previo',
  'sumula',
] as const;

const filtersSchema = z
  .object({
    tribunal: z.enum(TRIBUNAL_CODES).optional(),
    year: z.number().int().optional(),
    theme: z.string().optional(),
    leiArticle: z.string().optional(),
    decisionType: z.enum(DECISION_TYPES).optional(),
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

const MAX_EMENTA_CHARS = 800;
const DEFAULT_TOP_K = 6;

type Filters = z.infer<typeof filtersSchema>;

function toJurisprudenciaFilters(filters: Filters): JurisprudenciaFilters {
  if (!filters) return {};
  return {
    tribunal: filters.tribunal,
    ano: filters.year,
    tema: filters.theme,
    artigo: filters.leiArticle,
    decisionType: filters.decisionType,
    relator: filters.relator,
    orgao: filters.orgao,
    dataFrom: filters.dataFrom ? new Date(filters.dataFrom) : undefined,
    dataTo: filters.dataTo ? new Date(filters.dataTo) : undefined,
    q: filters.q,
  };
}

function truncate(value: string | null | undefined, limit: number): string {
  if (!value) return '';
  return value.length > limit ? value.slice(0, limit) + '...' : value;
}

function buildPrompt(question: string, decisions: UnifiedDecision[]): string {
  const header = `Você é um assistente jurídico especializado em licitações, contratos públicos e Lei 14.133/2021. Responda à pergunta do aluno exclusivamente com base nos trechos de decisões de tribunais fornecidos abaixo. Cite as decisões pelo identificador (ex.: [TCE-SP Acórdão 1234/2024]). Se os trechos não forem suficientes, diga isso com clareza e sugira ajustar os filtros.`;

  const blocks = decisions
    .map((d, idx) => {
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
    })
    .join('\n\n---\n\n');

  return `${header}

PERGUNTA DO ALUNO:
${question}

DECISÕES CONSULTADAS:
${blocks}

Sua resposta (em português, estruturada, com citações no formato [Tribunal Tipo Número]):`;
}

export const POST = withAuth(
  async (request: NextRequest, context?: Record<string, unknown>) => {
    try {
      const user = context?.user as { userId: string; role?: string };

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
          { status: 503 }
        );
      }

      const { query, filters, topK } = parsed.data;
      const limit = topK ?? DEFAULT_TOP_K;

      const jurisFilters = toJurisprudenciaFilters(filters);
      const decisions = await fetchUnifiedTopK(jurisFilters, limit);

      if (decisions.length === 0) {
        const totalInDatabase = await countUnifiedApproved();
        const msg =
          totalInDatabase === 0
            ? 'A base de jurisprudência deste ambiente ainda não foi populada. Fale com o administrador para rodar a ingestão de decisões.'
            : 'Nenhuma decisão casou com os filtros ativos. Tente afrouxar os filtros (por exemplo, limpar tribunal, ano ou texto) e perguntar novamente.';
        return NextResponse.json({
          answer: msg,
          sources: [],
          consulted: 0,
          totalInDatabase,
        });
      }

      const prompt = buildPrompt(query, decisions);

      const sourcesPayload = decisions.map(d => ({
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
        sourceType: d.sourceType,
      }));

      let answerText: string;
      let cached = false;

      try {
        const result = await queryGeminiText(prompt, {
          temperature: 0.3,
          maxOutputTokens: 1500,
          useCache: true,
          systemInstruction:
            'Você é um assistente jurídico técnico e conciso. Fundamente tudo nas decisões citadas; nunca invente números de acórdão ou relatores.',
        });

        if (!result.response || result.response.trim().length === 0) {
          throw new Error('empty-response');
        }

        answerText = result.response;
        cached = result.cached;

        const tcuCount = decisions.filter(
          d => d.sourceType === 'document-tcu'
        ).length;
        const tribunalDecisionCount = decisions.length - tcuCount;

        apiLogger.info(
          {
            userId: user.userId,
            consulted: decisions.length,
            tcuCount,
            tribunalDecisionCount,
            cached,
            latencyMs: result.latency,
          },
          'jurisprudencia/query answered'
        );
      } catch (err) {
        apiLogger.error(
          { userId: user.userId, consulted: decisions.length, err },
          'jurisprudencia/query Gemini failed — returning sources only'
        );
        const errMsg = err instanceof Error ? err.message : String(err);
        const errStack = err instanceof Error ? err.stack : undefined;
        answerText =
          'Não consegui gerar uma síntese agora — o modelo de IA pode estar sobrecarregado, em timeout ou indisponível. Encontrei as decisões relevantes abaixo; consulte-as diretamente ou tente perguntar de novo em alguns instantes.';

        // Debug info liberado enquanto estamos diagnosticando o bug em preview.
        // TODO: restringir para role === 'admin' quando o diagnóstico terminar.
        const debug = { geminiError: errMsg, stack: errStack };
        return NextResponse.json({
          answer: answerText,
          sources: sourcesPayload,
          consulted: decisions.length,
          cached: false,
          debug,
        });
      }

      return NextResponse.json({
        answer: answerText,
        sources: sourcesPayload,
        consulted: decisions.length,
        cached,
      });
    } catch (error) {
      return handleApiError(error);
    }
  }
);
