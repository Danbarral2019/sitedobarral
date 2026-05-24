import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';
export const maxDuration = 60;

import { verifyAuth } from '@/lib/auth';
import { buildContextForLLM } from '@/lib/embeddings/vector-search';
import type { SearchResult } from '@/lib/embeddings/vector-search';
import { hybridSearch } from '@/lib/embeddings/hybrid-search';
import {
  validateQuotedCitations,
  buildCitationWarning,
} from '@/lib/embeddings/citation-validator';

import { queryGeminiText } from '@/lib/gemini/cached-client';
import { PRIMARY_GEMINI_MODEL, FALLBACK_GEMINI_MODELS } from '@/lib/gemini/config';
import { generateStream, LEGAL_SAFETY_SETTINGS } from '@/lib/ai';
import { checkRateLimit, withCache, CACHE_TTL } from '@/lib/cache/redis-client';
import { parseLeiArticles, getLeiArticles } from '@/lib/lei-articles';
import { trackServerEvent } from '@/lib/monitoring/events';
import { apiLogger } from '@/lib/logger';
import {
  extractCitedArticles,
  selectRelevantArticles,
  buildLeiContext,
  findRelatedActs,
  buildLayeredContext,
  formatActsContext,
  buildLegalSources,
  type LegalSource,
} from '@/lib/legal-context';

// ===========================
// Types
// ===========================

type QueryScope = 'all' | 'tst-only' | 'no-tst';

interface QueryFilters {
  courseId?: string;
  category?: string;
  dateFrom?: string;
  dateTo?: string;
  tags?: string[];
  isPublic?: boolean;
  ticMode?: boolean;
  /**
   * Escopo da pesquisa controlado pelo aluno via chips no ChatInterface:
   * - 'all' (default): comportamento padrão, detector strong-labor decide o boost TST
   * - 'tst-only': apenas TribunalDecision com tribunalCode=TST (skipDocument + skipLegAct + skipFts)
   * - 'no-tst': sem ramo TST (Document + LegislativeAct apenas), sem boost
   */
  scope?: QueryScope;
}

interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface QueryRequest {
  query: string;
  filters?: QueryFilters;
  maxResults?: number;
  includeContent?: boolean;
  useCache?: boolean;
  conversationHistory?: ConversationMessage[];
  stream?: boolean;
}

interface DocumentResult {
  documentId: string;
  title: string;
  category: string;
  geminiResponse: string;
  relevance: number;
  excerpt: string;
  url?: string;
  uploadedAt: string;
  tags?: string[];
  courseIds?: string[];
}

interface QueryResponse {
  success: boolean;
  results: DocumentResult[];
  totalDocuments: number;
  cached: boolean;
  latency: number;
  query: string;
  error?: string;
  synthesizedAnswer?: string;
  legalSources?: LegalSource[];
}

// ===========================
// Main Handler
// ===========================

export async function POST(req: NextRequest) {
  const startTime = Date.now();

  try {
    // 1. Verify authentication
    const authResult = await verifyAuth(req);

    if (!authResult.valid || !authResult.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const userId = authResult.user.userId;

    // 2. Rate limiting (10 queries per minute for non-admins)
    if (authResult.user.role !== 'admin') {
      const rateLimitKey = `query-rate-limit:${userId}`;
      const rateLimitResult = await checkRateLimit(rateLimitKey, 10, 60);

      if (!rateLimitResult.allowed) {
        return NextResponse.json(
          {
            success: false,
            error: 'Rate limit exceeded. Maximum 10 queries per minute.'
          },
          { status: 429 }
        );
      }
    }

    // 3. Parse request body
    const body: QueryRequest = await req.json();
    const {
      query,
      filters = {},
      maxResults = 5,
      useCache = true,
      conversationHistory,
      stream: wantStream = false,
    } = body;

    // 4. Validate query
    if (!query || query.trim().length < 3) {
      return NextResponse.json(
        {
          success: false,
          error: 'Query must be at least 3 characters long'
        },
        { status: 400 }
      );
    }

    if (maxResults < 1 || maxResults > 40) {
      return NextResponse.json(
        {
          success: false,
          error: 'maxResults must be between 1 and 40'
        },
        { status: 400 }
      );
    }

    // 4b. Enrich query with conversation context for better semantic retrieval
    let semanticQuery = query;
    if (conversationHistory && conversationHistory.length > 0) {
      const previousUserQueries = conversationHistory
        .filter(m => m.role === 'user')
        .map(m => m.content);
      if (previousUserQueries.length > 0) {
        // Combine the original topic with the refinement query
        // e.g. "diálogo competitivo" + "algum acórdão do TCU sobre esse assunto"
        semanticQuery = `${previousUserQueries[previousUserQueries.length - 1]} ${query}`;
      }
    }

    // 4c. TIC mode: enrich query with TIC context
    if (filters.ticMode) {
      semanticQuery = `No âmbito de contratações de TIC (Tecnologia da Informação e Comunicação) pela Administração Pública Federal, conforme INs e Portarias da SGD/MGI: ${semanticQuery}`;
    }

    apiLogger.info({ userId, query, filters }, 'Document query started');
    if (semanticQuery !== query) {
      apiLogger.debug({ semanticQuery }, 'Query enhanced with context');
    }
    if (filters.ticMode) {
      apiLogger.info('TIC mode enabled');
    }

    // 5. Query expansion: generate alternative queries for better recall
    let expandedQueries: string[] = [semanticQuery];
    try {
      const expansionCacheKey = `query-expansion:${hashQueryStr(semanticQuery)}`;
      const expanded = await withCache(
        expansionCacheKey,
        async () => {
          const expansionPrompt = `Você é um especialista em Direito Administrativo e Licitações (Lei 14.133/2021).
Gere 2 variações da pergunta abaixo usando sinônimos jurídicos e termos técnicos alternativos.
Responda APENAS com um JSON array de strings, sem texto adicional.

Pergunta: "${semanticQuery}"

Exemplo de resposta: ["variação 1", "variação 2"]`;

          const result = await queryGeminiText(expansionPrompt, {
            temperature: 0.5,
            maxOutputTokens: 256,
            thinkingBudget: 0,
            useCache: false,
          });

          let parsed: string[] = [];
          try {
            let text = result.response.trim();
            if (text.includes('```json')) text = text.split('```json')[1].split('```')[0].trim();
            else if (text.includes('```')) text = text.split('```')[1].split('```')[0].trim();
            parsed = JSON.parse(text);
          } catch { /* ignore parse errors */ }

          return Array.isArray(parsed) ? parsed.slice(0, 2) : [];
        },
        CACHE_TTL.GEMINI_QUERY
      );
      if (expanded.length > 0) {
        expandedQueries = [semanticQuery, ...expanded];
        apiLogger.debug({ queryCount: expandedQueries.length }, 'Query expansion completed');
      }
    } catch (err) {
      apiLogger.warn({ error: err instanceof Error ? err.message : String(err) }, 'Query expansion failed');
    }

    // 5a. Detecta se a pergunta envolve jurisprudência de TCEs ou TST (Súmulas,
    // OJs, PNs). Usamos regex com RADICAIS em vez de `string.includes(kw)` —
    // a versão antiga só ativava com palavras-chave literais e perdia
    // variações comuns ("terceirizar" não casava "terceirização", "tomador"
    // sozinho não casava "tomador de serviço"). Auditoria via simulação RAG
    // em 2026-05-24 mostrou que 5 de 7 perguntas trabalhistas não ativavam.
    //
    // Regex em ordem temática para legibilidade. Use \b nas extremidades e
    // alternativas explícitas onde o radical pode ambiguar com outras palavras.
    const tribunalPatterns: RegExp[] = [
      // ── Tribunais de Contas Estaduais ──
      /\btce\b/i,
      /\btribuna(?:l|is)\s+de\s+contas\s+estadua(?:l|is)\b/i,
      /\btce-(?:sp|mg|pr|sc|rj|rs|pe)\b/i,
      /\btribunal\s+estadual\b/i,
      /\bdecis(?:ão|ões)\s+estadua(?:l|is)\b/i,
      /\bjurisprud[êe]ncia\s+estadual\b/i,
      /\bcorte\s+de\s+contas\s+estadual\b/i,

      // ── TST / Justiça do Trabalho — termos-chave de instituição ──
      /\btst\b/i,
      /\btribunal\s+superior\s+do\s+trabalho\b/i,
      /\bjustiça\s+do\s+trabalho\b/i,
      /\bjurisprud[êe]ncia\s+trabalhista\b/i,
      /\bclt\b/i,
      /\bconsolida[çc][ãa]o\s+das\s+leis\s+do\s+trabalho\b/i,
      /\breforma\s+trabalhista\b/i,
      /\blei\s+13\.?467(?:\/2017)?\b/i,

      // ── Temas trabalhistas (radicais) ──
      /\bterceiriz/i,                    // terceirizar, terceirização, terceirizado
      /\btomador\b/i,                    // tomador de serviço (e variações)
      /\bempresa\s+interposta\b/i,
      /\bv[íi]nculo(?:\s+(?:de\s+emprego|empregat[íi]cio))?\b/i,
      /\bsubsidi[áa]ri/i,                // responsabilidade subsidiária
      /\bsolidari[ea]/i,                 // responsabilidade solidária
      /\baviso[\s-]+pr[ée]vio\b/i,
      /\bequipara[çc][ãa]o\s+salarial\b/i,
      /\bpericulosidade\b/i,
      /\binsalubridade\b/i,
      /\badicional\s+(?:de\s+)?(?:periculosidade|insalubridade|noturno)\b/i,
      /\bhoras?\s+extras?\b/i,
      /\bintervalo\s+intrajornada\b/i,
      /\bjornada\s+de\s+trabalho\b/i,
      /\brepactua[çc][ãa]o\b/i,
      /\bplanilha\s+de\s+custos\b/i,
      /\bverbas?\s+trabalhista/i,
      /\bf[ée]rias\s+(?:proporcionais|vencidas|indenizadas)\b/i,
      /\bestabilidade\s+(?:provis[óo]ria|de\s+emprego|gestante|cipeiro|acidentado)\b/i,
      /\b13[ºo]?\s+sal[áa]rio\b/i,
      /\bgratifica[çc][ãa]o\s+natalina\b/i,
      /\bfgts\b/i,

      // ── Rodada 2 (expansão pós-validação 2026-05-24, Q2 falhou) ──
      // Estas perguntas trabalhistas não usavam termos-gatilho institucionais
      // (TST/CLT) nem temas específicos da lista anterior. Adicionamos
      // radicais conservadores que só casam contextos inequivocamente
      // trabalhistas — evitando falsos positivos em queries Lei 14.133/AGU.

      // Relações do contrato de trabalho
      /\bempregad(?:o|or|a|ora)\b/i,              // empregado/empregador
      /\bempregat[íi]cio\b/i,
      /\bcontrato\s+de\s+trabalho\b/i,
      /\brela[çc][ãa]o\s+de\s+emprego\b/i,
      /\bcarteira\s+(?:de\s+trabalho|profissional|assinada)\b/i,
      /\bctps\b/i,                                // CTPS (Carteira de Trabalho)

      // Salário / remuneração / descontos
      /\bdesconto(?:s)?\s+(?:no|do|em)\s+sal[áa]rio\b/i,
      /\bdano(?:s)?\s+causad[oa]s?\s+(?:pelo\s+)?empregad/i,
      /\bsal[áa]ri[oa](?:l|s)?\b(?=.*(?:trabalh|empregad|patron|sindical|categoria|m[íi]nimo|piso))/i,
      /\bremunera[çc][ãa]o\s+(?:do\s+empregado|do\s+trabalhador)\b/i,
      /\bpiso\s+salarial\b/i,
      /\bsal[áa]rio\s+m[íi]nimo\b/i,
      /\bsal[áa]rio[\s-]+(?:fam[íi]lia|maternidade)\b/i,

      // Rescisão e demissão
      /\brescis[ãa]o(?:\s+(?:contratual|indireta|do\s+contrato))?\b/i,
      /\bjusta\s+causa\b/i,
      /\bdemiss[ãa]o\b/i,
      /\bdispensa\s+(?:imotivada|sem\s+justa\s+causa|por\s+justa\s+causa|discrimin)/i,
      /\bjusti[çc]a\s+do\s+trabalho\b/i,
      /\breclama[çc][ãa]o\s+trabalhista\b/i,
      /\binqu[ée]rito\s+judicial\b/i,

      // Saúde, segurança e benefícios
      /\bacidente\s+(?:de\s+|do\s+)?trabalho\b/i,
      /\bdoen[çc]a\s+(?:ocupacional|profissional|do\s+trabalho)\b/i,
      /\baux[íi]lio[\s-]+doen[çc]a\b/i,
      /\baposentadoria\s+por\s+invalidez\b/i,
      /\bvale[\s-]?(?:transporte|refei[çc][ãa]o|alimenta[çc][ãa]o)\b/i,
      /\bsobreaviso\b/i,
      /\bbanco\s+de\s+horas\b/i,
      /\bcompensa[çc][ãa]o\s+de\s+jornada\b/i,
      /\bperiodo\s+noturno\b/i,

      // Categorias e organização sindical
      /\bsindicato\b/i,
      /\bsindical\b/i,
      /\bcategoria\s+profissional\b/i,
      /\bbanc[áa]ri[ao]s?\b/i,
      /\bferrovi[áa]ri[ao]s?\b/i,
      /\bmotorista(?:s)?\s+(?:profissional|de\s+caminh|de\s+carga)/i,

      // ── OJs do TST (Orientações Jurisprudenciais) ──
      /\borienta[çc](?:[ãa]o|[õo]es)\s+jurisprudencia(?:l|is)\b/i,
      /\boj[-\s]?sbdi[-\s]?[i12]+t?\b/i,  // OJ-SBDI-I, OJ-SBDI-II, OJ-SBDI-1T
      /\boj[-\s]?sdc\b/i,
      /\bsbdi[-\s]?[i12]+\b/i,            // SBDI-I, SBDI-II
      /\bsubse[çc][ãa]o\b/i,
      /\btribunal\s+pleno\b/i,
      /\b[óo]rg[ãa]o\s+especial\b/i,

      // ── Precedentes Normativos (PN) — SDC ──
      /\bprecedente(?:s)?\s+normativo(?:s)?\b/i,
      /\bdiss[íi]dio(?:s)?\s+coletivo(?:s)?\b/i,
      /\bnegocia[çc][ãa]o\s+coletiva\b/i,
      /\bcl[áa]usula\s+normativa\b/i,
      /\bconven[çc][ãa]o\s+coletiva\b/i,
      /\bacordo\s+coletivo\b/i,
    ];
    const queryLowerForTribunal = query.toLowerCase();
    const tribunalMatchCount = tribunalPatterns.reduce(
      (n, re) => (re.test(query) ? n + 1 : n),
      0,
    );
    const includeTribunalDecisions = tribunalMatchCount > 0;

    if (includeTribunalDecisions) {
      apiLogger.info({ tribunalMatchCount }, 'Tribunal decisions included (matched tribunalPatterns)');
    }

    // Strong-labor: ativa boost de similarity no ramo TST (factor 1.20).
    // Critério é satisfeito quando QUALQUER um destes ocorre:
    //   (a) match em um padrão institucional forte (TST/CLT/Justiça do Trabalho/
    //       Reforma Trabalhista/Reclamação Trabalhista) — esses sinais por si só
    //       fixam o domínio sem ambiguidade;
    //   (b) match em um padrão "tier-2 forte" (ex.: rescisão indireta, justa
    //       causa, FGTS, intervalo intrajornada, dissídio coletivo, verbas
    //       trabalhistas) — termos cuja presença isolada não tem leitura em
    //       Lei 14.133/AGU;
    //   (c) match em 2+ padrões temáticos quaisquer da lista geral — quando
    //       vários elementos trabalhistas convivem na mesma query, a chance
    //       dela ser genuinamente trabalhista (e não Lei 14.133 tangenciando)
    //       sobe muito.
    //
    // Diagnóstico que motivou (2026-05-24, sessão anterior):
    // - Q3 "rescisão indireta por descumprimento de norma coletiva" — TST não
    //   entrou no top-10 mesmo com `includeTribunalDecisions=true`; competidores
    //   Lei 14.133 ganharam ranking por similaridade pura. "Rescisão indireta"
    //   isolado é tier-2 forte (não há rescisão indireta em Lei 14.133).
    // - Q9 (mista) — IA citou Súmula 331 "de cabeça" porque o documento canônico
    //   não passou no contexto formal.
    //
    // Calibração: factor 1.20 inverte derrotas por margem ≤ 18%, sem derrubar
    // documentos Lei/Decreto genuinamente mais relevantes. Acima de 1.30 começa
    // a haver over-boost (Súmula tangencial vence acórdão diretamente sobre o
    // tema). Conservador, controlado, e fácil de reverter via env futura.
    const strongInstitutionalLaborPatterns: RegExp[] = [
      /\btst\b/i,
      /\btribunal\s+superior\s+do\s+trabalho\b/i,
      /\bjustiça\s+do\s+trabalho\b/i,
      /\bclt\b/i,
      /\bconsolida[çc][ãa]o\s+das\s+leis\s+do\s+trabalho\b/i,
      /\breforma\s+trabalhista\b/i,
      /\bjurisprud[êe]ncia\s+trabalhista\b/i,
      /\breclama[çc][ãa]o\s+trabalhista\b/i,
    ];
    // Tier-2 forte: padrões cuja presença isolada já fixa domínio trabalhista
    // (não têm leitura em Lei 14.133/AGU/TCU). Ativam strong-labor sozinhos.
    // Mantemos enxuto e auditável — adicionar com critério, não automaticamente.
    const tier2StrongLaborPatterns: RegExp[] = [
      /\brescis[ãa]o\s+indireta\b/i,
      /\bjusta\s+causa\b/i,
      /\bdispensa\s+(?:imotivada|sem\s+justa\s+causa|por\s+justa\s+causa|discrimin)/i,
      /\baviso[\s-]+pr[ée]vio\b/i,
      /\bfgts\b/i,
      /\b13[ºo]?\s+sal[áa]rio\b/i,
      /\bgratifica[çc][ãa]o\s+natalina\b/i,
      /\bintervalo\s+intrajornada\b/i,
      /\bjornada\s+de\s+trabalho\b/i,
      /\bhoras?\s+extras?\b/i,
      /\badicional\s+(?:de\s+)?(?:periculosidade|insalubridade|noturno)\b/i,
      /\bpericulosidade\b/i,
      /\binsalubridade\b/i,
      /\bequipara[çc][ãa]o\s+salarial\b/i,
      /\bv[íi]nculo\s+(?:de\s+emprego|empregat[íi]cio)\b/i,
      /\bcarteira\s+(?:de\s+trabalho|profissional|assinada)\b/i,
      /\bctps\b/i,
      /\bdiss[íi]dio(?:s)?\s+coletivo(?:s)?\b/i,
      /\bnorma\s+coletiva\b/i,
      /\bconven[çc][ãa]o\s+coletiva\b/i,
      /\bacordo\s+coletivo\b/i,
      /\bnegocia[çc][ãa]o\s+coletiva\b/i,
      /\bcl[áa]usula\s+normativa\b/i,
      /\bprecedente(?:s)?\s+normativo(?:s)?\b/i,
      /\borienta[çc](?:[ãa]o|[õo]es)\s+jurisprudencia(?:l|is)\b/i,
      /\bestabilidade\s+(?:provis[óo]ria|gestante|cipeiro|acidentado)\b/i,
      /\bf[ée]rias\s+(?:proporcionais|vencidas|indenizadas)\b/i,
      /\bverbas?\s+trabalhista/i,
      /\bacidente\s+(?:de\s+|do\s+)?trabalho\b/i,
      /\bdoen[çc]a\s+(?:ocupacional|profissional|do\s+trabalho)\b/i,
      /\bsobreaviso\b/i,
      /\bbanco\s+de\s+horas\b/i,
      /\bempresa\s+interposta\b/i,
      /\bequipara[çc][ãa]o\s+salarial\b/i,
    ];
    const hasInstitutionalLaborSignal = strongInstitutionalLaborPatterns.some((re) => re.test(query));
    const hasTier2LaborSignal = tier2StrongLaborPatterns.some((re) => re.test(query));
    const isStronglyLabor =
      hasInstitutionalLaborSignal || hasTier2LaborSignal || tribunalMatchCount >= 2;
    const tribunalBoost = isStronglyLabor ? { code: 'TST', factor: 1.2 } : undefined;
    if (tribunalBoost) {
      apiLogger.info(
        {
          hasInstitutionalLaborSignal,
          hasTier2LaborSignal,
          tribunalMatchCount,
          factor: tribunalBoost.factor,
        },
        'Strong-labor query — aplicando boost de similarity no ramo TST',
      );
    }

    // Súmulas TST canceladas/revistas: por padrão ficam fora do contexto IA
    // (precedente superado induz erro). Aparecem só quando a pergunta
    // explicitamente indicar interesse histórico ou por súmula específica.
    const historicalKeywords = [
      'histórico', 'historico', 'cancelada', 'cancelado', 'cancelamento',
      'revista', 'revisão', 'revisao', 'revogada', 'revogado',
      'antes da reforma', 'reforma trabalhista', 'lei 13.467', '13.467/2017',
      'entendimento anterior', 'redação anterior', 'redacao anterior',
      'precedente revogado', 'antiga redação', 'antiga redacao',
    ];
    // Também ativa quando a pergunta cita o número de uma súmula específica
    // (ex.: "súmula 437", "OJ-SBDI-1 123", "PN 5"), pois nesse caso o usuário
    // sabe exatamente o que quer ver — não faz sentido esconder cancelados.
    const citesSpecificCanonical = /(?:s[uú]mula|enunciado|oj[\s-]*(?:sbdi|sdc|tp\/?oe)?|orienta[çc][ãa]o\s+jurisprudencial|precedente\s+normativo|pn)\s*(?:tst)?\s*(?:n[º°]?\s*)?\d+/i.test(query);
    const isHistoricalQuery =
      historicalKeywords.some(kw => queryLowerForTribunal.includes(kw)) || citesSpecificCanonical;
    const excludeInactiveSumulas = !isHistoricalQuery;
    if (isHistoricalQuery) {
      apiLogger.info('Query histórica detectada — incluindo documentos canônicos TST canceladas/revistas no contexto');
    }

    // 5a. Scope override: chips no chat permitem ao aluno forçar o foco.
    //   - 'tst-only'  → só TribunalDecision TST (skip Document + LegAct + FTS)
    //   - 'no-tst'    → sem ramo TST e sem boost (cobertura Document+LegAct)
    //   - 'all'/undef → comportamento padrão (detector + branches normais)
    // O scope sobrepõe o detector strong-labor: se aluno marca 'no-tst', boost
    // é descartado mesmo em query trabalhista. Se marca 'tst-only', forçamos
    // ramo TST mesmo que a query não tenha casado tribunalPatterns.
    const scope: QueryScope = filters.scope ?? 'all';
    const scopedOptions = (() => {
      if (scope === 'tst-only') {
        return {
          includeTribunalDecisions: true,
          excludeInactiveSumulas,
          tribunalBoost: undefined,
          skipDocumentBranch: true,
          skipLegislativeActBranch: true,
          tribunalCodeFilter: 'TST',
          skipFts: true,
        } as const;
      }
      if (scope === 'no-tst') {
        return {
          includeTribunalDecisions: false,
          excludeInactiveSumulas,
          tribunalBoost: undefined,
          skipDocumentBranch: undefined,
          skipLegislativeActBranch: undefined,
          tribunalCodeFilter: undefined,
          skipFts: false,
        } as const;
      }
      return {
        includeTribunalDecisions,
        excludeInactiveSumulas,
        tribunalBoost,
        skipDocumentBranch: undefined,
        skipLegislativeActBranch: undefined,
        tribunalCodeFilter: undefined,
        skipFts: false,
      } as const;
    })();
    if (scope !== 'all') {
      apiLogger.info({ scope }, 'Pesquisa com scope override (chip do chat)');
    }

    // 5b. Hybrid search: combina busca semântica (vetor) + FTS (BM25) via RRF.
    // Reranking desligado em 2026-04-23 após Fase 2 provar regressão de
    // −15pp a −25pp em recall@5 com Gemini e Cohere. Ver ROADMAP_BUSCA_QUALIDADE.md.
    const searchResponse = await hybridSearch({
      query: semanticQuery,
      expandedQueries: expandedQueries.length > 1 ? expandedQueries : undefined,
      courseId: filters.courseId || undefined,
      category: filters.category,
      excludeCategories: ['boa_pratica'],
      limit: Math.max(maxResults * 5, 60),
      alpha: 0.6,
      useCache,
      ...scopedOptions,
      rerank: false,
    });

    apiLogger.info({ resultCount: searchResponse.results.length }, 'Hybrid search completed');

    if (searchResponse.results.length === 0) {
      return NextResponse.json<QueryResponse>({
        success: true,
        results: [],
        totalDocuments: 0,
        cached: searchResponse.cached,
        latency: Date.now() - startTime,
        query,
      });
    }

    // 5b. Complementary search: find priority sources (enunciados, ONs, apostilas) by leiArticles
    // These may not appear in semantic search due to volume of acórdãos
    const semanticDocIds = new Set(searchResponse.results.map(r => r.documentId));
    const citedArticlesFromSemantic = extractCitedArticles(
      searchResponse.results as Array<SearchResult & { leiArticles?: string | null }>
    );

    let complementaryResults: SearchResult[] = [];
    if (citedArticlesFromSemantic.length > 0) {
      // Onda 4.5.5: leiArticlesArr usa GIN — match exato sem precisar do hack '"X"'
      const exactArticleMatches = citedArticlesFromSemantic.slice(0, 12).map(art => ({
        leiArticlesArr: { has: art },
      }));

      // Also search by description/content keywords from the query
      const queryKeywords = query.split(/\s+/).filter(w => w.length >= 4);
      const keywordMatches = queryKeywords.map(kw => ({
        description: { contains: kw, mode: 'insensitive' as const },
      }));

      const priorityDocs = await prisma.document.findMany({
        where: {
          category: { in: ['enunciados', 'orientacao-normativa', 'apostila', 'conteudo-programatico'] },
          id: { notIn: [...semanticDocIds] },
          OR: [...exactArticleMatches, ...keywordMatches],
        },
        select: {
          id: true,
          title: true,
          category: true,
          description: true,
          url: true,
          courseId: true,
          isCommon: true,
          tags: true,
          leiArticlesArr: true,
        },
        // No take limit — we fetch all candidates and rank by relevance scoring
      });

      // Rank complementary results: docs mentioning query keywords in description score higher
      const queryLower = query.toLowerCase();
      const scoredDocs = priorityDocs.map(doc => {
        let score = 0.50;
        const desc = (doc.description || '').toLowerCase();
        // Boost if description contains query keywords
        for (const kw of queryKeywords) {
          if (desc.includes(kw.toLowerCase())) score += 0.05;
        }
        // Boost if description contains full query phrase
        if (desc.includes(queryLower)) score += 0.10;
        // Boost enunciados/apostilas slightly over ONs
        if (['enunciados', 'apostila'].includes(doc.category)) score += 0.02;
        return { doc, score: Math.min(score, 0.70) };
      });

      // Sort by score descending, take top results (scaled with maxResults)
      scoredDocs.sort((a, b) => b.score - a.score);

      complementaryResults = scoredDocs.slice(0, Math.ceil(maxResults / 2)).map(({ doc, score }) => ({
        documentId: doc.id,
        documentTitle: doc.title,
        category: doc.category,
        similarity: score,
        chunkContent: doc.description || doc.title,
        chunkIndex: 0,
        url: doc.url || undefined,
        courseId: doc.courseId || undefined,
        isCommon: doc.isCommon,
        tags: doc.tags ? JSON.parse(doc.tags) : undefined,
        leiArticles:
          doc.leiArticlesArr.length > 0 ? JSON.stringify(doc.leiArticlesArr) : null,
        sourceType: 'document' as const,
      }));

      apiLogger.debug({ complementary: complementaryResults.length, candidates: priorityDocs.length }, 'Complementary sources found');
    }

    // 6. Separate results by type
    const allResults = [...searchResponse.results, ...complementaryResults];
    const leiResults = allResults.filter(r => r.category === 'lei-artigo');
    const actResults = allResults.filter(r => r.category === 'ato-normativo');
    // Semantic legislative acts from LegislativeActChunk (via UNION ALL)
    const semanticLegActResults = allResults.filter(r => r.sourceType === 'legislative-act');
    const rawDocResults = allResults.filter(
      r => !['lei-artigo', 'ato-normativo'].includes(r.category) && r.sourceType !== 'legislative-act'
    );

    // Diversify doc results with priority tiers (reranking já feito dentro do hybridSearch)
    const docResults = diversifyResults(rawDocResults, maxResults);

    // R3: cap por tipo subiu de 3 → 5. Cobre cenários com vários atos do mesmo
    // tipo regulamentando matéria (ex: 4-5 INs sobre serviços contínuos) sem
    // estourar o contexto. Bypass dinâmico em R1 quando o ato é regulamentador
    // direto (leiArticles ⊃ artigos da query).
    const PER_TYPE_CAP = 5;
    const legActsByType = new Map<string, typeof semanticLegActResults>();
    for (const act of semanticLegActResults) {
      const arr = legActsByType.get(act.category) || [];
      arr.push(act);
      legActsByType.set(act.category, arr);
    }
    const cappedLegActs: typeof semanticLegActResults = [];
    for (const [, acts] of legActsByType) {
      cappedLegActs.push(...acts.sort((a, b) => b.similarity - a.similarity).slice(0, PER_TYPE_CAP));
    }

    apiLogger.info({ lei: leiResults.length, actsDocs: actResults.length, actsSemantic: cappedLegActs.length, docs: docResults.length }, 'Results categorized');

    // 7. Enrich: extract cited articles from docs + semantic article selection (Fase 5B)
    const citedArticlesFromDocs = extractCitedArticles(
      docResults as Array<SearchResult & { leiArticles?: string | null }>
    );
    const citedArticles = await selectRelevantArticles(query, citedArticlesFromDocs, 10);
    const leiResultArticleNums = leiResults.map(r => {
      const match = r.documentTitle.match(/Art\.\s*(\d+[\w-]*)/);
      return match ? match[1] : '';
    }).filter(Boolean);

    const missingArticles = citedArticles.filter(
      n => !leiResultArticleNums.includes(n)
    );

    // Build lei context from semantic results + extra cited articles
    const semanticLeiContext = buildContextForLLM(leiResults, 2000);
    const extraLeiContext = buildLeiContext(missingArticles, 1500);
    const fullLeiContext = [semanticLeiContext, extraLeiContext].filter(Boolean).join('\n\n');

    // 8. Find related legislative acts not already in results
    const alreadyFoundActTitles = [
      ...actResults.map(r => r.documentTitle),
      ...cappedLegActs.map(r => r.documentTitle),
    ];
    const allCitedArticles = [...new Set([...citedArticles, ...leiResultArticleNums])];
    // R1: subimos o limite (3 → 8) e o budget de chars (1000 → 2000) — esses
    // atos são "regulamentadores diretos" (matched por leiArticles ⊇ artigos
    // citados) e merecem mais espaço que candidatos puramente semânticos.
    const extraActs = await findRelatedActs(allCitedArticles, alreadyFoundActTitles, 8);

    // Build acts context (includes Document-based acts + semantic LegislativeAct acts)
    const allActContextResults = [...actResults, ...cappedLegActs];
    const semanticActsContext = buildContextForLLM(allActContextResults, 2500);
    const extraActsFormatted = formatActsContext(extraActs, 2000);
    const fullActsContext = [semanticActsContext, extraActsFormatted].filter(Boolean).join('\n\n');

    // Build docs context (increased to fit more diverse results)
    const docsContext = buildContextForLLM(docResults, 10000);

    // 8b. TIC mode: enrich acts context with TIC-specific legislative acts
    let ticActsContext = '';
    if (filters.ticMode) {
      try {
        const ticActs = await prisma.legislativeAct.findMany({
          where: { themes: { contains: '"tic"' } },
          select: { fullNumber: true, ementa: true, officialUrl: true, leiArticlesArr: true },
          orderBy: { hierarchyLevel: 'asc' },
          take: 10,
        });
        if (ticActs.length > 0) {
          ticActsContext = '\nATOS NORMATIVOS DE TIC (SGD/MGI):\n' +
            ticActs.map(act => {
              const arts = getLeiArticles(act);
              const artsStr = arts.length > 0 ? ` (Art. ${arts.join(', ')})` : '';
              return `**${act.fullNumber}**${artsStr}\n${act.ementa}`;
            }).join('\n\n');
          apiLogger.debug({ ticActsCount: ticActs.length }, 'TIC context enriched');
        }
      } catch (err) {
        apiLogger.warn({ error: err instanceof Error ? err.message : String(err) }, 'TIC context enrichment failed');
      }
    }

    // 9. Build layered context (increased from 15000 to 20000 for richer answers)
    const combinedActsContext = ticActsContext
      ? `${fullActsContext}\n\n${ticActsContext}`
      : fullActsContext;
    const fullContext = buildLayeredContext(fullLeiContext, combinedActsContext, docsContext, 20000);

    // 10. Build conversation history context
    let historyContext = '';
    if (conversationHistory && conversationHistory.length > 0) {
      const recentHistory = conversationHistory.slice(-5);
      historyContext = '\nHISTÓRICO DA CONVERSA:\n' +
        recentHistory.map(m =>
          `${m.role === 'user' ? 'USUÁRIO' : 'ASSISTENTE'}: ${m.content.slice(0, 300)}`
        ).join('\n') + '\n';
    }

    // 11. Build legal sources and display results BEFORE prompt (needed for source listing)
    const allLeiArticleNums = [...new Set([...leiResultArticleNums, ...missingArticles])].slice(0, 15);
    const allActsForSources = [
      ...actResults.map(r => ({ title: r.documentTitle, url: r.url || '' })),
      ...cappedLegActs.map(r => ({ title: r.documentTitle, url: r.url || '' })),
      ...extraActs.map(a => ({ title: a.title, url: a.url })),
    ];
    const legalSources = buildLegalSources(allLeiArticleNums, allActsForSources);

    const allDisplayResults = docResults
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, maxResults);

    // 12. Synthesize answer with enhanced prompt
    const sourcesList = allDisplayResults.map(r => `- ${r.documentTitle} (${r.category})`).join('\n');
    const articlesList = allLeiArticleNums.map(n => `Art. ${n}`).join(', ');

    const systemInstruction = `Você é um assistente especializado em Licitações e Contratos Administrativos (Lei 14.133/2021).

INSTRUÇÕES:
1. Responda de forma completa e estruturada, usando TODAS as fontes relevantes do contexto acima
2. PRIORIDADE DE CITAÇÃO (siga esta ordem):
   a) Materiais do curso (apostilas, infográficos, materiais de apoio) — cite PRIMEIRO se disponíveis
   b) Enunciados de instituições (IBDA, INCP, etc.) e Orientações Normativas da AGU — SEMPRE cite quando pertinentes, são fontes de alto valor
   c) Artigos da Lei 14.133/2021 — cite CADA artigo relevante do contexto
   d) Atos normativos regulamentadores (INs, Decretos, Portarias) — SEMPRE cite quando aparecerem em "ATOS NORMATIVOS REGULAMENTADORES" do contexto. Quando o título traz prefixo [Lei]/[Decreto]/[Portaria]/[IN]/[Ordem], esse é o nível na hierarquia legal — priorize os de hierarquia mais alta. Não omita atos normativos que tratem da matéria perguntada.
   e) Acórdãos do TCU e Manual do TCU — cite com número/ano (ex: "Acórdão TCU 1234/2024 - Plenário")
   f) Informativos e Súmulas do TCU — cite com número (ex: "Informativo TCU nº 350", "Súmula TCU nº 247")
   g) Pareceres da AGU (DECOR, Pareceres Vinculantes)
3. Cite enunciados, pareceres, orientações normativas e manuais do contexto — NÃO omita nenhuma fonte relevante
4. Para enunciados, sempre indique o órgão emissor (ex: "Enunciado IBDA nº 7", "Enunciado INCP nº 12")
5. Diferencie fontes normativas VINCULANTES (lei, decreto, súmula vinculante) de fontes DOUTRINÁRIAS (apostilas, manuais) e JURISPRUDENCIAIS (acórdãos, informativos)
6. Use linguagem técnica jurídica com citações precisas (ex: "Conforme o Art. 23 da Lei 14.133...", "O Enunciado nº 7 do INCP dispõe...")
7. Seja completo mas organizado — use parágrafos distintos para cada aspecto
8. Se os documentos não contiverem informação suficiente, diga isso
9. CONSCIÊNCIA TEMPORAL E LEGISLATIVA:
   a) A Lei 14.133/2021 (Nova Lei de Licitações) SUBSTITUIU a Lei 8.666/1993
   b) SEMPRE priorize o entendimento atual sob a Lei 14.133/2021 — apresente-o PRIMEIRO
   c) Quando citar precedentes, acórdãos ou informativos baseados na Lei 8.666/1993, SEMPRE alerte: "⚠️ Precedente anterior à Lei 14.133/2021 — verificar aplicabilidade sob o novo regime"
   d) Se houver EVOLUÇÃO normativa entre a lei antiga e a nova, EXPLIQUE a mudança
   e) Ordene as fontes cronologicamente: mais recentes primeiro
   f) **Documentos canônicos do TST** (Súmulas, Orientações Jurisprudenciais — SBDI-I/I-T/II/SDC/Tribunal Pleno — e Precedentes Normativos da SDC):
      - **Quando aparecerem no contexto, CITE TODOS os relevantes para a pergunta.** Não escolha apenas o mais conhecido (ex.: se o contexto traz Precedente Normativo nº 37 + OJ-SBDI-I nº 322 + Súmula nº 190 sobre cláusulas normativas, cite os TRÊS — eles têm pesos jurídicos distintos: PN vincula no dissídio coletivo, OJ uniformiza, Súmula consolida).
      - **Hierarquia de fontes do TST a explicitar na resposta**:
        1. *Precedentes Normativos* (vinculantes em dissídios coletivos da SDC) — cite com "Precedente Normativo nº N do TST" e explique que vincula a SDC.
        2. *Súmulas* (consolidação oficial do entendimento da Corte) — cite com "Súmula nº N do TST".
        3. *OJs SBDI-I / SBDI-I Transitória / SBDI-II / SDC / TP-OE* (uniformização das subseções especializadas) — cite indicando a série exata.
      - **Situação canônica** (campo \`themes\` no contexto): se contiver \`situacao:CANCELADA\` ou \`situacao:REVISTA\`, **avise explicitamente** que aquele documento foi cancelado/revisto e só serve como referência histórica — não pode ser usado como precedente vigente. Para \`situacao:CRIADA\` ou \`situacao:ALTERADA\`, cite como jurisprudência consolidada vigente.
      - **Refira-se pelo rótulo doutrinário correto**: "Súmula nº N do TST", "OJ-SBDI-I nº N", "OJ-SBDI-II nº N", "OJ-SDC nº N", "OJ-SBDI-I Transitória nº N", "OJ-TP/OE nº N", "Precedente Normativo nº N". Esses rótulos aparecem no campo \`title\` do contexto começando com "TST ".
10. FIDELIDADE ABSOLUTA AO CONTEÚDO DAS FONTES (regra crítica — viola = resposta inválida):
    a) Para enunciados, pareceres e orientações normativas: indique o número/origem e explique o entendimento com suas PRÓPRIAS PALAVRAS, fielmente ao que a fonte literalmente dispõe no contexto fornecido.
    b) **PROIBIDO usar aspas duplas ("...") a menos que o trecho EXATO esteja literalmente presente no contexto fornecido acima.** Aspas implicam citação literal; conteúdo entre aspas que não aparece no contexto é HALUCINAÇÃO e quebra a confiança do aluno em prova/peça processual. Se você quer transmitir uma ideia da fonte mas não tem o trecho literal, parafraseie SEM aspas.
    c) NUNCA atribua a um enunciado, súmula, parecer ou acórdão um conteúdo que não esteja LITERALMENTE escrito no contexto. Se o título de uma fonte aparece mas o chunk recuperado é sobre OUTRO tópico (ex.: título "Enunciado IBDA 29" mas o chunk fala de credenciamento, e a pergunta é sobre ciclo de vida), **NÃO cite essa fonte** — ignore-a e cite apenas o que tiver cobertura real.
    d) EXEMPLO DO QUE NÃO FAZER (caso real registrado): pergunta "ciclo de vida do objeto" trouxe Enunciado IBDA 29 entre as fontes (que na verdade trata de credenciamento), e a resposta inventou "Enunciado IBDA nº 29: Reforça que o dever de eficiência impõe a adoção da solução mais vantajosa..., 'ainda que isso implique seleção de proposta com preço nominal superior'". O Enunciado 29 NUNCA disse isso. Esse tipo de erro NÃO PODE se repetir.
    e) Se o aluno precisar do texto completo, oriente-o a consultar a fonte listada
    f) Quando o sinal de COBERTURA BAIXA estiver presente no início do contexto, prefixe sua resposta com aviso: "⚠️ A base tem cobertura limitada para essa pergunta — confira diretamente nas fontes listadas." e use linguagem cautelosa (evite "estabelece", "determina", prefira "parece tratar de", "sugere").`;

    // Sinal de COBERTURA BAIXA: quando o melhor resultado tem similarity
    // sub-0.60, a base não tem material claramente sobre o tema. Avisamos
    // o LLM para usar linguagem cautelosa e evitar inventar conteúdo nas
    // fontes "raspadas" do top-K (ver regra 10f do systemInstruction).
    const maxSimilarity = allDisplayResults.length > 0
      ? Math.max(...allDisplayResults.map((r) => r.similarity))
      : 0;
    const lowCoverageBanner =
      maxSimilarity < 0.6
        ? `⚠️ COBERTURA BAIXA: o melhor match nas fontes recuperadas tem ${(maxSimilarity * 100).toFixed(0)}% de similaridade (abaixo de 60%). A base provavelmente NÃO contém material direto sobre essa pergunta. Aplique a regra 10f do systemInstruction: avise o aluno e use linguagem cautelosa. NÃO INVENTE conteúdo de enunciados, súmulas ou pareceres só porque seus títulos apareceram aqui — eles podem ter sido recuperados por correspondência fraca.\n\n`
        : '';

    const synthesisPrompt = `${lowCoverageBanner}${fullContext}
${historyContext}
PERGUNTA DO USUÁRIO:
${query}

FONTES DISPONÍVEIS NO CONTEXTO:
Artigos da Lei 14.133: ${articlesList || 'nenhum'}
Documentos:
${sourcesList || 'nenhum'}

RESPOSTA:`;

    // 12b. Build formatted results — batch query instead of N+1
    const docIds = [...new Set(allDisplayResults.map(r => r.documentId))];
    const docsMap = new Map<string, { uploadedAt: Date; tags: string | null; courseId: string | null; isCommon: boolean }>();
    if (docIds.length > 0) {
      const docs = await prisma.document.findMany({
        where: { id: { in: docIds } },
        select: { id: true, uploadedAt: true, tags: true, courseId: true, isCommon: true },
      });
      for (const doc of docs) {
        docsMap.set(doc.id, doc);
      }
    }

    const formattedResults: DocumentResult[] = allDisplayResults.map((result) => {
        const doc = docsMap.get(result.documentId) || null;

        const courseIds = result.isCommon
          ? []
          : result.courseId
          ? [result.courseId]
          : [];

        return {
          documentId: result.documentId,
          title: result.documentTitle,
          category: result.category,
          geminiResponse: result.chunkContent,
          relevance: result.similarity,
          excerpt: generateExcerpt(result.chunkContent),
          url: result.url,
          uploadedAt: doc?.uploadedAt?.toISOString() || new Date().toISOString(),
          tags: result.tags,
          courseIds: courseIds.length > 0 ? courseIds : undefined,
        };
      });

    // 13. Streaming response (SSE) — via lib/ai generateStream com fallback
    // cascade + safety + thinkingBudget=0 (Gemini 2.5/3 trunca sem isso).
    if (wantStream) {
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          try {
            // Send metadata first
            const meta = JSON.stringify({
              type: 'meta',
              results: formattedResults,
              legalSources: legalSources.length > 0 ? legalSources : undefined,
              totalDocuments: searchResponse.totalFound,
              query,
            });
            controller.enqueue(encoder.encode(`data: ${meta}\n\n`));

            // Stream Gemini tokens via lib/ai. finishReason chega no chunk
            // terminal (lib/ai provider emite chunk final com finishReason +
            // usage, separado dos chunks de texto).
            const streamResult = await generateStream('chat', {
              messages: [{ role: 'user', content: synthesisPrompt }],
              provider: 'gemini',
              model: PRIMARY_GEMINI_MODEL,
              fallbackModels: [...FALLBACK_GEMINI_MODELS].filter(
                (m) => m !== PRIMARY_GEMINI_MODEL,
              ),
              systemPrompt: systemInstruction,
              temperature: 0.5,
              maxTokens: 8192,
              // Sem thinkingBudget=0, o raciocínio come o maxTokens e a
              // resposta trunca no meio. Síntese factual não precisa de
              // thinking — só cita fontes.
              thinkingBudget: 0,
              safetySettings: LEGAL_SAFETY_SETTINGS,
            });
            let hasTokens = false;
            // Acumula tokens em buffer pra validação pós-stream de citações
            // entre aspas (anti-hallucination). Stream segue normal pro
            // cliente em paralelo — verificação é feita ao final.
            let fullAnswer = '';
            let finishReason: string | undefined;
            for await (const chunk of streamResult) {
              if (chunk.text) {
                hasTokens = true;
                fullAnswer += chunk.text;
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({ type: 'token', text: chunk.text })}\n\n`,
                  ),
                );
              }
              if (chunk.finishReason) {
                finishReason = chunk.finishReason;
              }
            }

            // Verifica finishReason pós-stream. Gemini 2.5 aborta em meio
            // de resposta quando detecta recitação literal (RECITATION) ou
            // safety parcial. Sem esse check, UI exibe resposta truncada
            // sem aviso.
            if (
              finishReason &&
              finishReason !== 'STOP' &&
              finishReason !== 'MAX_TOKENS'
            ) {
              apiLogger.warn(
                { finishReason, hasTokens },
                'Gemini stream interrupted before STOP',
              );
              const note = hasTokens
                ? `\n\n⚠️ (Resposta interrompida antes do final — motivo: ${finishReason}. Tente reformular a pergunta para evitar citação literal.)`
                : `Não consegui gerar uma síntese (motivo: ${finishReason}). Consulte as fontes abaixo.`;
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({ type: 'token', text: note })}\n\n`,
                ),
              );
            }

            if (!hasTokens) {
              const fallback = 'Não consegui sintetizar uma resposta agora. Consulte as fontes abaixo — elas contêm a informação relevante para sua pergunta.';
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'token', text: fallback })}\n\n`));
            }

            // Validação anti-hallucination: detecta citações entre aspas que
            // não existem nos chunks do contexto e adiciona aviso ao final.
            // Defesa em camadas — independe de o LLM ter respeitado o prompt.
            // Caso fundador: 2026-04-26, Enunciado IBDA 29 com aspas inventadas.
            if (hasTokens && fullAnswer.length > 0) {
              try {
                const contextChunks = allDisplayResults.map((r) => r.chunkContent);
                const validation = validateQuotedCitations(fullAnswer, contextChunks);
                if (validation.invalidQuotes.length > 0) {
                  apiLogger.warn(
                    {
                      query: query.slice(0, 200),
                      totalQuotes: validation.totalQuotes,
                      invalidQuotes: validation.invalidQuotes.map((q) => q.slice(0, 120)),
                      maxSimilarity,
                    },
                    'Citation validation: aspas não encontradas nos chunks de contexto',
                  );
                  const warning = buildCitationWarning(validation.invalidQuotes);
                  controller.enqueue(
                    encoder.encode(`data: ${JSON.stringify({ type: 'token', text: warning })}\n\n`),
                  );
                }
              } catch (err) {
                apiLogger.error({ err }, 'Citation validator falhou — segue sem aviso');
              }
            }

            controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          } catch (err) {
            apiLogger.error({ error: err }, 'SSE streaming error');
            const fallback = 'Não consegui sintetizar uma resposta agora. Consulte as fontes abaixo — elas contêm a informação relevante para sua pergunta.';
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'token', text: fallback })}\n\n`));
            controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          } finally {
            controller.close();
          }
        },
      });

      const latency = Date.now() - startTime;
      apiLogger.info({ resultCount: formattedResults.length, legalSourceCount: legalSources.length, latency }, 'Streaming response sent');
      trackServerEvent('ai_search', { resultCount: formattedResults.length, streaming: true });

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    }

    // 14. Non-streaming response (JSON)
    let synthesizedAnswer: string | undefined;

    try {
      const geminiResult = await queryGeminiText(synthesisPrompt, {
        temperature: 0.5,
        maxOutputTokens: 8192,
        thinkingBudget: 0,
        useCache,
        systemInstruction,
      });
      synthesizedAnswer = geminiResult.response;
    } catch (error) {
      apiLogger.error({ error }, 'Gemini synthesis failed');
    }

    const latency = Date.now() - startTime;

    apiLogger.info({ resultCount: formattedResults.length, legalSourceCount: legalSources.length, latency }, 'Query response sent');
    trackServerEvent('ai_search', { resultCount: formattedResults.length });

    return NextResponse.json<QueryResponse>({
      success: true,
      results: formattedResults,
      totalDocuments: searchResponse.totalFound,
      cached: searchResponse.cached,
      latency,
      query,
      synthesizedAnswer,
      legalSources: legalSources.length > 0 ? legalSources : undefined,
    });

  } catch (error) {
    apiLogger.error({ error }, 'Document query failed');

    return NextResponse.json<QueryResponse>(
      {
        success: false,
        results: [],
        totalDocuments: 0,
        cached: false,
        latency: Date.now() - startTime,
        query: '',
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}

// ===========================
// Helper Functions
// ===========================

/**
 * Hash simples para cache key de query expansion
 */
function hashQueryStr(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

/**
 * Diversify results with priority tiers:
 * Tier 1: Professor's materials (apostila, conteudo-programatico, outro, bibliografia, sumula, parecer)
 * Tier 2: Enunciados + ONs AGU (enunciados, orientacao-normativa)
 * Tier 3: Acórdãos TCU + Manual TCU (acordao, manual-tcu)
 * Tier 4: Pareceres AGU (decor, parecer-vinculante)
 *
 * Within each tier, picks best by similarity. Then fills remaining by similarity.
 */
function diversifyResults(results: SearchResult[], maxResults: number): SearchResult[] {
  if (results.length <= maxResults) return results;

  // Priority tiers (lower = higher priority)
  const CATEGORY_TIER: Record<string, number> = {
    'apostila': 1,
    'conteudo-programatico': 1,
    'outro': 1,
    'bibliografia': 1,
    'parecer': 1,
    'enunciados': 2,
    'orientacao-normativa': 2,
    'sumula': 2,
    'acordao': 3,
    'manual-tcu': 3,
    'consulta_tcu': 3,
    'informativo': 3,
    'decor': 4,
    'parecer-vinculante': 4,
  };

  // Per-category caps
  const CATEGORY_CAPS: Record<string, number> = {
    'manual-tcu': 1,
  };
  const DEFAULT_CAP = 3;
  const getCap = (cat: string) => CATEGORY_CAPS[cat] ?? DEFAULT_CAP;
  const getTier = (cat: string) => CATEGORY_TIER[cat] ?? 5;

  const byCategory = new Map<string, SearchResult[]>();
  for (const r of results) {
    const arr = byCategory.get(r.category) || [];
    arr.push(r);
    byCategory.set(r.category, arr);
  }

  const diverse: SearchResult[] = [];
  const usedIds = new Set<string>();
  const categoryCounts = new Map<string, number>();

  // Sort categories by tier priority, then pick best from each
  const sortedCategories = [...byCategory.entries()].sort(
    (a, b) => getTier(a[0]) - getTier(b[0])
  );

  // Phase 1: Best result from each category, in tier order
  for (const [, items] of sortedCategories) {
    if (diverse.length >= maxResults) break;
    diverse.push(items[0]);
    usedIds.add(items[0].documentId);
    categoryCounts.set(items[0].category, 1);
  }

  // Phase 2: Fill remaining slots respecting caps, prioritizing by tier then similarity
  const remaining = results
    .filter(r => !usedIds.has(r.documentId))
    .sort((a, b) => {
      const tierDiff = getTier(a.category) - getTier(b.category);
      if (tierDiff !== 0) return tierDiff;
      return b.similarity - a.similarity;
    });

  for (const r of remaining) {
    if (diverse.length >= maxResults) break;
    const catCount = categoryCounts.get(r.category) || 0;
    if (catCount >= getCap(r.category)) continue;
    diverse.push(r);
    usedIds.add(r.documentId);
    categoryCounts.set(r.category, catCount + 1);
  }

  // Phase 3: If still under maxResults, relax caps by +1
  if (diverse.length < maxResults) {
    for (const r of results) {
      if (diverse.length >= maxResults) break;
      if (usedIds.has(r.documentId)) continue;
      const catCount = categoryCounts.get(r.category) || 0;
      if (catCount >= getCap(r.category) + 1) continue;
      diverse.push(r);
      usedIds.add(r.documentId);
      categoryCounts.set(r.category, catCount + 1);
    }
  }

  return diverse.slice(0, maxResults);
}

/**
 * Generate excerpt from chunk content
 */
function generateExcerpt(content: string, maxLength: number = 200): string {
  if (content.length <= maxLength) {
    return content;
  }

  const truncated = content.substring(0, maxLength);
  const lastPeriod = truncated.lastIndexOf('.');

  if (lastPeriod > maxLength * 0.7) {
    return truncated.substring(0, lastPeriod + 1);
  }

  return truncated + '...';
}
