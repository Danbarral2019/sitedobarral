/**
 * Montagem determinística do contexto de resposta do assistente (RAG) — etapas
 * 4b→12b da rota `app/api/documents/query/route.ts`, extraídas VERBATIM na Fase 1
 * (`docs/PLANO_FASE1_ANSWERSERVICE.md`) para reuso pela rota de produção e pelo
 * harness de avaliação de síntese.
 *
 * Faz: enriquecimento de query (histórico + TIC), expansão, detecção de domínio,
 * hybrid search, retrieval complementar, montagem de contexto em camadas, seleção
 * de artigos da Lei, atos relacionados, montagem do prompt e formatação de fontes.
 * A CHAMADA AO LLM permanece no caller (rota faz streaming; eval usa generate()).
 */
import { prisma } from '@/lib/prisma';
import { apiLogger } from '@/lib/logger';
import { hybridSearch } from '@/lib/embeddings/hybrid-search';
import { buildContextForLLM } from '@/lib/embeddings/vector-search';
import type { SearchResult } from '@/lib/embeddings/vector-search';
import { withCache, CACHE_TTL } from '@/lib/cache/redis-client';
import { queryGeminiText } from '@/lib/gemini/cached-client';
import { getLeiArticles } from '@/lib/lei-articles';
import {
  extractCitedArticles,
  selectRelevantArticles,
  buildLeiContext,
  findRelatedActs,
  buildLayeredContext,
  formatActsContext,
  buildLegalSources,
} from '@/lib/legal-context';
import { hashQueryStr, diversifyResults, generateExcerpt } from './util';
import { detectQueryDomain, type QueryScope } from './domain-detection';
import type { AssembleAnswerInput, AnswerContext, DocumentResult } from './types';

/**
 * Executa retrieval + montagem de contexto + construção do prompt para uma
 * pergunta, retornando tudo o que o caller precisa para gerar a resposta.
 * Retorna `{ empty: true }` quando a busca não encontra nenhum resultado.
 */
export async function assembleAnswerContext(input: AssembleAnswerInput): Promise<AnswerContext> {
  const { query, filters, maxResults, conversationHistory, useCache } = input;

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

    // 5a. Detecção de domínio (TCEs/TST) + boost strong-labor + consciência de
    // canônicos cancelados/revistos + scope override — ver lib/rag/domain-detection.
    const scope: QueryScope = filters.scope ?? 'all';
    const domain = detectQueryDomain(query, scope);
    const { scopedOptions } = domain;
    if (domain.includeTribunalDecisions) {
      apiLogger.info({ tribunalMatchCount: domain.tribunalMatchCount }, 'Tribunal decisions included (matched tribunalPatterns)');
    }
    if (domain.tribunalBoost) {
      apiLogger.info(
        {
          hasInstitutionalLaborSignal: domain.hasInstitutionalLaborSignal,
          hasTier2LaborSignal: domain.hasTier2LaborSignal,
          tribunalMatchCount: domain.tribunalMatchCount,
          factor: domain.tribunalBoost.factor,
        },
        'Strong-labor query — aplicando boost de similarity no ramo TST',
      );
    }
    if (domain.isHistoricalQuery) {
      apiLogger.info('Query histórica detectada — incluindo documentos canônicos TST canceladas/revistas no contexto');
    }
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
      return {
        empty: true,
        cached: searchResponse.cached,
        totalFound: 0,
        systemInstruction: '',
        synthesisPrompt: '',
        formattedResults: [],
        legalSources: [],
        allDisplayResults: [],
        maxSimilarity: 0,
      };
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

    // Build lei context from semantic results + extra cited articles.
    // Fase 2.2: caps elevados — com LeiArticleEmbedding populada (Fase 2.1), a
    // seleção semântica traz os artigos certos, mas o cap antigo (1500) truncava
    // ANTES do 1º artigo longo (ex.: Art. 156 de sanções tem ~2k chars), fazendo
    // o modelo INVENTAR o teor. 10000 comporta ~5 artigos integrais.
    const semanticLeiContext = buildContextForLLM(leiResults, 4000);
    const extraLeiContext = buildLeiContext(missingArticles, 10000);
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
    const semanticActsContext = buildContextForLLM(allActContextResults, 5000);
    const extraActsFormatted = formatActsContext(extraActs, 4000);
    const fullActsContext = [semanticActsContext, extraActsFormatted].filter(Boolean).join('\n\n');

    // Build docs context (increased to fit more diverse results)
    const docsContext = buildContextForLLM(docResults, 20000);

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

    // 9. Build layered context. Fase 2.2: 20000 → 60000 chars (~15k tokens, custo
    // desprezível no Gemini 1M / Claude). O total antigo estrangulava a resposta
    // a ~5 trechos truncados; com 60k a camada Lei (30%=18k) comporta os artigos
    // integrais que a Fase 2.1 passou a encontrar.
    const combinedActsContext = ticActsContext
      ? `${fullActsContext}\n\n${ticActsContext}`
      : fullActsContext;
    const fullContext = buildLayeredContext(fullLeiContext, combinedActsContext, docsContext, 60000);

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
    // Fase 2.5: sinal de cobertura = MAIOR COSINE BRUTO do ramo vetorial
    // (searchResponse.topVectorSimilarity), não o `similarity` dos results — que
    // após o RRF vira score de fusão (~0.01) misturado com scores heurísticos
    // dos complementares (0.5-0.7), tornando o limiar de 0.6 (cosine) sem sentido.
    const maxSimilarity = searchResponse.topVectorSimilarity ?? 0;
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


  return {
    empty: false,
    cached: searchResponse.cached,
    totalFound: searchResponse.totalFound,
    systemInstruction,
    synthesisPrompt,
    formattedResults,
    legalSources,
    allDisplayResults,
    maxSimilarity,
  };
}
