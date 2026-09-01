import { NextResponse } from 'next/server';
import { withUserApi } from '@/lib/api/handler';
import { ApiError } from '@/lib/errors/api-error';
import { semanticSearch } from '@/lib/embeddings/vector-search';
import {
  mapFiltersToSemanticOptions,
  enrichSources,
  adaptToSourcesPayload,
  resolveEmenta,
  resolveFullText,
  type EnrichedSource,
  type JurisprudenciaSource,
} from '@/lib/jurisprudencia/semantic-adapter';
import { countUnifiedApproved } from '@/lib/jurisprudencia/unified-query';
import type { JurisprudenciaFilters } from '@/lib/jurisprudencia/unified-query';
import { queryGeminiText } from '@/lib/gemini/cached-client';
import { enforceRateLimit } from '@/lib/cache/rate-limit-helper';
import { enforceAiQuota } from '@/lib/cache/ai-quota';
import { apiLogger } from '@/lib/logger';
import { prisma } from '@/lib/prisma';
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
  'TST',
] as const;

const DECISION_TYPES = [
  'acordao',
  'decisao',
  'parecer_previo',
  'sumula',
  'orientacao_jurisprudencial',
  'precedente_normativo',
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
const MAX_FULLTEXT_CHARS_PER_SOURCE = 4000;
const MAX_TOTAL_CONTEXT_CHARS = 18000;
const FULLTEXT_MIN_LENGTH = 500;
const FULLTEXT_WINDOW = 1500;
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

/**
 * Extrai uma janela de contexto de ±FULLTEXT_WINDOW chars ao redor do
 * chunkContent dentro do fullText. Se não encontrar o chunk (ex.: chunk
 * normalizado vs fullText cru), fallback para primeiros MAX_FULLTEXT_CHARS
 * do fullText.
 */
function extractContextWindow(fullText: string, chunkContent: string): string {
  if (fullText.length <= MAX_FULLTEXT_CHARS_PER_SOURCE) {
    return fullText;
  }
  const anchor = chunkContent.slice(0, Math.min(120, chunkContent.length)).trim();
  const idx = anchor.length > 30 ? fullText.indexOf(anchor) : -1;
  if (idx === -1) {
    return fullText.slice(0, MAX_FULLTEXT_CHARS_PER_SOURCE) + '...';
  }
  const start = Math.max(0, idx - FULLTEXT_WINDOW);
  const end = Math.min(fullText.length, idx + chunkContent.length + FULLTEXT_WINDOW);
  let window = fullText.slice(start, end);
  if (start > 0) window = '...' + window;
  if (end < fullText.length) window = window + '...';
  return window;
}

interface PerSourceTelemetry {
  sourceId: string;
  kind: string;
  charsUsed: number;
  hasFullText: boolean;
  skipped: boolean;
}

interface ContextTelemetry {
  sources: number;
  fullTextCount: number;
  ementaOnlyCount: number;
  skippedCount: number;
  totalChars: number;
  perSource: PerSourceTelemetry[];
}

function buildPrompt(
  question: string,
  enriched: EnrichedSource[],
  payload: JurisprudenciaSource[]
): { prompt: string; telemetry: ContextTelemetry } {
  const header = `Você é um assistente jurídico especializado em licitações, contratos públicos e Lei 14.133/2021. Responda à pergunta do aluno exclusivamente com base nos trechos de decisões de tribunais fornecidos abaixo. Use o trecho do inteiro teor quando disponível; só recorra à ementa quando o trecho não cobrir a pergunta. Cite as decisões pelo identificador (ex.: [TCE-SP Acórdão 1234/2024]). Se os trechos não forem suficientes, diga isso com clareza e sugira ajustar os filtros.`;

  const ordered = enriched
    .map((e, idx) => ({ e, idx, p: payload[idx] }))
    .sort((a, b) => b.e.similarity - a.e.similarity);

  let totalChars = 0;
  const perSource: PerSourceTelemetry[] = [];
  const blocks: { idx: number; content: string }[] = [];

  for (const { e, idx, p } of ordered) {
    const id = `${p.tribunalCode} ${p.decisionType} ${p.decisionNumber}`;
    const dateStr = p.dataJulgamento
      ? new Date(p.dataJulgamento).toLocaleDateString('pt-BR')
      : 'data não informada';
    const ementa = resolveEmenta(e);
    const fullText = resolveFullText(e);
    const summary = e.source.data.summary;
    const themes = e.source.data.themes;
    const leiArticles = e.source.data.leiArticlesArr;
    const similarityPct = (e.similarity * 100).toFixed(0);

    let trechoLabel: string;
    let trechoContent: string;
    const hasFullText = !!fullText && fullText.length >= FULLTEXT_MIN_LENGTH;

    if (hasFullText && fullText) {
      trechoLabel = `Trecho do inteiro teor (similaridade ${similarityPct}%)`;
      trechoContent = extractContextWindow(fullText, e.chunkContent);
    } else {
      trechoLabel = `Trecho relevante (similaridade ${similarityPct}%)`;
      trechoContent = truncate(e.chunkContent, MAX_CHUNK_CHARS);
    }

    const block = `[${idx + 1}] ${id} — ${dateStr}
Título: ${p.title}
Órgão: ${p.orgaoJulgador || 'n/d'} | Relator: ${p.relator || 'n/d'}
Temas: ${themes || 'n/d'} | Artigos Lei 14.133: ${leiArticles.length > 0 ? leiArticles.join(', ') : 'n/d'}
Ementa: ${truncate(ementa, MAX_EMENTA_CHARS)}
${trechoLabel}: ${trechoContent}
Resumo IA: ${truncate(summary, MAX_SUMMARY_CHARS)}`;

    if (totalChars + block.length > MAX_TOTAL_CONTEXT_CHARS) {
      perSource.push({
        sourceId: e.documentId,
        kind: e.source.kind,
        charsUsed: 0,
        hasFullText,
        skipped: true,
      });
      continue;
    }

    blocks.push({ idx, content: block });
    totalChars += block.length;
    perSource.push({
      sourceId: e.documentId,
      kind: e.source.kind,
      charsUsed: block.length,
      hasFullText,
      skipped: false,
    });
  }

  blocks.sort((a, b) => a.idx - b.idx);
  const blocksStr = blocks.map(b => b.content).join('\n\n---\n\n');

  const prompt = `${header}

PERGUNTA DO ALUNO:
${question}

DECISÕES CONSULTADAS:
${blocksStr}

Sua resposta (em português, estruturada, com citações no formato [Tribunal Tipo Número]):`;

  const telemetry: ContextTelemetry = {
    sources: enriched.length,
    fullTextCount: perSource.filter(s => s.hasFullText && !s.skipped).length,
    ementaOnlyCount: perSource.filter(s => !s.hasFullText && !s.skipped).length,
    skippedCount: perSource.filter(s => s.skipped).length,
    totalChars,
    perSource,
  };

  return { prompt, telemetry };
}

function countBySourceType(payload: JurisprudenciaSource[]) {
  const counts: Record<string, number> = {};
  for (const p of payload) {
    counts[p.sourceType] = (counts[p.sourceType] ?? 0) + 1;
  }
  return counts;
}

/**
 * Persiste uma entrada no SearchHistory para analytics e feedback loop.
 * Server-side (diferente do /api/documents/query que persiste client-side)
 * porque o front de jurisprudência ainda não tinha esse wire-up. Salva
 * sempre — mesmo em queries que não acharam resultado — porque "o que
 * o aluno pergunta e não recebe resposta" é exatamente o sinal mais
 * valioso pra melhorar retrieval.
 */
async function persistJurisprudenciaSearch(params: {
  userId: string;
  query: string;
  filters: unknown;
  aiAnswer: string | null;
  sources: JurisprudenciaSource[] | null;
}): Promise<string | null> {
  try {
    const entry = await prisma.searchHistory.create({
      data: {
        userId: params.userId,
        type: 'jurisprudencia',
        query: params.query.trim(),
        filters: params.filters ? JSON.stringify(params.filters) : null,
        aiAnswer: params.aiAnswer,
        sources: params.sources ? JSON.stringify(params.sources) : null,
      },
      select: { id: true },
    });
    return entry.id;
  } catch (err) {
    apiLogger.error(
      { err, userId: params.userId },
      'Falha ao persistir jurisprudencia/query no SearchHistory',
    );
    return null;
  }
}

export const POST = withUserApi(async (request, ctx) => {
      const user = ctx.user;

      const json = await request.json();
      const parsed = bodySchema.safeParse(json);
      if (!parsed.success) {
        throw new ApiError(
          422,
          'Validação falhou',
          'VALIDATION_ERROR',
          { issues: parsed.error.flatten() },
        );
      }

      if (!process.env.GEMINI_API_KEY) {
        throw new ApiError(
          503,
          'Serviço de IA não está configurado neste ambiente. A pesquisa com IA requer a variável GEMINI_API_KEY — peça ao administrador para provisioná-la.',
          'SERVICE_UNAVAILABLE',
        );
      }

      // Anti-burst 10/min (antes desprotegido) + quota anti-abuso por tier.
      // Admin faz bypass. A decisão de quota é consumida na síntese abaixo.
      if (user.role !== 'admin') {
        await enforceRateLimit(
          `juris-query:${user.userId}`,
          10,
          60,
          { failureMode: 'closed' },
        );
      }
      const quotaDecision = await enforceAiQuota(user.userId, user.role);

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
        const searchHistoryId = await persistJurisprudenciaSearch({
          userId: user.userId,
          query,
          filters,
          aiAnswer: null,
          sources: null,
        });
        return NextResponse.json({
          answer: msg,
          sources: [],
          consulted: 0,
          totalInDatabase,
          searchHistoryId,
        });
      }

      const enriched = await enrichSources(searchResponse.results);
      if (enriched.length === 0) {
        apiLogger.warn(
          { userId: user.userId, resultCount: searchResponse.results.length },
          'jurisprudencia/query all results were orphaned chunks'
        );
        const searchHistoryId = await persistJurisprudenciaSearch({
          userId: user.userId,
          query,
          filters,
          aiAnswer: null,
          sources: null,
        });
        return NextResponse.json({
          answer:
            'Os trechos relevantes encontrados apontam para documentos que não estão mais disponíveis. Tente reformular a pergunta.',
          sources: [],
          consulted: 0,
          totalInDatabase: await countUnifiedApproved(),
          searchHistoryId,
        });
      }

      const sourcesPayload = adaptToSourcesPayload(enriched);

      const { prompt, telemetry } = buildPrompt(query, enriched, sourcesPayload);

      apiLogger.info(
        {
          event: 'jurisprudencia.context_built',
          userId: user.userId,
          sources: telemetry.sources,
          fullTextCount: telemetry.fullTextCount,
          ementaOnlyCount: telemetry.ementaOnlyCount,
          skippedCount: telemetry.skippedCount,
          totalChars: telemetry.totalChars,
          perSource: telemetry.perSource,
        },
        'jurisprudencia/query context assembled'
      );

      const avgSimilarity =
        enriched.reduce((sum, e) => sum + e.similarity, 0) / enriched.length;
      const byType = countBySourceType(sourcesPayload);

      let answerText: string;
      let cached = false;

      // Kill-switch global de custo: não sintetiza (economiza LLM), mas ainda
      // entrega as decisões relevantes encontradas.
      if (quotaDecision.action === 'degrade-search') {
        const searchHistoryId = await persistJurisprudenciaSearch({
          userId: user.userId,
          query,
          filters,
          aiAnswer: null,
          sources: sourcesPayload,
        });
        return NextResponse.json({
          answer:
            'Assistente IA em alta demanda no momento — não gerei uma síntese agora. As decisões relevantes estão listadas abaixo; consulte-as diretamente ou tente novamente em alguns minutos.',
          sources: sourcesPayload,
          consulted: enriched.length,
          cached: false,
          searchHistoryId,
        });
      }

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

        // Debug info (erro + stack) exposta apenas a admins — não vaza internals a alunos.
        // Quando `undefined`, o campo é omitido do JSON de resposta.
        const debug =
          user.role === 'admin' ? { geminiError: errMsg, stack: errStack } : undefined;
        const searchHistoryId = await persistJurisprudenciaSearch({
          userId: user.userId,
          query,
          filters,
          aiAnswer: null,
          sources: sourcesPayload,
        });
        return NextResponse.json({
          answer: answerText,
          sources: sourcesPayload,
          consulted: enriched.length,
          cached: false,
          debug,
          searchHistoryId,
        });
      }

      const searchHistoryId = await persistJurisprudenciaSearch({
        userId: user.userId,
        query,
        filters,
        aiAnswer: answerText,
        sources: sourcesPayload,
      });
      return NextResponse.json({
        answer: answerText,
        sources: sourcesPayload,
        consulted: enriched.length,
        cached,
        searchHistoryId,
      });
});
