import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api-middleware';
import { semanticSearch } from '@/lib/embeddings/vector-search';
import {
  mapFiltersToSemanticOptions,
  enrichSources,
  adaptToSourcesPayload,
  resolveEmenta,
  type EnrichedSource,
  type JurisprudenciaSource,
} from '@/lib/jurisprudencia/semantic-adapter';
import { countUnifiedApproved } from '@/lib/jurisprudencia/unified-query';
import type { JurisprudenciaFilters } from '@/lib/jurisprudencia/unified-query';
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
const MAX_CHUNK_CHARS = 600;
const MAX_SUMMARY_CHARS = 600;
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

function buildPrompt(
  question: string,
  enriched: EnrichedSource[],
  payload: JurisprudenciaSource[]
): string {
  const header = `Você é um assistente jurídico especializado em licitações, contratos públicos e Lei 14.133/2021. Responda à pergunta do aluno exclusivamente com base nos trechos de decisões de tribunais fornecidos abaixo. Cite as decisões pelo identificador (ex.: [TCE-SP Acórdão 1234/2024]). Se os trechos não forem suficientes, diga isso com clareza e sugira ajustar os filtros.`;

  const blocks = enriched
    .map((e, idx) => {
      const p = payload[idx];
      const id = `${p.tribunalCode} ${p.decisionType} ${p.decisionNumber}`;
      const dateStr = p.dataJulgamento
        ? new Date(p.dataJulgamento).toLocaleDateString('pt-BR')
        : 'data não informada';
      const ementa = resolveEmenta(e);
      const summary =
        e.source.kind === 'tribunal-decision'
          ? e.source.data.summary
          : e.source.data.summary;
      const themes =
        e.source.kind === 'tribunal-decision'
          ? e.source.data.themes
          : e.source.data.themes;
      const leiArticles =
        e.source.kind === 'tribunal-decision'
          ? e.source.data.leiArticles
          : e.source.data.leiArticles;
      const similarityPct = (e.similarity * 100).toFixed(0);
      return `[${idx + 1}] ${id} — ${dateStr}
Título: ${p.title}
Órgão: ${p.orgaoJulgador || 'n/d'} | Relator: ${p.relator || 'n/d'}
Temas: ${themes || 'n/d'} | Artigos Lei 14.133: ${leiArticles || 'n/d'}
Ementa: ${truncate(ementa, MAX_EMENTA_CHARS)}
Trecho relevante (similaridade ${similarityPct}%): ${truncate(e.chunkContent, MAX_CHUNK_CHARS)}
Resumo IA: ${truncate(summary, MAX_SUMMARY_CHARS)}`;
    })
    .join('\n\n---\n\n');

  return `${header}

PERGUNTA DO ALUNO:
${question}

DECISÕES CONSULTADAS:
${blocks}

Sua resposta (em português, estruturada, com citações no formato [Tribunal Tipo Número]):`;
}

function countBySourceType(payload: JurisprudenciaSource[]) {
  const counts: Record<string, number> = {};
  for (const p of payload) {
    counts[p.sourceType] = (counts[p.sourceType] ?? 0) + 1;
  }
  return counts;
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
      const searchOptions = mapFiltersToSemanticOptions(jurisFilters);
      const searchResponse = await semanticSearch(query, {
        ...searchOptions,
        limit,
      });

      if (searchResponse.results.length === 0) {
        const totalInDatabase = await countUnifiedApproved();
        const msg =
          totalInDatabase === 0
            ? 'A base de jurisprudência deste ambiente ainda não foi populada. Fale com o administrador para rodar a ingestão de decisões.'
            : 'Não encontrei decisões que casassem semanticamente com essa pergunta. Tente reformular em outros termos ou usar os filtros para restringir manualmente a pesquisa.';
        return NextResponse.json({
          answer: msg,
          sources: [],
          consulted: 0,
          totalInDatabase,
        });
      }

      const enriched = await enrichSources(searchResponse.results);
      if (enriched.length === 0) {
        apiLogger.warn(
          { userId: user.userId, resultCount: searchResponse.results.length },
          'jurisprudencia/query all results were orphaned chunks'
        );
        return NextResponse.json({
          answer:
            'Os trechos relevantes encontrados apontam para documentos que não estão mais disponíveis. Tente reformular a pergunta.',
          sources: [],
          consulted: 0,
          totalInDatabase: await countUnifiedApproved(),
        });
      }

      const sourcesPayload = adaptToSourcesPayload(enriched);

      const prompt = buildPrompt(query, enriched, sourcesPayload);

      const avgSimilarity =
        enriched.reduce((sum, e) => sum + e.similarity, 0) / enriched.length;
      const byType = countBySourceType(sourcesPayload);

      let answerText: string;
      let cached = false;

      try {
        const result = await queryGeminiText(prompt, {
          temperature: 0.3,
          maxOutputTokens: 8192,
          thinkingBudget: 0,
          useCache: true,
          systemInstruction:
            'Você é um assistente jurídico técnico e conciso. Fundamente tudo nas decisões citadas; nunca invente números de acórdão ou relatores.',
        });

        if (!result.response || result.response.trim().length === 0) {
          throw new Error('empty-response');
        }

        answerText = result.response;
        cached = result.cached;

        apiLogger.info(
          {
            userId: user.userId,
            consulted: enriched.length,
            byType,
            avgSimilarity,
            cached,
            latencyMs: result.latency,
          },
          'jurisprudencia/query answered'
        );
      } catch (err) {
        apiLogger.error(
          { userId: user.userId, consulted: enriched.length, err },
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
          consulted: enriched.length,
          cached: false,
          debug,
        });
      }

      return NextResponse.json({
        answer: answerText,
        sources: sourcesPayload,
        consulted: enriched.length,
        cached,
      });
    } catch (error) {
      return handleApiError(error);
    }
  }
);
